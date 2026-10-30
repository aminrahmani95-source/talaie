import { createClient, SupabaseClient, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { Project, Ticket, User, SystemSettings } from '../types';
import { toEnglishDigits } from './jalali';

let supabaseInstance: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';
let syncChannel: ReturnType<SupabaseClient['channel']> | null = null;
let profilesChannel: ReturnType<SupabaseClient['channel']> | null = null;

export const SupabaseSyncService = {
  /**
   * Returns or initializes the singleton Supabase client.
   * Session is persisted in localStorage by Supabase Auth (persistSession: true).
   */
  getClient(url?: string, anonKey?: string): SupabaseClient | null {
    const finalUrl = url || import.meta.env.VITE_SUPABASE_URL;
    const finalKey = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
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
   * Converts an 11-digit Iranian mobile number to internal Supabase Auth email.
   * e.g. "09124339038" -> "09124339038@talaie.local"
   */
  phoneToEmail(phone: string): string {
    const digits = toEnglishDigits(phone.replace(/\D/g, ''));
    return `${digits}@talaie.local`;
  },

  /**
   * Real Supabase Auth login with phone and password.
   * Validates user profile in 'profiles' table and verifies user is active.
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
    const profile = await this.fetchProfileById(authData.user.id);
    if (!profile) {
      await client.auth.signOut();
      throw new Error('پروفایل پرسنلی شما در سامانه یافت نشد. با مدیر QC تماس بگیرید.');
    }

    if (!profile.active) {
      await client.auth.signOut();
      throw new Error('حساب کاربری شما غیرفعال شده است. با مدیر QC تماس بگیرید.');
    }

    return { user: profile, authUser: authData.user };
  },

  /**
   * Sign out current user from Supabase Auth
   */
  async signOut(): Promise<void> {
    const client = this.getClient();
    if (client) {
      await client.auth.signOut();
    }
  },

  /**
   * Fetch current session and validate active profile
   */
  async getCurrentSessionUser(): Promise<User | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data: { session }, error } = await client.auth.getSession();
      if (error || !session?.user) return null;

      const profile = await this.fetchProfileById(session.user.id);
      if (!profile || !profile.active) {
        await client.auth.signOut();
        return null;
      }
      return profile;
    } catch (err) {
      console.warn('Error fetching current session user:', err);
      return null;
    }
  },

  /**
   * Listen to Supabase Auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void): (() => void) {
    const client = this.getClient();
    if (!client) return () => {};

    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await this.fetchProfileById(session.user.id);
        if (profile && profile.active) {
          callback(profile);
        } else {
          await client.auth.signOut();
          callback(null);
        }
      } else {
        callback(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  /**
   * Fetch a single user profile from 'profiles' table
   */
  async fetchProfileById(userId: string): Promise<User | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('profiles')
        .select('id, name, phone, role, avatar, active')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return null;
      return {
        id: data.id,
        name: data.name,
        phone: data.phone,
        role: data.role,
        avatar: data.avatar || undefined,
        active: Boolean(data.active),
      };
    } catch (err) {
      console.warn('Failed to fetch profile:', err);
      return null;
    }
  },

  /**
   * Fetch all profiles from 'profiles' table
   */
  async fetchProfiles(): Promise<User[]> {
    const client = this.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('profiles')
        .select('id, name, phone, role, avatar, active')
        .order('name');

      if (error || !data) return [];
      return data.map((d: any) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        role: d.role,
        avatar: d.avatar || undefined,
        active: Boolean(d.active),
      }));
    } catch (err) {
      console.warn('Failed to fetch profiles:', err);
      return [];
    }
  },

  /**
   * Subscribe to real-time updates on 'profiles' table
   */
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

  /**
   * Invoke admin-users Edge Function for administrative user operations
   */
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

  /**
   * Initializes remote sync for projects, tickets, and settings
   */
  async subscribe(
    url: string | undefined,
    anonKey: string | undefined,
    callbacks: {
      onProjectsSync: (projects: Project[]) => void;
      onTicketsSync: (tickets: Ticket[]) => void;
      onSettingsSync: (settings: SystemSettings) => void;
    }
  ) {
    const client = this.getClient(url, anonKey);
    if (!client) return () => {};

    // 1. Initial Pull from cloud
    try {
      const { data, error } = await client.from('talaie_sync').select('key, value');
      if (!error && data) {
        data.forEach((row: { key: string; value: unknown }) => {
          if (row.key === 'projects' && Array.isArray(row.value)) {
            callbacks.onProjectsSync(row.value as Project[]);
          } else if (row.key === 'tickets' && Array.isArray(row.value)) {
            callbacks.onTicketsSync(row.value as Ticket[]);
          } else if (row.key === 'settings' && row.value && typeof row.value === 'object') {
            callbacks.onSettingsSync(row.value as SystemSettings);
          }
        });
      }
    } catch (err) {
      console.warn('Initial cloud pull failed (check table existence):', err);
    }

    // 2. Realtime Subscription for talaie_sync
    try {
      if (syncChannel) {
        client.removeChannel(syncChannel);
      }

      syncChannel = (client as any)
        .channel('talaie_sync_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'talaie_sync' },
          (payload: any) => {
            const row = payload.new;
            if (!row || !row.key) return;

            if (row.key === 'projects' && Array.isArray(row.value)) {
              callbacks.onProjectsSync(row.value as Project[]);
            } else if (row.key === 'tickets' && Array.isArray(row.value)) {
              callbacks.onTicketsSync(row.value as Ticket[]);
            } else if (row.key === 'settings' && row.value && typeof row.value === 'object') {
              callbacks.onSettingsSync(row.value as SystemSettings);
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription failed:', err);
    }

    return () => {
      if (syncChannel && client) {
        client.removeChannel(syncChannel);
        syncChannel = null;
      }
    };
  },

  /**
   * Push data to cloud (projects, tickets, settings)
   */
  async push(
    url: string | undefined,
    anonKey: string | undefined,
    key: 'projects' | 'tickets' | 'settings',
    value: unknown
  ) {
    const client = this.getClient(url, anonKey);
    if (!client) return;

    try {
      await client.from('talaie_sync').upsert(
        {
          key,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
    } catch (err) {
      console.warn(`Cloud push failed for ${key}:`, err);
    }
  },

  /**
   * Helper SQL script for user to copy-paste into Supabase SQL Editor
   */
  getSetupSqlScript(): string {
    return `-- =========================================================
-- گالری طلایی | اسکریپت فاز ۱ امنیت (جدول profiles و سیاست‌های RLS)
-- =========================================================

-- ۱. ساخت جدول پروفایل پرسنل
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text unique not null,
  role text not null check (role in ('QC_MANAGER', 'LEAD_TECHNICIAN', 'TECHNICIAN')),
  avatar text,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- فعال‌سازی امنیت سطح سطر (RLS)
alter table public.profiles enable row level security;

-- ۲. توابع کمکی امنیتی (Security Definer با search_path ثابت)
create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true
  );
$$;

create or replace function public.is_qc_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'QC_MANAGER' and active = true
  );
$$;

-- ۳. سیاست‌های جدول profiles
drop policy if exists "Active users or self read profiles" on public.profiles;
drop policy if exists "QC Managers insert profiles" on public.profiles;
drop policy if exists "QC Managers update profiles" on public.profiles;
drop policy if exists "QC Managers delete profiles" on public.profiles;

create policy "Active users or self read profiles"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.is_active_user());

create policy "QC Managers insert profiles"
  on public.profiles
  for insert
  to authenticated
  with check (public.is_qc_manager());

create policy "QC Managers update profiles"
  on public.profiles
  for update
  to authenticated
  using (public.is_qc_manager())
  with check (public.is_qc_manager());

create policy "QC Managers delete profiles"
  on public.profiles
  for delete
  to authenticated
  using (public.is_qc_manager());

-- ۴. تنظیم جدول talaie_sync و سیاست‌های RLS
create table if not exists public.talaie_sync (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table public.talaie_sync enable row level security;

-- حذف سیاست‌های قدیمی
drop policy if exists "Allow public access to talaie_sync" on public.talaie_sync;
drop policy if exists "Active users read sync" on public.talaie_sync;
drop policy if exists "Active users write projects and tickets" on public.talaie_sync;
drop policy if exists "Active users update projects and tickets" on public.talaie_sync;
drop policy if exists "QC Managers insert settings" on public.talaie_sync;
drop policy if exists "QC Managers update settings" on public.talaie_sync;
drop policy if exists "QC Managers delete sync" on public.talaie_sync;

-- لغو دسترسی ناشناس anon به تمام جداول
revoke all on public.talaie_sync from anon;
revoke all on public.profiles from anon;

-- سیاست‌های جدید talaie_sync
create policy "Active users read sync"
  on public.talaie_sync
  for select
  to authenticated
  using (public.is_active_user());

create policy "Active users write projects and tickets"
  on public.talaie_sync
  for insert
  to authenticated
  with check (public.is_active_user() and key in ('projects', 'tickets'));

create policy "Active users update projects and tickets"
  on public.talaie_sync
  for update
  to authenticated
  using (public.is_active_user() and key in ('projects', 'tickets'))
  with check (public.is_active_user() and key in ('projects', 'tickets'));

create policy "QC Managers insert settings"
  on public.talaie_sync
  for insert
  to authenticated
  with check (public.is_qc_manager() and key = 'settings');

create policy "QC Managers update settings"
  on public.talaie_sync
  for update
  to authenticated
  using (public.is_qc_manager() and key = 'settings')
  with check (public.is_qc_manager() and key = 'settings');

create policy "QC Managers delete sync"
  on public.talaie_sync
  for delete
  to authenticated
  using (public.is_qc_manager());

-- ۵. پاک‌سازی ردیف کاربران قدیمی از talaie_sync
delete from public.talaie_sync where key = 'users';

-- ۶. فعال‌سازی همگام‌سازی زنده (Realtime)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'talaie_sync'
  ) then
    alter publication supabase_realtime add table public.talaie_sync;
  end if;
end $$;
`;
  },
};
