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
    if (!cu || !cu.id || deletedIds.has(cu.id)) continue;
    const local = map.get(cu.id);
    if (!local) {
      map.set(cu.id, { ...cu });
    } else {
      const localTime = new Date(local.updatedAt || 0).getTime();
      const cloudTime = new Date(cu.updatedAt || 0).getTime();
      if (cloudTime > localTime) {
        map.set(cu.id, { ...cu });
      }
    }
  }

  return Array.from(map.values());
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

    it('Scenario: Deleting a user persists after browser refresh and DOES NOT re-seed', () => {
      // 1. Initial boot: app seeds default users
      const initialUsers = simulateAppInitUsers();
      expect(initialUsers.some((u) => u.id === 'u-qc-manager')).toBe(true);

      // 2. Admin deletes 'u-qc-manager'
      const targetUserId = 'u-qc-manager';
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

    it('Scenario: Deleting multiple personnel stays persistent across refresh', () => {
      simulateAppInitUsers();

      // Add a couple of dynamic users to test multiple deletions
      const extraUser1: User = { id: 'u-emp-101', name: 'کارمند ۱', phone: '09350000001', role: 'TECHNICIAN', active: true };
      const extraUser2: User = { id: 'u-emp-102', name: 'کارمند ۲', phone: '09350000002', role: 'TECHNICIAN', active: true };
      StorageService.saveUsers([...StorageService.getUsers(), extraUser1, extraUser2]);

      const toDelete = ['u-emp-101', 'u-emp-102'];
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
      expect(reloaded.length).toBe(TEST_USERS.length);
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

      // Edit 'u-qc-manager' phone number
      const editedUser: User = {
        id: 'u-qc-manager',
        name: 'مهندس رحمانی (مدیر اپ)',
        phone: '09191234567', // edited phone
        role: 'QC_MANAGER',
        active: true,
        updatedAt: new Date('2026-11-21T10:00:00Z').toISOString(),
      };

      const users = StorageService.getUsers().map((u) => (u.id === editedUser.id ? editedUser : u));
      StorageService.saveUsers(users);

      // Refresh browser
      const afterRefresh = simulateAppInitUsers();
      const loadedUser = afterRefresh.find((u) => u.id === 'u-qc-manager');
      expect(loadedUser).toBeDefined();
      expect(loadedUser?.phone).toBe('09191234567');
      expect(loadedUser?.name).toBe('مهندس رحمانی (مدیر اپ)');

      // Simulate cloud sync receiving old profile from Supabase
      const staleCloudUsers: User[] = [
        {
          id: 'u-qc-manager',
          name: 'مهندس رحمانی (مدیر اپ و QC)',
          phone: '09124339038', // old stale cloud phone
          role: 'QC_MANAGER',
          active: true,
          updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
        },
      ];

      const merged = simulateMergeUsersList(afterRefresh, staleCloudUsers);
      const mergedUser = merged.find((u) => u.id === 'u-qc-manager');
      expect(mergedUser?.phone).toBe('09191234567'); // Local edit is preserved!
    });

    it('Scenario: Deactivating a user (active: false) is NOT overwritten by cloud active: true', () => {
      simulateAppInitUsers();

      // Deactivate 'u-qc-manager'
      const user = StorageService.getUsers().find((u) => u.id === 'u-qc-manager')!;
      const deactivated: User = { ...user, active: false, updatedAt: new Date().toISOString() };
      StorageService.saveUsers(StorageService.getUsers().map((u) => (u.id === 'u-qc-manager' ? deactivated : u)));

      const localUsers = StorageService.getUsers();
      expect(localUsers.find((u) => u.id === 'u-qc-manager')?.active).toBe(false);

      // Stale cloud response
      const cloudUsers: User[] = [{ ...user, active: true, updatedAt: '2026-01-01T00:00:00Z' }];
      const merged = simulateMergeUsersList(localUsers, cloudUsers);

      expect(merged.find((u) => u.id === 'u-qc-manager')?.active).toBe(false);
    });

    it('Scenario: Cloud user matching a tombstone blacklist is NEVER resurrected', () => {
      simulateAppInitUsers();

      // Delete 'u-emp-custom'
      StorageService.addDeletedUserId('u-emp-custom');
      const filtered = StorageService.getUsers().filter((u) => u.id !== 'u-emp-custom');
      StorageService.saveUsers(filtered);

      // Cloud returns u-emp-custom profile from Supabase
      const cloudUsers: User[] = [
        {
          id: 'u-emp-custom',
          name: 'کارمند تستی سرور',
          phone: '09359999999',
          role: 'TECHNICIAN',
          active: true,
        },
      ];

      const merged = simulateMergeUsersList(filtered, cloudUsers);
      expect(merged.some((u) => u.id === 'u-emp-custom')).toBe(false);
    });
  });

  describe('3. Team Members Tombstones', () => {
    it('Scenario: Removing a team member adds tombstone and prevents resurrection', () => {
      const sampleTeamMembers: TeamMember[] = [
        { id: 'tm-sample-1', teamId: 'TEAM_1', userId: 'u-qc-manager', roleInTeam: 'LEAD', joinedAt: '2026-01-01' },
        { id: 'tm-sample-2', teamId: 'TEAM_1', userId: 'u-ceo', roleInTeam: 'TECHNICIAN', joinedAt: '2026-01-01' },
      ];
      StorageService.saveTeamMembers(sampleTeamMembers);
      expect(StorageService.getTeamMembers().length).toBe(sampleTeamMembers.length);

      // Remove team member 'tm-sample-2'
      const targetMemberId = 'tm-sample-2';
      StorageService.addDeletedTeamMemberId(targetMemberId);
      const remaining = StorageService.getTeamMembers().filter((m) => m.id !== targetMemberId);
      StorageService.saveTeamMembers(remaining);

      expect(StorageService.isTeamMemberDeleted(targetMemberId)).toBe(true);
      expect(StorageService.getTeamMembers().some((m) => m.id === targetMemberId)).toBe(false);

      // If someone attempts to save team members containing targetMemberId, it gets filtered
      StorageService.saveTeamMembers(sampleTeamMembers);
      expect(StorageService.getTeamMembers().some((m) => m.id === targetMemberId)).toBe(false);
    });

    it('Scenario: Deleting a user automatically excludes their team membership', () => {
      const sampleTeamMembers: TeamMember[] = [
        { id: 'tm-sample-1', teamId: 'TEAM_1', userId: 'u-qc-manager', roleInTeam: 'LEAD', joinedAt: '2026-01-01' },
      ];
      StorageService.saveTeamMembers(sampleTeamMembers);
      expect(StorageService.getTeamMembers().some((m) => m.userId === 'u-qc-manager')).toBe(true);

      // Delete user 'u-qc-manager'
      StorageService.addDeletedUserId('u-qc-manager');

      // getTeamMembers should filter out any member with deleted userId
      expect(StorageService.getTeamMembers().some((m) => m.userId === 'u-qc-manager')).toBe(false);
    });
  });

  describe('4. Factory Reset & Backup Portability', () => {
    it('Scenario: Full reset (resetAll) cleans up tombstones and seed markers for clean restart', () => {
      simulateAppInitUsers();
      StorageService.addDeletedUserId('u-qc-manager');
      StorageService.addDeletedTeamMemberId('tm-sample-1');

      expect(StorageService.isInitialized()).toBe(true);
      expect(StorageService.isUserDeleted('u-qc-manager')).toBe(true);

      // Factory reset
      StorageService.resetAll();

      expect(StorageService.isInitialized()).toBe(false);
      expect(StorageService.isUserDeleted('u-qc-manager')).toBe(false);
      expect(StorageService.isTeamMemberDeleted('tm-sample-1')).toBe(false);
      expect(StorageService.getUsers()).toHaveLength(0);

      // Next app boot correctly re-seeds cleanly
      const freshBootUsers = simulateAppInitUsers();
      expect(freshBootUsers.length).toBe(TEST_USERS.length);
      expect(freshBootUsers.some((u) => u.id === 'u-qc-manager')).toBe(true);
    });

    it('Scenario: Backup export and import preserves deleted user and team member tombstones', () => {
      simulateAppInitUsers();
      StorageService.addDeletedUserId('u-qc-manager');
      StorageService.addDeletedTeamMemberId('tm-backup-1');

      const backupStr = StorageService.exportBackup();
      const backupObj = JSON.parse(backupStr);

      expect(backupObj.deletedUserIds).toContain('u-qc-manager');
      expect(backupObj.deletedTeamMemberIds).toContain('tm-backup-1');

      // Clear storage
      localStorage.clear();
      expect(StorageService.isUserDeleted('u-qc-manager')).toBe(false);

      // Import backup
      const success = StorageService.importBackup(backupStr);
      expect(success).toBe(true);

      expect(StorageService.isUserDeleted('u-qc-manager')).toBe(true);
      expect(StorageService.isTeamMemberDeleted('tm-backup-1')).toBe(true);
      expect(StorageService.getUsers().some((u) => u.id === 'u-qc-manager')).toBe(false);
    });
  });
});
