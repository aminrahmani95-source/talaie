import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../storage';
import { TEST_USERS, DEFAULT_TEAMS, DEFAULT_TEAM_MEMBERS } from '../testUsers';
import { User, InstallationTeam, TeamMember } from '../../types';

// Standard in-memory localStorage mock for node environment
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createLocalStorageMock() as any;
}

// Helper to simulate the exact initialization logic of App.tsx
function simulateAppInitUsers(): User[] {
  const isInitialized = StorageService.isInitialized();
  const stored = StorageService.getUsers();
  const deletedIds = StorageService.getDeletedUserIds();

  if (!isInitialized && stored.length === 0) {
    StorageService.markInitialized(true);
    const initialUsers = TEST_USERS.filter((tu) => !deletedIds.has(tu.id));
    StorageService.saveUsers(initialUsers);
    return initialUsers;
  }

  if (!isInitialized && stored.length > 0) {
    StorageService.markInitialized(true);
  }

  return stored.filter((u) => !deletedIds.has(u.id));
}

// Helper to simulate the merge logic in App.tsx
function simulateMergeUsersList(localUsers: User[], cloudUsers: User[]): User[] {
  const deletedIds = StorageService.getDeletedUserIds();
  const map = new Map<string, User>();
  for (const u of localUsers) {
    if (u && u.id && !deletedIds.has(u.id)) {
      map.set(u.id, { ...u });
    }
  }

  for (const cu of cloudUsers) {
    if (!cu || !cu.id) continue;
    if (deletedIds.has(cu.id)) continue;

    const existingById = map.get(cu.id);
    const existingByPhone = Array.from(map.values()).find(
      (u) =>
        u.phone &&
        cu.phone &&
        u.phone.replace(/\D/g, '') === cu.phone.replace(/\D/g, '')
    );
    const target = existingById || existingByPhone;

    if (target) {
      const targetHasNewerEdit = target.updatedAt && (!cu.updatedAt || target.updatedAt >= cu.updatedAt);

      if (targetHasNewerEdit) {
        map.set(target.id, {
          ...cu,
          ...target,
        });
      } else {
        map.set(target.id, {
          ...cu,
          ...target,
          name: target.name || cu.name,
          phone: target.phone || cu.phone,
          role: target.role || cu.role,
          avatar: target.avatar || cu.avatar,
          active: target.active !== undefined ? target.active : (cu.active !== undefined ? cu.active : true),
        });
      }
    } else {
      map.set(cu.id, { ...cu });
    }
  }

  return Array.from(map.values()).filter((u) => !deletedIds.has(u.id));
}

