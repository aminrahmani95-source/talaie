import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Project, Ticket, User, SystemSettings } from '../types';

let supabaseInstance: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';
let activeChannel: ReturnType<SupabaseClient['channel']> | null = null;

export const SupabaseSyncService = {
  getClient(url?: string, anonKey?: string): SupabaseClient | null {
    const finalUrl = url || import.meta.env.VITE_SUPABASE_URL;
    const finalKey = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!finalUrl || !finalKey) return null;
    if (supabaseInstance && currentUrl === finalUrl && currentKey === finalKey) {
      return supabaseInstance;
    }

    try {
      supabaseInstance = createClient(finalUrl, finalKey, {
        auth: { persistSession: false },
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
   * Initializes remote sync: fetches latest data and subscribes to realtime updates
   */
  async subscribe(
    url: string | undefined,
    anonKey: string | undefined,
    callbacks: {
      onProjectsSync: (projects: Project[]) => void;
      onTicketsSync: (tickets: Ticket[]) => void;
      onUsersSync: (users: User[]) => void;
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
          } else if (row.key === 'users' && Array.isArray(row.value)) {
            callbacks.onUsersSync(row.value as User[]);
          } else if (row.key === 'settings' && row.value && typeof row.value === 'object') {
            callbacks.onSettingsSync(row.value as SystemSettings);
          }
        });
      }
    } catch (err) {
      console.warn('Initial cloud pull failed (check table existence):', err);
    }

    // 2. Realtime Subscription
    try {
      if (activeChannel) {
        client.removeChannel(activeChannel);
      }

      activeChannel = (client as any)
        .channel('talaie_realtime_channel')
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
            } else if (row.key === 'users' && Array.isArray(row.value)) {
              callbacks.onUsersSync(row.value as User[]);
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
      if (activeChannel && client) {
        client.removeChannel(activeChannel);
        activeChannel = null;
      }
    };
  },

  /**
   * Push data to cloud
   */
  async push(
    url: string | undefined,
    anonKey: string | undefined,
    key: 'projects' | 'tickets' | 'users' | 'settings',
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
    return `-- ==========================================
-- گالری طلایی | اسکریپت ساخت جدول همگام‌سازی ابری
-- ==========================================

create table if not exists public.talaie_sync (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- فعال‌سازی امنیت سطح سطر (RLS)
alter table public.talaie_sync enable row level security;

-- ایجاد دسترسی خواندن و نوشتن آزاد برای کلید عمومی Anon
drop policy if exists "Allow public access to talaie_sync" on public.talaie_sync;
create policy "Allow public access to talaie_sync"
  on public.talaie_sync
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- فعال‌سازی همگام‌سازی زنده (Realtime)
alter publication supabase_realtime add table public.talaie_sync;
`;
  },
};
