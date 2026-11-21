import { Project, User, Ticket, SystemSettings, MaterialRequest, InstallationTeam, TeamMember } from '../types';
import { OfflineQueue } from './offlineQueue';

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
  MATERIAL_REQUESTS: 'talaie_material_requests_v6',
  TEAMS: 'talaie_teams_v6',
  TEAM_MEMBERS: 'talaie_team_members_v6',
  DELETED_USER_IDS: 'talaie_deleted_user_ids_v6',
  DELETED_TEAM_MEMBER_IDS: 'talaie_deleted_team_member_ids_v6',
  IS_INITIALIZED: 'talaie_storage_initialized_v6',
};

// Clean up legacy v5 mock caches & seed sales bookings on module evaluation
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.removeItem('talaie_projects_v5');
    localStorage.removeItem('talaie_tickets_v5');
    localStorage.removeItem('talaie_users_v5');
    const rawBookings = localStorage.getItem('talaei_sales_bookings_v1');
    if (rawBookings) {
      const parsed = JSON.parse(rawBookings);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (b: any) =>
            b &&
            b.id &&
            !b.id.startsWith('book-seed-') &&
            !b.id.startsWith('b-demo-') &&
            !b.id.startsWith('test-')
        );
        localStorage.setItem('talaei_sales_bookings_v1', JSON.stringify(cleaned));
      }
    }
  } catch {}
}

const MOCK_PROJECT_IDS = new Set(['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6']);
const isMockProjectId = (id: string) =>
  !id ||
  MOCK_PROJECT_IDS.has(id) ||
  id.startsWith('p-demo-') ||
  id.startsWith('p-test-') ||
  id.startsWith('p-from-sale-book-seed-') ||
  id.includes('seed-');

const isMockProject = (p: Project) => {
  if (!p || !p.id) return true;
  if (isMockProjectId(p.id)) return true;
  const name = (p.customerName || '').trim();
  const title = (p.title || '').trim();
  if (
    name === 'دکتر ستاری' ||
    name === 'مهندس پاشایی (ویلا لواسان)' ||
    name === 'خانم افشار' ||
    name === 'دفتر مرکزی شرکت پترو کیش'
  ) {
    return true;
  }
  if (
    title.startsWith('رزرو فروش: دکتر ستاری') ||
    title.startsWith('رزرو فروش: مهندس پاشایی') ||
    title.startsWith('رزرو فروش: خانم افشار') ||
    title.startsWith('رزرو فروش: دفتر مرکزی شرکت پترو کیش')
  ) {
    return true;
  }
  return false;
};

const isMockTicketId = (id: string) =>
  !id ||
  id === 't-1' ||
  id.startsWith('t-demo-') ||
  id.startsWith('t-test-') ||
  id.includes('seed-');

const isMockUserId = (id: string) => !id || id.startsWith('u-demo-');