describe('Storage & Tombstone Persistence (Preventing Test Data Re-seeding)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Initial Seeding vs Browser Refresh / Reload', () => {
    it('seeds TEST_USERS exactly once on the very first boot of the application', () => {
      expect(StorageService.isInitialized()).toBe(false);
      expect(StorageService.getUsers()).toHaveLength(0);

      const initialUsers = simulateAppInitUsers();
      expect(initialUsers.length).toBe(TEST_USERS.length);
      expect(StorageService.isInitialized()).toBe(true);

      const savedUsers = StorageService.getUsers();
      expect(savedUsers.length).toBe(TEST_USERS.length);
    });

    it('Scenario: Deleting a test user persists after browser refresh and DOES NOT re-seed', () => {
      // 1. Initial boot: app seeds default users
      const initialUsers = simulateAppInitUsers();
      expect(initialUsers.some((u) => u.id === 'u-sales-3')).toBe(true);

      // 2. Admin deletes 'u-sales-3' (آرمان شایگان)
      const targetUserId = 'u-sales-3';
      StorageService.addDeletedUserId(targetUserId);
      const filtered = initialUsers.filter((u) => u.id !== targetUserId);
      StorageService.saveUsers(filtered);

      expect(StorageService.isUserDeleted(targetUserId)).toBe(true);
      expect(StorageService.getUsers().some((u) => u.id === targetUserId)).toBe(false);

      // 3. User refreshes the browser (simulating page reload)
      const usersAfterRefresh = simulateAppInitUsers();

      // VERIFICATION: The deleted user must NOT reappear!
      expect(usersAfterRefresh.some((u) => u.id === targetUserId)).toBe(false);
      expect(usersAfterRefresh.length).toBe(TEST_USERS.length - 1);
    });

    it('Scenario: Deleting multiple personnel (lead, tech, coordinator) stays persistent across refresh', () => {
      simulateAppInitUsers();

      const toDelete = ['u-coordinator', 'u-lead-2', 'u-tech-3'];
      for (const id of toDelete) {
        StorageService.addDeletedUserId(id);
      }

      const remaining = StorageService.getUsers().filter((u) => !toDelete.includes(u.id));
      StorageService.saveUsers(remaining);

      // Refresh browser
      const reloaded = simulateAppInitUsers();
      for (const id of toDelete) {
        expect(reloaded.some((u) => u.id === id)).toBe(false);
      }
      expect(reloaded.length).toBe(TEST_USERS.length - 3);
    });

    it('Scenario: Deleting ALL users leaves the list empty and DOES NOT resurrect TEST_USERS', () => {
      simulateAppInitUsers();

      // Admin deletes all users
      const allUsers = StorageService.getUsers();
      for (const u of allUsers) {
        StorageService.addDeletedUserId(u.id);
      }
      StorageService.saveUsers([]);

      expect(StorageService.getUsers()).toHaveLength(0);

      // Refresh browser
      const usersAfterRefresh = simulateAppInitUsers();
      expect(usersAfterRefresh).toHaveLength(0);
    });
  });

  describe('2. Editing Personnel Data & Cloud Synchronization', () => {
    it('Scenario: Editing a user phone number persists and is NOT overwritten on refresh or cloud fetch', () => {
      simulateAppInitUsers();

      // Edit 'u-sales-1' phone number
      const editedUser: User = {
        id: 'u-sales-1',
        name: 'سپهر رادمنش (کارشناس ارشد فروش)',
        phone: '09191234567', // edited phone
        role: 'SALES_REP',
        active: true,
        updatedAt: new Date('2026-11-21T10:00:00Z').toISOString(),
      };

      const users = StorageService.getUsers().map((u) => (u.id === editedUser.id ? editedUser : u));
      StorageService.saveUsers(users);

      // Refresh browser
      const afterRefresh = simulateAppInitUsers();
      const loadedUser = afterRefresh.find((u) => u.id === 'u-sales-1');
      expect(loadedUser).toBeDefined();
      expect(loadedUser?.phone).toBe('09191234567');
      expect(loadedUser?.name).toBe('سپهر رادمنش (کارشناس ارشد فروش)');

      // Simulate cloud sync receiving old profile from Supabase
      const staleCloudUsers: User[] = [
        {
          id: 'u-sales-1',
          name: 'سپهر رادمنش (کارشناس فروش ۱)',
          phone: '09127777771', // old stale cloud phone
          role: 'SALES_REP',
          active: true,
          updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
        },
      ];

      const merged = simulateMergeUsersList(afterRefresh, staleCloudUsers);
      const mergedUser = merged.find((u) => u.id === 'u-sales-1');
      expect(mergedUser?.phone).toBe('09191234567'); // Local edit is preserved!
    });

    it('Scenario: Deactivating a user (active: false) is NOT overwritten by cloud active: true', () => {
      simulateAppInitUsers();

      // Deactivate 'u-tech-1'
      const user = StorageService.getUsers().find((u) => u.id === 'u-tech-1')!;
      const deactivated: User = { ...user, active: false, updatedAt: new Date().toISOString() };
      StorageService.saveUsers(StorageService.getUsers().map((u) => (u.id === 'u-tech-1' ? deactivated : u)));

      const localUsers = StorageService.getUsers();
      expect(localUsers.find((u) => u.id === 'u-tech-1')?.active).toBe(false);

      // Stale cloud response
      const cloudUsers: User[] = [{ ...user, active: true, updatedAt: '2026-01-01T00:00:00Z' }];
      const merged = simulateMergeUsersList(localUsers, cloudUsers);

      expect(merged.find((u) => u.id === 'u-tech-1')?.active).toBe(false);
    });

    it('Scenario: Cloud user matching a tombstone blacklist is NEVER resurrected', () => {
      simulateAppInitUsers();

      // Delete 'u-warehouse'
      StorageService.addDeletedUserId('u-warehouse');
      const filtered = StorageService.getUsers().filter((u) => u.id !== 'u-warehouse');
      StorageService.saveUsers(filtered);

      // Cloud returns u-warehouse profile from Supabase
      const cloudUsers: User[] = [
        {
          id: 'u-warehouse',
          name: 'داوود حسینی (مسئول انبار)',
          phone: '09125555551',
          role: 'WAREHOUSE',
          active: true,
        },
      ];

      const merged = simulateMergeUsersList(filtered, cloudUsers);
      expect(merged.some((u) => u.id === 'u-warehouse')).toBe(false);
    });
  });

  describe('3. Team Members Tombstones', () => {
    it('Scenario: Removing a team member adds tombstone and prevents resurrection', () => {
      StorageService.saveTeamMembers(DEFAULT_TEAM_MEMBERS);
      expect(StorageService.getTeamMembers().length).toBe(DEFAULT_TEAM_MEMBERS.length);

      // Remove team member 'tm-1-2'
      const targetMemberId = 'tm-1-2';
      StorageService.addDeletedTeamMemberId(targetMemberId);
      const remaining = StorageService.getTeamMembers().filter((m) => m.id !== targetMemberId);
      StorageService.saveTeamMembers(remaining);

      expect(StorageService.isTeamMemberDeleted(targetMemberId)).toBe(true);
      expect(StorageService.getTeamMembers().some((m) => m.id === targetMemberId)).toBe(false);

      // If someone attempts to save team members containing targetMemberId, it gets filtered
      StorageService.saveTeamMembers(DEFAULT_TEAM_MEMBERS);
      expect(StorageService.getTeamMembers().some((m) => m.id === targetMemberId)).toBe(false);
    });

    it('Scenario: Deleting a user automatically excludes their team membership', () => {
      StorageService.saveTeamMembers(DEFAULT_TEAM_MEMBERS);
      // 'tm-1-1' is lead 'u-lead-1'
      expect(StorageService.getTeamMembers().some((m) => m.userId === 'u-lead-1')).toBe(true);

      // Delete user 'u-lead-1'
      StorageService.addDeletedUserId('u-lead-1');

      // getTeamMembers should filter out any member with deleted userId
      expect(StorageService.getTeamMembers().some((m) => m.userId === 'u-lead-1')).toBe(false);
    });
  });

  describe('4. Factory Reset & Backup Portability', () => {
    it('Scenario: Full reset (resetAll) cleans up tombstones and seed markers for clean restart', () => {
      simulateAppInitUsers();
      StorageService.addDeletedUserId('u-sales-3');
      StorageService.addDeletedTeamMemberId('tm-1-1');

      expect(StorageService.isInitialized()).toBe(true);
      expect(StorageService.isUserDeleted('u-sales-3')).toBe(true);

      // Factory reset
      StorageService.resetAll();

      expect(StorageService.isInitialized()).toBe(false);
      expect(StorageService.isUserDeleted('u-sales-3')).toBe(false);
      expect(StorageService.isTeamMemberDeleted('tm-1-1')).toBe(false);
      expect(StorageService.getUsers()).toHaveLength(0);

      // Next app boot correctly re-seeds cleanly
      const freshBootUsers = simulateAppInitUsers();
      expect(freshBootUsers.length).toBe(TEST_USERS.length);
      expect(freshBootUsers.some((u) => u.id === 'u-sales-3')).toBe(true);
    });

    it('Scenario: Backup export and import preserves deleted user and team member tombstones', () => {
      simulateAppInitUsers();
      StorageService.addDeletedUserId('u-sales-2');
      StorageService.addDeletedTeamMemberId('tm-2-2');

      const backupStr = StorageService.exportBackup();
      const backupObj = JSON.parse(backupStr);

      expect(backupObj.deletedUserIds).toContain('u-sales-2');
      expect(backupObj.deletedTeamMemberIds).toContain('tm-2-2');

      // Clear storage
      localStorage.clear();
      expect(StorageService.isUserDeleted('u-sales-2')).toBe(false);

      // Import backup
      const success = StorageService.importBackup(backupStr);
      expect(success).toBe(true);

      expect(StorageService.isUserDeleted('u-sales-2')).toBe(true);
      expect(StorageService.isTeamMemberDeleted('tm-2-2')).toBe(true);
      expect(StorageService.getUsers().some((u) => u.id === 'u-sales-2')).toBe(false);
    });
  });
});
