import { Project, User, Ticket, SystemSettings } from '../types';

export const DEFAULT_MASTER_TOOLS = [
  'دریل بتن‌کن و چکشی',
  'نردبان 3 متری تلسکوپی',
  'نردبان 5 متری دوطرفه استاندارد',
  'تراز لیزری 360 درجه و خطی',
  'جعبه ابزار دستی (آچار، پیچ‌گوشتی، انبردست، سیم‌چین)',
  'ست پیچ و رولپلاک پروانه‌ای و حلزونی (کناف و گچ)',
  'ترانس برق و تستر فاز / مولتی‌متر',
  'دستگاه تست‌باکس و راه‌انداز موتور شید',
  'ریموت کنترل خام چندکاناله (جهت ست کردن کد)',
  'پایه‌های سقفی و دیواری یدک شید و پرده',
  'ریل‌کش فلزی و روان‌کننده سیلیکونی ریل',
  'اتو بخار پرده ایستاده (جهت فرم‌دهی نهایی)',
  'متر 5 متری لیزری و نواری',
  'تفنگ چسب حرارتی و چسب آهن فوری',
  'کاور محافظ کف و کاور پرده ضدگردوغبار',
];

export const INITIAL_USERS: User[] = [];

export const INITIAL_SETTINGS: SystemSettings = {
  visibilityWindowDays: 4, // پیش‌فرض 4 روز قابل مشاهده برای تکنسین‌ها
  companyName: 'گالری طلایی | طراحی، پرده و شید',
  defaultTools: DEFAULT_MASTER_TOOLS,
};

export const INITIAL_TICKETS: Ticket[] = [];

// Storage keys (v6: Production mode without mock data)
const STORAGE_KEYS = {
  PROJECTS: 'talaie_projects_v6',
  USERS: 'talaie_users_v6',
  TICKETS: 'talaie_tickets_v6',
  SETTINGS: 'talaie_settings_v6',
  CURRENT_USER: 'talaie_current_user_v6',
};

// Clean up legacy v5 mock caches on module evaluation
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.removeItem('talaie_projects_v5');
    localStorage.removeItem('talaie_tickets_v5');
    localStorage.removeItem('talaie_users_v5');
  } catch {}
}

const MOCK_PROJECT_IDS = new Set(['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6']);
const MOCK_USER_IDS = new Set(['u-admin-1', 'u-lead-1', 'u-tech-1']);
const MOCK_TICKET_IDS = new Set(['t-1']);

export const StorageService = {
  getProjects(): Project[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (!raw) {
      return [];
    }
    try {
      const parsed: Project[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Filter out any legacy mock/test projects
      const filtered = parsed.filter((p) => p && p.id && !MOCK_PROJECT_IDS.has(p.id));
      return filtered.map((p) => ({
        ...p,
        __fromCache: true,
        assignedTechnicianIds: Array.isArray(p.assignedTechnicianIds) ? p.assignedTechnicianIds : [],
        toolsRequired: Array.isArray(p.toolsRequired) ? p.toolsRequired : DEFAULT_MASTER_TOOLS,
        proposalImages: Array.isArray(p.proposalImages) ? p.proposalImages : [],
        beforePhotos: Array.isArray(p.beforePhotos) ? p.beforePhotos : [],
        afterPhotos: Array.isArray(p.afterPhotos) ? p.afterPhotos : [],
        completionPhotos: Array.isArray(p.completionPhotos) ? p.completionPhotos : [],
        evaluations: Array.isArray(p.evaluations) ? p.evaluations : [],
      }));
    } catch {
      return [];
    }
  },

  saveProjects(projects: Project[]) {
    try {
      // Lightweight cache: strip large base64 strings and __fromCache flag so it never causes QuotaExceededError
      const lightweightProjects = projects
        .filter((p) => p && p.id && !MOCK_PROJECT_IDS.has(p.id))
        .map((p) => {
          const copy: any = {
            ...p,
            proposalImages: p.proposalImages?.map((img) => ({
              ...img,
              url: img.url.startsWith('data:') ? '' : img.url,
            })),
            beforePhotos: p.beforePhotos?.map((ph) => (ph.startsWith('data:') ? '' : ph)),
            afterPhotos: p.afterPhotos?.map((ph) => (ph.startsWith('data:') ? '' : ph)),
            completionPhotos: p.completionPhotos?.map((ph) => (ph.startsWith('data:') ? '' : ph)),
            customerSignature: p.customerSignature && p.customerSignature.length > 5000 ? '' : p.customerSignature,
          };
          delete copy.__fromCache;
          return copy;
        });
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(lightweightProjects));
    } catch (e) {
      console.warn('LocalStorage saveProjects failed (quota limit):', e);
    }
  },

  getUsers(): User[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      return [];
    }
    try {
      const parsed: User[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((u) => u && u.id && !MOCK_USER_IDS.has(u.id));
    } catch {
      return [];
    }
  },

  saveUsers(users: User[]) {
    try {
      const filtered = users.filter((u) => u && u.id && !MOCK_USER_IDS.has(u.id));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));
    } catch (e) {
      console.warn('LocalStorage saveUsers failed:', e);
    }
  },

  getTickets(): Ticket[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (!raw) {
      return [];
    }
    try {
      const parsed: Ticket[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((t) => t && t.id && !MOCK_TICKET_IDS.has(t.id));
    } catch {
      return [];
    }
  },

  saveTickets(tickets: Ticket[]) {
    try {
      const filtered = tickets.filter((t) => t && t.id && !MOCK_TICKET_IDS.has(t.id));
      localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(filtered));
    } catch (e) {
      console.warn('LocalStorage saveTickets failed:', e);
    }
  },

  getSettings(): SystemSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      return INITIAL_SETTINGS;
    }
    try {
      const parsed = JSON.parse(raw);
      const merged: SystemSettings = {
        ...INITIAL_SETTINGS,
        ...parsed,
      };
      return merged;
    } catch {
      return INITIAL_SETTINGS;
    }
  },

  saveSettings(settings: SystemSettings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('LocalStorage saveSettings failed:', e);
    }
  },

  getCurrentUser(): User | null {
    // Current user is managed by Supabase Auth session, not localStorage
    return null;
  },

  setCurrentUser(_user: User | null) {
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch {}
  },

  // Export JSON backup for safe archiving
  exportBackup(): string {
    const backup = {
      version: '2.0',
      brand: 'گالری طلایی',
      exportedAt: new Date().toISOString(),
      projects: this.getProjects(),
      users: this.getUsers(),
      tickets: this.getTickets(),
      settings: this.getSettings(),
    };
    return JSON.stringify(backup, null, 2);
  },

  // Import JSON backup
  importBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.projects) this.saveProjects(data.projects);
      if (data.users) this.saveUsers(data.users);
      if (data.tickets) this.saveTickets(data.tickets);
      if (data.settings) this.saveSettings(data.settings);
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  },

  // Reset local device cache
  resetAll() {
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.TICKETS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem('talaie_projects_v5');
    localStorage.removeItem('talaie_users_v5');
    localStorage.removeItem('talaie_tickets_v5');
    localStorage.removeItem('talaie_settings_v5');
  },
};