export const StorageService = {
  getProjects(userId?: string): Project[] {
    const key = userId ? `${STORAGE_KEYS.PROJECTS}_${userId}` : STORAGE_KEYS.PROJECTS;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    try {
      const parsed: Project[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Filter out any legacy mock/test projects
      const filtered = parsed.filter((p) => !isMockProject(p));
      if (filtered.length !== parsed.length) {
        try {
          localStorage.setItem(key, JSON.stringify(filtered));
        } catch {}
      }
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

  saveProjects(projects: Project[], userId?: string) {
    try {
      const key = userId ? `${STORAGE_KEYS.PROJECTS}_${userId}` : STORAGE_KEYS.PROJECTS;
      // Lightweight cache: strip large base64 strings and __fromCache flag so it never causes QuotaExceededError
      const lightweightProjects = projects
        .filter((p) => !isMockProject(p))
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
      localStorage.setItem(key, JSON.stringify(lightweightProjects));
    } catch (e) {
      console.warn('LocalStorage saveProjects failed (quota limit):', e);
    }
  },

  // =========================================================================
  // DELETION BLACKLIST (TOMBSTONES) & INITIALIZATION MARKERS
  // =========================================================================

  getDeletedUserIds(): Set<string> {
    if (typeof window === 'undefined' && typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_USER_IDS);
    if (!raw) return new Set();
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed) : new Set();
    } catch {
      return new Set();
    }
  },

  addDeletedUserId(userId: string): void {
    if (!userId) return;
    try {
      const ids = this.getDeletedUserIds();
      ids.add(userId);
      localStorage.setItem(STORAGE_KEYS.DELETED_USER_IDS, JSON.stringify(Array.from(ids)));
    } catch (e) {
      console.warn('LocalStorage addDeletedUserId failed:', e);
    }
  },

  removeDeletedUserId(userId: string): void {
    if (!userId) return;
    try {
      const ids = this.getDeletedUserIds();
      if (ids.has(userId)) {
        ids.delete(userId);
        localStorage.setItem(STORAGE_KEYS.DELETED_USER_IDS, JSON.stringify(Array.from(ids)));
      }
    } catch (e) {
      console.warn('LocalStorage removeDeletedUserId failed:', e);
    }
  },

  isUserDeleted(userId: string): boolean {
    if (!userId) return false;
    return this.getDeletedUserIds().has(userId);
  },

  clearDeletedUserIds(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.DELETED_USER_IDS);
    } catch {}
  },

  getDeletedTeamMemberIds(): Set<string> {
    if (typeof window === 'undefined' && typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_TEAM_MEMBER_IDS);
    if (!raw) return new Set();
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed) : new Set();
    } catch {
      return new Set();
    }
  },

  addDeletedTeamMemberId(memberId: string): void {
    if (!memberId) return;
    try {
      const ids = this.getDeletedTeamMemberIds();
      ids.add(memberId);
      localStorage.setItem(STORAGE_KEYS.DELETED_TEAM_MEMBER_IDS, JSON.stringify(Array.from(ids)));
    } catch (e) {
      console.warn('LocalStorage addDeletedTeamMemberId failed:', e);
    }
  },

  removeDeletedTeamMemberId(memberId: string): void {
    if (!memberId) return;
    try {
      const ids = this.getDeletedTeamMemberIds();
      if (ids.has(memberId)) {
        ids.delete(memberId);
        localStorage.setItem(STORAGE_KEYS.DELETED_TEAM_MEMBER_IDS, JSON.stringify(Array.from(ids)));
      }
    } catch (e) {
      console.warn('LocalStorage removeDeletedTeamMemberId failed:', e);
    }
  },

  isTeamMemberDeleted(memberId: string): boolean {
    if (!memberId) return false;
    return this.getDeletedTeamMemberIds().has(memberId);
  },

  isInitialized(): boolean {
    if (typeof window === 'undefined' && typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.IS_INITIALIZED) === 'true';
  },

  markInitialized(initialized: boolean = true): void {
    try {
      if (initialized) {
        localStorage.setItem(STORAGE_KEYS.IS_INITIALIZED, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEYS.IS_INITIALIZED);
      }
    } catch {}
  },

  getUsers(): User[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      return [];
    }
    try {
      const parsed: User[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const deletedIds = this.getDeletedUserIds();
      return parsed.filter((u) => u && u.id && !isMockUserId(u.id) && !deletedIds.has(u.id));
    } catch {
      return [];
    }
  },

  saveUsers(users: User[]) {
    try {
      const deletedIds = this.getDeletedUserIds();
      const filtered = users.filter((u) => u && u.id && !isMockUserId(u.id) && !deletedIds.has(u.id));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));
    } catch (e) {
      console.warn('LocalStorage saveUsers failed:', e);
    }
  },

  getTickets(userId?: string): Ticket[] {
    const key = userId ? `${STORAGE_KEYS.TICKETS}_${userId}` : STORAGE_KEYS.TICKETS;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    try {
      const parsed: Ticket[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const filtered = parsed.filter((t) => t && t.id && !isMockTicketId(t.id));
      if (filtered.length !== parsed.length) {
        try {
          localStorage.setItem(key, JSON.stringify(filtered));
        } catch {}
      }
      return filtered;
    } catch {
      return [];
    }
  },

  saveTickets(tickets: Ticket[], userId?: string) {
    try {
      const key = userId ? `${STORAGE_KEYS.TICKETS}_${userId}` : STORAGE_KEYS.TICKETS;
      const filtered = tickets.filter((t) => t && t.id && !isMockTicketId(t.id));
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {
      console.warn('LocalStorage saveTickets failed:', e);
    }
  },

  getMaterialRequests(userId?: string): MaterialRequest[] {
    const key = userId ? `${STORAGE_KEYS.MATERIAL_REQUESTS}_${userId}` : STORAGE_KEYS.MATERIAL_REQUESTS;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    try {
      const parsed: MaterialRequest[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const filtered = parsed.filter(
        (r) =>
          r &&
          r.id &&
          !r.id.startsWith('mat-demo-') &&
          !r.id.startsWith('mat-test-') &&
          !r.id.includes('seed-')
      );
      if (filtered.length !== parsed.length) {
        try {
          localStorage.setItem(key, JSON.stringify(filtered));
        } catch {}
      }
      return filtered;
    } catch {
      return [];
    }
  },

  saveMaterialRequests(requests: MaterialRequest[], userId?: string) {
    try {
      const key = userId ? `${STORAGE_KEYS.MATERIAL_REQUESTS}_${userId}` : STORAGE_KEYS.MATERIAL_REQUESTS;
      const filtered = requests.filter(
        (r) =>
          r &&
          r.id &&
          !r.id.startsWith('mat-demo-') &&
          !r.id.startsWith('mat-test-') &&
          !r.id.includes('seed-')
      );
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {
      console.warn('LocalStorage saveMaterialRequests failed:', e);
    }
  },

  getTeams(): InstallationTeam[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TEAMS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveTeams(teams: InstallationTeam[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
    } catch (e) {
      console.warn('LocalStorage saveTeams failed:', e);
    }
  },

  getTeamMembers(): TeamMember[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TEAM_MEMBERS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const deletedMemberIds = this.getDeletedTeamMemberIds();
      const deletedUserIds = this.getDeletedUserIds();
      return parsed.filter(
        (m) => m && m.id && !deletedMemberIds.has(m.id) && (!m.userId || !deletedUserIds.has(m.userId))
      );
    } catch {
      return [];
    }
  },

  saveTeamMembers(teamMembers: TeamMember[]) {
    try {
      const deletedMemberIds = this.getDeletedTeamMemberIds();
      const deletedUserIds = this.getDeletedUserIds();
      const filtered = teamMembers.filter(
        (m) => m && m.id && !deletedMemberIds.has(m.id) && (!m.userId || !deletedUserIds.has(m.userId))
      );
      localStorage.setItem(STORAGE_KEYS.TEAM_MEMBERS, JSON.stringify(filtered));
    } catch (e) {
      console.warn('LocalStorage saveTeamMembers failed:', e);
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
      version: '2.3',
      brand: 'گالری طلایی',
      exportedAt: new Date().toISOString(),
      projects: this.getProjects(),
      users: this.getUsers(),
      tickets: this.getTickets(),
      materialRequests: this.getMaterialRequests(),
      settings: this.getSettings(),
      deletedUserIds: Array.from(this.getDeletedUserIds()),
      deletedTeamMemberIds: Array.from(this.getDeletedTeamMemberIds()),
    };
    return JSON.stringify(backup, null, 2);
  },

  // Import JSON backup
  importBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        return false;
      }
      if (Array.isArray(data.deletedUserIds)) {
        for (const id of data.deletedUserIds) this.addDeletedUserId(id);
      }
      if (Array.isArray(data.deletedTeamMemberIds)) {
        for (const id of data.deletedTeamMemberIds) this.addDeletedTeamMemberId(id);
      }
      if (Array.isArray(data.projects)) this.saveProjects(data.projects);
      if (Array.isArray(data.users)) this.saveUsers(data.users);
      if (Array.isArray(data.tickets)) this.saveTickets(data.tickets);
      if (Array.isArray(data.materialRequests)) this.saveMaterialRequests(data.materialRequests);
      if (data.settings && typeof data.settings === 'object') this.saveSettings(data.settings);
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  },

  // Reset local device cache
  resetAll() {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('talaie_') || key.startsWith('talaei_')) &&
          key !== 'talaie_theme'
        ) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {}
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.TICKETS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.MATERIAL_REQUESTS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.TEAMS);
    localStorage.removeItem(STORAGE_KEYS.TEAM_MEMBERS);
    localStorage.removeItem(STORAGE_KEYS.DELETED_USER_IDS);
    localStorage.removeItem(STORAGE_KEYS.DELETED_TEAM_MEMBER_IDS);
    localStorage.removeItem(STORAGE_KEYS.IS_INITIALIZED);
    localStorage.removeItem('talaei_sales_bookings_v1');
    localStorage.removeItem('talaie_projects_v5');
    localStorage.removeItem('talaie_users_v5');
    localStorage.removeItem('talaie_tickets_v5');
    localStorage.removeItem('talaie_settings_v5');
  },

  /**
   * Coordinated atomic full reset across both IndexedDB Outbox and LocalStorage.
   * Enforces strict two-phase reset:
   * 1. Purges IndexedDB outbox stores first (async & failure-prone).
   * 2. If IndexedDB purge fails, aborts immediately without touching LocalStorage.
   * 3. Purges LocalStorage.
   * 4. Post-verification: Verifies that both stores reached the empty state.
   * 5. If post-verification fails, throws an error so user is notified and can retry.
   */
  async executeFullReset(): Promise<void> {
    // Step 1: Purge IndexedDB outbox first
    await OfflineQueue.purgeAll();

    // Verify Outbox is genuinely empty
    const pendingCount = await OfflineQueue.getPendingCount();
    const failedCount = await OfflineQueue.getFailedCount();
    if (pendingCount !== 0 || failedCount !== 0) {
      throw new Error('پاک‌سازی صف آفلاین مرورگر با شکست مواجه شد. برخی عملیات‌ها باقی ماندند.');
    }

    // Step 2: Purge LocalStorage
    this.resetAll();

    // Verify LocalStorage business datasets are genuinely cleared
    const remainingProjects = this.getProjects();
    const remainingMaterials = this.getMaterialRequests();
    if (remainingProjects.length !== 0 || remainingMaterials.length !== 0) {
      throw new Error('پاک‌سازی حافظه محلی مرورگر با شکست مواجه شد.');
    }
  },
};
