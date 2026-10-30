import { createClient, SupabaseClient, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { Project, Ticket, User, SystemSettings } from '../types';
import { toEnglishDigits } from './jalali';
import { OfflineQueue, OfflineOperation, PendingUpload } from './offlineQueue';

export type RealtimeConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';

const CACHED_PROFILE_KEY = 'talaie_cached_profile';

function saveCachedProfile(profile: User | null) {
  try {
    if (profile) {
      localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(CACHED_PROFILE_KEY);
    }
  } catch {}
}

function getCachedProfile(): User | null {
  try {
    const raw = localStorage.getItem(CACHED_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let supabaseInstance: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

// Active Realtime Channels
let projectsChannel: ReturnType<SupabaseClient['channel']> | null = null;
let ticketsChannel: ReturnType<SupabaseClient['channel']> | null = null;
let profilesChannel: ReturnType<SupabaseClient['channel']> | null = null;
let settingsChannel: ReturnType<SupabaseClient['channel']> | null = null;

// Signed URL cache: path -> { url, expiresAt }
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Realtime connection status listeners
let currentConnectionStatus: RealtimeConnectionStatus = 'DISCONNECTED';
const statusListeners = new Set<(status: RealtimeConnectionStatus) => void>();

function setConnectionStatus(status: RealtimeConnectionStatus) {
  if (currentConnectionStatus !== status) {
    currentConnectionStatus = status;
    statusListeners.forEach((listener) => listener(status));
  }
}

export const SupabaseSyncService = {
  /**
   * Returns or initializes the singleton Supabase client.
   * Credentials come strictly from environment variables (.env).
   * Session is persisted in localStorage by Supabase Auth (persistSession: true).
   */
  getClient(): SupabaseClient | null {
    const finalUrl = import.meta.env.VITE_SUPABASE_URL;
    const finalKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!finalUrl || !finalKey) return null;

    if (supabaseInstance && currentUrl === finalUrl && currentKey === finalKey) {
      return supabaseInstance;
    }

    try {
      supabaseInstance = createClient(finalUrl, finalKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      currentUrl = finalUrl;
      currentKey = finalKey;
      return supabaseInstance;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  },

  /**
   * Realtime Connection Status
   */
  getRealtimeStatus(): RealtimeConnectionStatus {
    return currentConnectionStatus;
  },

  onRealtimeStatusChange(callback: (status: RealtimeConnectionStatus) => void): (() => void) {
    statusListeners.add(callback);
    callback(currentConnectionStatus);
    return () => {
      statusListeners.delete(callback);
    };
  },

  /**
   * Converts an 11-digit Iranian mobile number to internal Supabase Auth email.
   * e.g. "09124339038" -> "09124339038@talaie.local"
   */
  phoneToEmail(phone: string): string {
    const digits = toEnglishDigits(phone.replace(/\D/g, ''));
    return `${digits}@talaie.local`;
  },

  /**
   * Real Supabase Auth login with phone and password.
   */
  async signIn(phone: string, password: string): Promise<{ user: User; authUser: SupabaseAuthUser }> {
    const client = this.getClient();
    if (!client) {
      throw new Error('تنظیمات اتصال به سرور Supabase یافت نشد.');
    }

    const email = this.phoneToEmail(phone);
    const { data: authData, error: authError } = await client.auth.signInWithPassword({
      email,
      password: toEnglishDigits(password),
    });

    if (authError || !authData.user) {
      throw new Error('شماره موبایل یا رمز عبور وارد شده نادرست است.');
    }

    // Fetch user profile from profiles table
    let profile: User | null = null;
    try {
      profile = await this.fetchProfileById(authData.user.id);
    } catch {
      profile = getCachedProfile();
    }

    if (!profile) {
      await client.auth.signOut();
      saveCachedProfile(null);
      throw new Error('پروفایل پرسنلی شما در سامانه یافت نشد. با مدیر QC تماس بگیرید.');
    }

    if (!profile.active) {
      await client.auth.signOut();
      saveCachedProfile(null);
      throw new Error('حساب کاربری شما غیرفعال شده است. با مدیر QC تماس بگیرید.');
    }

    saveCachedProfile(profile);
    return { user: profile, authUser: authData.user };
  },

  async signOut(): Promise<void> {
    saveCachedProfile(null);
    const client = this.getClient();
    if (client) {
      await client.auth.signOut();
    }
  },

  async getCurrentSessionUser(): Promise<User | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError || !session?.user) {
        saveCachedProfile(null);
        return null;
      }

      try {
        const profile = await this.fetchProfileById(session.user.id);
        if (!profile) {
          // Explicitly not in database (404/deleted)
          saveCachedProfile(null);
          await client.auth.signOut();
          return null;
        }
        if (!profile.active) {
          // Explicitly deactivated
          saveCachedProfile(null);
          await client.auth.signOut();
          return null;
        }
        saveCachedProfile(profile);
        return profile;
      } catch (networkErr) {
        // Network failure: preserve session with last valid cached profile
        console.warn('Network error fetching profile in session check, using cached profile:', networkErr);
        const cached = getCachedProfile();
        if (cached && cached.id === session.user.id && cached.active) {
          return cached;
        }
        return null;
      }
    } catch (err) {
      console.warn('Error fetching current session user:', err);
      const cached = getCachedProfile();
      return cached && cached.active ? cached : null;
    }
  },

  onAuthStateChange(callback: (user: User | null) => void): (() => void) {
    const client = this.getClient();
    if (!client) return () => {};

    // Synchronous callback wrapper with setTimeout(..., 0) to prevent auth state deadlock
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      setTimeout(async () => {
        if (session?.user) {
          try {
            const profile = await this.fetchProfileById(session.user.id);
            if (!profile) {
              saveCachedProfile(null);
              await client.auth.signOut();
              callback(null);
              return;
            }
            if (!profile.active) {
              saveCachedProfile(null);
              await client.auth.signOut();
              callback(null);
              return;
            }
            saveCachedProfile(profile);
            callback(profile);
          } catch (networkErr) {
            console.warn('Network error in onAuthStateChange, using last valid cached profile:', networkErr);
            const cached = getCachedProfile();
            if (cached && cached.id === session.user.id && cached.active) {
              callback(cached);
            } else {
              callback(null);
            }
          }
        } else {
          saveCachedProfile(null);
          callback(null);
        }
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  // =========================================================================
  // PROFILES (Users)
  // =========================================================================

  async fetchProfileById(userId: string): Promise<User | null> {
    const client = this.getClient();
    if (!client) return null;

    const { data, error } = await client
      .from('profiles')
      .select('id, name, phone, role, avatar, active')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Throw database/network error so caller knows it's a network issue, not a 404
      throw error;
    }

    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      phone: data.phone,
      role: data.role,
      avatar: data.avatar || undefined,
      active: Boolean(data.active),
    };
  },

  async fetchProfiles(): Promise<User[]> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم دسترسی به کلاینت Supabase.');
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, name, phone, role, avatar, active')
      .order('name');

    if (error) {
      console.warn('Failed to fetch profiles:', error);
      throw error;
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      role: d.role,
      avatar: d.avatar || undefined,
      active: Boolean(d.active),
    }));
  },

  subscribeProfiles(onUpdate: (profiles: User[]) => void): (() => void) {
    const client = this.getClient();
    if (!client) return () => {};

    try {
      if (profilesChannel) {
        client.removeChannel(profilesChannel);
      }

      profilesChannel = (client as any)
        .channel('talaie_profiles_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          async () => {
            const updatedProfiles = await this.fetchProfiles();
            onUpdate(updatedProfiles);
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Failed to subscribe to profiles:', err);
    }

    return () => {
      if (profilesChannel && client) {
        client.removeChannel(profilesChannel);
        profilesChannel = null;
      }
    };
  },

  async invokeAdminUsers(payload: {
    action: 'create' | 'update' | 'reset-password' | 'delete';
    [key: string]: any;
  }): Promise<{ success: boolean; error?: string; data?: any }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'سرویس اتصال در دسترس نیست.' };
    }

    try {
      const { data, error } = await client.functions.invoke('admin-users', {
        body: payload,
      });

      if (error) {
        return { success: false, error: error.message || 'خطا در اجرای عملیات سرور' };
      }
      if (data && data.error) {
        return { success: false, error: data.error };
      }
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطای غیرمنتظره در ارتباط با سرور' };
    }
  },

  // =========================================================================
  // PROJECTS (Row-by-Row in dedicated 'projects' table)
  // =========================================================================

  async fetchProjects(): Promise<Project[]> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم دسترسی به کلاینت Supabase.');
    }

    // First try fetching from dedicated 'projects' table (Migration 002)
    const { data, error } = await client
      .from('projects')
      .select('id, data, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch projects from cloud:', error);
      throw error;
    }

    if (Array.isArray(data) && data.length > 0) {
      return data.map((row: any) => ({
        ...row.data,
        id: row.id,
        updatedAt: row.data.updatedAt || row.updated_at,
      }));
    }

    // Fallback: Check legacy talaie_sync ONLY when projects table returned 0 rows without error
    const { data: syncData, error: syncError } = await client
      .from('talaie_sync')
      .select('value')
      .eq('key', 'projects')
      .maybeSingle();

    if (syncError) {
      throw syncError;
    }

    if (syncData && Array.isArray(syncData.value)) {
      return syncData.value as Project[];
    }

    return [];
  },

  async patchProject(projectId: string, patch: Record<string, any>): Promise<void> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم دسترسی به کلاینت Supabase.');
    }

    if (patch.customerSignature === '') {
      throw new Error('امضای کارفرما رشته خالی است و قابل ذخیره در سرور نیست.');
    }
    if (Array.isArray(patch.beforePhotos) && patch.beforePhotos.some((ph: any) => ph === '')) {
      throw new Error('آرایه عکس‌های قبل از نصب حاوی رشته خالی است و قابل ذخیره در سرور نیست.');
    }
    if (Array.isArray(patch.afterPhotos) && patch.afterPhotos.some((ph: any) => ph === '')) {
      throw new Error('آرایه عکس‌های بعد از نصب حاوی رشته خالی است و قابل ذخیره در سرور نیست.');
    }
    if (Array.isArray(patch.completionPhotos) && patch.completionPhotos.some((ph: any) => ph === '')) {
      throw new Error('آرایه عکس‌های اتمام کار حاوی رشته خالی است و قابل ذخیره در سرور نیست.');
    }
    if (Array.isArray(patch.proposalImages) && patch.proposalImages.some((img: any) => img.url === '')) {
      throw new Error('تصاویر پروپوزال حاوی آدرس خالی است و قابل ذخیره در سرور نیست.');
    }

    const cleanPatch = { ...patch };
    delete (cleanPatch as any).__fromCache;
    cleanPatch.updatedAt = cleanPatch.updatedAt || new Date().toISOString();

    const { error } = await client.rpc('patch_project', {
      id: projectId,
      patch: cleanPatch,
    });

    if (error) {
      console.warn(`Failed to patch project ${projectId}:`, error);
      throw error;
    }
  },

  async upsertProject(project: Project): Promise<void> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم دسترسی به کلاینت Supabase.');
    }

    // بررسی ممانعت از ذخیره فیلدهای عکس یا امضای خالی در دیتابیس
    if (project.customerSignature === '') {
      throw new Error('امضای کارفرما رشته خالی است و قابل ذخیره در سرور نیست.');
    }
    if (project.beforePhotos?.some((ph) => ph === '')) {
      throw new Error('آرایه عکس‌های قبل از نصب حاوی رشته خالی است و قابل ذخیره در سرور نیست.');
    }
    if (project.afterPhotos?.some((ph) => ph === '')) {
      throw new Error('آرایه عکس‌های بعد از نصب حاوی رشته خالی است و قابل ذخیره در سرور نیست.');
    }
    if (project.completionPhotos?.some((ph) => ph === '')) {
      throw new Error('آرایه عکس‌های اتمام کار حاوی رشته خالی است و قابل ذخیره در سرور نیست.');
    }
    if (project.proposalImages?.some((img) => img.url === '')) {
      throw new Error('تصاویر پروپوزال حاوی آدرس خالی است و قابل ذخیره در سرور نیست.');
    }

    const cleanProject = { ...project };
    delete (cleanProject as any).__fromCache;

    const updatedAt = cleanProject.updatedAt || new Date().toISOString();
    const { error } = await client.from('projects').upsert(
      {
        id: cleanProject.id,
        data: { ...cleanProject, updatedAt },
        updated_at: updatedAt,
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.warn(`Failed to upsert project ${project.id}:`, error);
      throw error;
    }
  },

  async deleteProject(projectId: string): Promise<void> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم دسترسی به کلاینت Supabase.');
    }

    const { error } = await client.from('projects').delete().eq('id', projectId);
    if (error) {
      console.warn(`Failed to delete project ${projectId}:`, error);
      throw error;
    }
  },

  subscribeProjects(callbacks: {
    onInsert: (project: Project) => void;
    onUpdate: (project: Project) => void;
    onDelete: (projectId: string) => void;
  }): (() => void) {
    const client = this.getClient();
    if (!client) return () => {};

    try {
      if (projectsChannel) {
        client.removeChannel(projectsChannel);
      }

      setConnectionStatus('CONNECTING');

      projectsChannel = (client as any)
        .channel('talaie_projects_channel')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'projects' },
          (payload: any) => {
            const project = payload.new?.data;
            if (project && project.id) {
              callbacks.onInsert(project);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'projects' },
          (payload: any) => {
            const project = payload.new?.data;
            if (project && project.id) {
              callbacks.onUpdate(project);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'projects' },
          (payload: any) => {
            const deletedId = payload.old?.id;
            if (deletedId) {
              callbacks.onDelete(deletedId);
            }
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('CONNECTED');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setConnectionStatus('DISCONNECTED');
          }
        });
    } catch (err) {
      console.warn('Realtime subscription for projects failed:', err);
      setConnectionStatus('DISCONNECTED');
    }

    return () => {
      if (projectsChannel && client) {
        client.removeChannel(projectsChannel);
        projectsChannel = null;
      }
    };
  },

  /**
   * Generates next sequential project code (e.g. PRJ-1001) using Postgres sequence.
   * Throws if sequence RPC fails; never falls back to client timestamps or random codes.
   */
  async getNextProjectCode(): Promise<string> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم دسترسی به سرور Supabase جهت دریافت شماره سفارش پروژه.');
    }

    const { data, error } = await client.rpc('next_project_code');
    if (error || !data || typeof data !== 'string') {
      throw new Error(`خطا در صدور کد ترتیبی پروژه از سرور: ${error?.message || 'کد پروژه دریافت نشد.'}`);
    }

    return data;
  },

  // =========================================================================
  // TICKETS (Row-by-Row in dedicated 'tickets' table)
  // =========================================================================

  async fetchTickets(): Promise<Ticket[]> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم دسترسی به کلاینت Supabase.');
    }

    // First try dedicated tickets table
    const { data, error } = await client
      .from('tickets')
      .select('id, data, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch tickets from cloud:', error);
      throw error;
    }

    if (Array.isArray(data) && data.length > 0) {
      return data.map((row: any) => ({
        ...row.data,
        id: row.id,
      }));
    }

    // Fallback: Check legacy talaie_sync ONLY when tickets table returned 0 rows without error
    const { data: syncData, error: syncError } = await client
      .from('talaie_sync')
      .select('value')
      .eq('key', 'tickets')
      .maybeSingle();

    if (syncError) {
      throw syncError;
    }

    if (syncData && Array.isArray(syncData.value)) {
      return syncData.value as Ticket[];
    }

    return [];
  },

  async upsertTicket(ticket: Ticket): Promise<void> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم دسترسی به کلاینت Supabase.');
    }

    const { error } = await client.from('tickets').upsert(
      {
        id: ticket.id,
        data: ticket,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn(`Failed to upsert ticket ${ticket.id}:`, error);
      throw error;
    }
  },

  async deleteTicket(ticketId: string): Promise<void> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم دسترسی به کلاینت Supabase.');
    }

    const { error } = await client.from('tickets').delete().eq('id', ticketId);
    if (error) {
      console.warn(`Failed to delete ticket ${ticketId}:`, error);
      throw error;
    }
  },

  subscribeTickets(callbacks: {
    onInsert: (ticket: Ticket) => void;
    onUpdate: (ticket: Ticket) => void;
    onDelete: (ticketId: string) => void;
  }): (() => void) {
    const client = this.getClient();
    if (!client) return () => {};

    try {
      if (ticketsChannel) {
        client.removeChannel(ticketsChannel);
      }

      ticketsChannel = (client as any)
        .channel('talaie_tickets_channel')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'tickets' },
          (payload: any) => {
            const ticket = payload.new?.data;
            if (ticket && ticket.id) {
              callbacks.onInsert(ticket);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'tickets' },
          (payload: any) => {
            const ticket = payload.new?.data;
            if (ticket && ticket.id) {
              callbacks.onUpdate(ticket);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'tickets' },
          (payload: any) => {
            const deletedId = payload.old?.id;
            if (deletedId) {
              callbacks.onDelete(deletedId);
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription for tickets failed:', err);
    }

    return () => {
      if (ticketsChannel && client) {
        client.removeChannel(ticketsChannel);
        ticketsChannel = null;
      }
    };
  },

  // =========================================================================
  // SETTINGS (Stored in 'talaie_sync' under key = 'settings')
  // =========================================================================

  async fetchSettings(): Promise<SystemSettings | null> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم دسترسی به کلاینت Supabase.');
    }

    const { data, error } = await client
      .from('talaie_sync')
      .select('value')
      .eq('key', 'settings')
      .maybeSingle();

    if (error) {
      console.warn('Failed to fetch settings:', error);
      throw error;
    }

    if (data && data.value && typeof data.value === 'object') {
      return data.value as SystemSettings;
    }
    return null;
  },

  async upsertSettings(settings: SystemSettings): Promise<void> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم دسترسی به کلاینت Supabase.');
    }

    const { error } = await client.from('talaie_sync').upsert(
      {
        key: 'settings',
        value: settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
    if (error) {
      console.warn('Failed to upsert settings:', error);
      throw error;
    }
  },

  async executeOfflineOperation(op: OfflineOperation): Promise<void> {
    switch (op.type) {
      case 'PATCH_PROJECT': {
        const projectId = op.projectId || op.payload?.id;
        if (!projectId) {
          throw new Error('شناسه پروژه برای عملیات به‌روزرسانی تکه‌ای (patch) یافت نشد.');
        }
        await this.patchProject(projectId, op.payload);
        break;
      }
      case 'UPSERT_PROJECT':
        await this.upsertProject(op.payload);
        break;
      case 'DELETE_PROJECT':
        await this.deleteProject(typeof op.payload === 'string' ? op.payload : op.payload.id);
        break;
      case 'UPSERT_TICKET':
        await this.upsertTicket(op.payload);
        break;
      case 'DELETE_TICKET':
        await this.deleteTicket(typeof op.payload === 'string' ? op.payload : op.payload.id);
        break;
      case 'UPSERT_SETTINGS':
        await this.upsertSettings(op.payload);
        break;
      default:
        break;
    }
  },

  processOfflineQueue(): Promise<void> {
    const client = this.getClient();
    if (!client) return Promise.resolve();

    return OfflineQueue.processQueue({
      uploadBlob: async (upload: PendingUpload) => {
        const storagePath = `projects/${upload.projectId}/${upload.fileName}`;
        const { error } = await client.storage
          .from('talaie-photos')
          .upload(storagePath, upload.blob, {
            contentType: upload.mimeType,
            upsert: true,
          });

        if (error) {
          throw new Error(`Upload error on ${storagePath}: ${error.message}`);
        }
        return storagePath;
      },
      executeOp: async (op: OfflineOperation) => {
        await this.executeOfflineOperation(op);
      },
    });
  },

  subscribeSettings(onUpdate: (settings: SystemSettings) => void): (() => void) {
    const client = this.getClient();
    if (!client) return () => {};

    try {
      if (settingsChannel) {
        client.removeChannel(settingsChannel);
      }

      settingsChannel = (client as any)
        .channel('talaie_settings_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'talaie_sync' },
          (payload: any) => {
            const row = payload.new;
            if (row && row.key === 'settings' && row.value && typeof row.value === 'object') {
              onUpdate(row.value as SystemSettings);
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription for settings failed:', err);
    }

    return () => {
      if (settingsChannel && client) {
        client.removeChannel(settingsChannel);
        settingsChannel = null;
      }
    };
  },

  // =========================================================================
  // SUPABASE STORAGE (Bucket: 'talaie-photos' & Signed URLs)
  // =========================================================================

  /**
   * Uploads an image (File, Blob, or base64 data URL) to Supabase Storage.
   * Stored at path: projects/<projectId>/<uuid>.jpg
   * Returns the storage relative path (e.g. 'projects/p-101/1730000000-abc1234.jpg').
   */
  async uploadProjectPhoto(
    projectId: string,
    fileOrBlobOrBase64: File | Blob | string
  ): Promise<string> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم اتصال به سرویس ذخیره‌سازی ابری Supabase.');
    }

    let blob: Blob;
    if (typeof fileOrBlobOrBase64 === 'string') {
      // Convert data URL to Blob
      if (fileOrBlobOrBase64.startsWith('data:')) {
        const res = await fetch(fileOrBlobOrBase64);
        blob = await res.blob();
      } else {
        // Already a path
        return fileOrBlobOrBase64;
      }
    } else {
      blob = fileOrBlobOrBase64;
    }

    const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const storagePath = `projects/${projectId}/${uuid}.jpg`;

    const { error } = await client.storage
      .from('talaie-photos')
      .upload(storagePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      throw new Error(`خطا در آپلود عکس به فضای ابری: ${error.message}`);
    }

    return storagePath;
  },

  /**
   * Uploads customer signature (base64 data URL or Blob) to Supabase Storage.
   * Stored at path: projects/<projectId>/signature-<uuid>.png
   * Returns storage relative path (e.g. 'projects/p-101/signature-1730000000-abc1234.png').
   */
  async uploadProjectSignature(
    projectId: string,
    fileOrBlobOrBase64: File | Blob | string
  ): Promise<string> {
    const client = this.getClient();
    if (!client) {
      throw new Error('عدم اتصال به سرویس ذخیره‌سازی ابری Supabase.');
    }

    let blob: Blob;
    if (typeof fileOrBlobOrBase64 === 'string') {
      if (fileOrBlobOrBase64.startsWith('data:')) {
        const res = await fetch(fileOrBlobOrBase64);
        blob = await res.blob();
      } else {
        return fileOrBlobOrBase64;
      }
    } else {
      blob = fileOrBlobOrBase64;
    }

    const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const storagePath = `projects/${projectId}/signature-${uuid}.png`;

    const { error } = await client.storage
      .from('talaie-photos')
      .upload(storagePath, blob, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      throw new Error(`خطا در آپلود امضای کارفرما به فضای ابری: ${error.message}`);
    }

    return storagePath;
  },

  /**
   * Returns a viewable URL for a photo.
   * If the path is already a base64 data URL or external URL, returns it directly.
   * If it's a Supabase Storage path, returns a cached or freshly generated signed URL.
   */
  async getSignedPhotoUrl(path: string): Promise<string> {
    if (!path) return '';
    if (
      path.startsWith('data:') ||
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('blob:')
    ) {
      return path;
    }

    // Check memory cache
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.url;
    }

    const client = this.getClient();
    if (!client) return '';

    try {
      const { data, error } = await client.storage
        .from('talaie-photos')
        .createSignedUrl(path, 3600); // 1 hour validity

      if (error || !data?.signedUrl) {
        return '';
      }

      signedUrlCache.set(path, {
        url: data.signedUrl,
        expiresAt: Date.now() + 3500 * 1000,
      });

      return data.signedUrl;
    } catch {
      return '';
    }
  },

  /**
   * Admin tool: Migrates legacy base64 images to Supabase Storage bucket.
   * Reports progress and updates projects table in database.
   */
  async migrateLegacyPhotos(
    projects: Project[],
    onProgress: (current: number, total: number) => void
  ): Promise<{ updatedProjects: Project[]; migratedCount: number }> {
    // 1. Count total base64 images
    let totalBase64 = 0;
    projects.forEach((p) => {
      p.beforePhotos?.forEach((ph) => { if (ph.startsWith('data:')) totalBase64++; });
      p.afterPhotos?.forEach((ph) => { if (ph.startsWith('data:')) totalBase64++; });
      p.completionPhotos?.forEach((ph) => { if (ph.startsWith('data:')) totalBase64++; });
      p.proposalImages?.forEach((img) => { if (img.url.startsWith('data:')) totalBase64++; });
    });

    if (totalBase64 === 0) {
      return { updatedProjects: projects, migratedCount: 0 };
    }

    let currentProgress = 0;
    const updatedProjects: Project[] = [];

    for (const proj of projects) {
      let changed = false;
      const copy: Project = { ...proj };

      // Before photos
      if (copy.beforePhotos) {
        const nextBefore: string[] = [];
        for (const ph of copy.beforePhotos) {
          if (ph.startsWith('data:')) {
            try {
              const uploadedPath = await this.uploadProjectPhoto(proj.id, ph);
              nextBefore.push(uploadedPath);
              changed = true;
            } catch {
              nextBefore.push(ph);
            }
            currentProgress++;
            onProgress(currentProgress, totalBase64);
          } else {
            nextBefore.push(ph);
          }
        }
        copy.beforePhotos = nextBefore;
      }

      // After photos
      if (copy.afterPhotos) {
        const nextAfter: string[] = [];
        for (const ph of copy.afterPhotos) {
          if (ph.startsWith('data:')) {
            try {
              const uploadedPath = await this.uploadProjectPhoto(proj.id, ph);
              nextAfter.push(uploadedPath);
              changed = true;
            } catch {
              nextAfter.push(ph);
            }
            currentProgress++;
            onProgress(currentProgress, totalBase64);
          } else {
            nextAfter.push(ph);
          }
        }
        copy.afterPhotos = nextAfter;
      }

      // Completion photos
      if (copy.completionPhotos) {
        const nextComp: string[] = [];
        for (const ph of copy.completionPhotos) {
          if (ph.startsWith('data:')) {
            try {
              const uploadedPath = await this.uploadProjectPhoto(proj.id, ph);
              nextComp.push(uploadedPath);
              changed = true;
            } catch {
              nextComp.push(ph);
            }
            currentProgress++;
            onProgress(currentProgress, totalBase64);
          } else {
            nextComp.push(ph);
          }
        }
        copy.completionPhotos = nextComp;
      }

      // Proposal images
      if (copy.proposalImages) {
        const nextProps = [];
        for (const img of copy.proposalImages) {
          if (img.url.startsWith('data:')) {
            try {
              const uploadedPath = await this.uploadProjectPhoto(proj.id, img.url);
              nextProps.push({ ...img, url: uploadedPath });
              changed = true;
            } catch {
              nextProps.push(img);
            }
            currentProgress++;
            onProgress(currentProgress, totalBase64);
          } else {
            nextProps.push(img);
          }
        }
        copy.proposalImages = nextProps;
      }

      if (changed) {
        await this.upsertProject(copy);
      }
      updatedProjects.push(copy);
    }

    return { updatedProjects, migratedCount: currentProgress };
  },

  /**
   * Helper SQL script for user to copy-paste into Supabase SQL Editor
   */
  getSetupSqlScript(): string {
    return `-- لطفاً دستورات موجود در پوشه supabase/migrations را اجرا فرمایید:
-- 001_security.sql (فاز ۱: امنیت و profiles)
-- 002_tables.sql (فاز ۲: جدول‌های projects و tickets و باکت تصاویر)
-- 003_migrate_user_ids.sql (فاز ۲: مهاجرت شناسه‌های پرسنل به UUID)
`;
  },
};

// پردازش صف آفلاین در زمان اتصال مجدد اینترنت
if (typeof window !== 'undefined') {
  window.addEventListener('talaie-trigger-offline-sync', () => {
    SupabaseSyncService.processOfflineQueue();
  });
}
