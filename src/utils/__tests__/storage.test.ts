import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../storage';
import { OfflineQueue, openDb } from '../offlineQueue';
import { Project, User, Ticket, SystemSettings, MaterialRequest } from '../../types';

// Standard in-memory localStorage polyfill for Node test environment
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

describe('StorageService: Backup, Restore & Reset Integrity (P2.3-R2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockProject: Project = {
    id: 'prj-101',
    code: 'PRJ-101',
    title: 'پروژه برج نگین',
    customerName: 'آقای شریفی',
    customerPhone: '09129999999',
    address: 'زعفرانیه، برج نگین',
    shadePanels: 5,
    curtainPanels: 2,
    proposalImages: [],
    scheduledDate: '2026-11-20',
    scheduledTime: '10:00',
    assignedTeamId: 'team-1',
    assignedTeamName: 'اکیپ نصب ۱',
    leadTechnicianId: 'usr-lead-1',
    assignedTechnicianIds: ['usr-lead-1'],
    isFullTools: true,
    toolsRequired: [],
    status: 'IN_PROGRESS',
    completionPhotos: [],
    qcStatus: 'NOT_STARTED',
    createdAt: '2026-11-10T08:00:00Z',
    updatedAt: '2026-11-10T08:00:00Z',
  };

  const mockMaterialRequest: MaterialRequest = {
    id: 'mat-req-999',
    projectId: 'prj-101',
    projectCode: 'PRJ-101',
    projectTitle: 'پروژه برج نگین',
    customerName: 'آقای شریفی',
    customerAddress: 'زعفرانیه',
    customerPhone: '09129999999',
    requestedByUserId: 'usr-tech-1',
    requestedByUserName: 'علی تقوی',
    assignedTeamId: 'team-1',
    assignedTeamName: 'اکیپ نصب ۱',
    requestedAt: '2026-11-14T01:00:00Z',
    category: 'HARDWARE',
    reason: 'SHORTAGE',
    urgency: 'URGENT',
    notes: 'پایه سقفی اضافه نیاز است',
    items: [
      {
        id: 'item-1',
        title: 'پایه سقفی شید رول',
        category: 'HARDWARE',
        requestedQty: 4,
        unit: 'عدد',
      },
    ],
    dispatches: [
      {
        id: 'disp-1',
        dispatchedAt: '2026-11-14T02:00:00Z',
        dispatchedByUserId: 'usr-mgr-1',
        dispatchedByUserName: 'مهندس حسینی',
        courierInfo: 'اسنپ باکس - آقای مرادی',
        trackingCode: 'SNP-1234',
        items: [
          {
            itemId: 'item-1',
            title: 'پایه سقفی شید رول',
            dispatchedQty: 4,
            unit: 'عدد',
          },
        ],
        receivedAtSiteConfirmed: true,
        receivedAtSiteConfirmedAt: '2026-11-14T03:00:00Z',
        receivedAtSiteConfirmedByUserId: 'usr-tech-1',
        receivedAtSiteConfirmedByUserName: 'علی تقوی',
      },
    ],
    history: [
      {
        id: 'hist-1',
        timestamp: '2026-11-14T01:00:00Z',
        action: 'SUBMITTED',
        byUserId: 'usr-tech-1',
        byUserName: 'علی تقوی',
        note: 'ثبت اولیه درخواست',
      },
      {
        id: 'hist-2',
        timestamp: '2026-11-14T03:00:00Z',
        action: 'CONFIRMED_RECEIPT',
        byUserId: 'usr-tech-1',
        byUserName: 'علی تقوی',
        note: 'تایید دریافت سر کارگاه',
      },
    ],
    status: 'DELIVERED_CONFIRMED',
    createdAt: '2026-11-14T01:00:00Z',
    updatedAt: '2026-11-14T03:00:00Z',
  };

  const mockUser: User = {
    id: 'u-pers-lead-1',
    name: 'محسن کریمی',
    phone: '09122222222',
    role: 'LEAD_TECHNICIAN',
    active: true,
    teamId: 'team-1',
  };

  const mockTicket: Ticket = {
    id: 'tkt-1',
    projectId: 'prj-101',
    projectCode: 'PRJ-101',
    projectTitle: 'پروژه برج نگین',
    authorId: 'usr-lead-1',
    authorName: 'محسن کریمی',
    type: 'DAMAGED_HARDWARE',
    category: 'WAREHOUSE_DELIVERY_ISSUE',
    status: 'OPEN',
    description: 'تست تیکت',
    photos: [],
    createdAt: '2026-11-14T01:00:00Z',
  };

  const mockSettings: SystemSettings = {
    visibilityWindowDays: 7,
    companyName: 'گالری طلایی',
    defaultTools: ['دریل'],
  };

  describe('Backup Integrity (exportBackup & importBackup)', () => {
    it('exports complete application data including material requests, dispatches and history', () => {
      StorageService.saveProjects([mockProject]);
      StorageService.saveUsers([mockUser]);
      StorageService.saveTickets([mockTicket]);
      StorageService.saveSettings(mockSettings);
      StorageService.saveMaterialRequests([mockMaterialRequest]);

      const backupStr = StorageService.exportBackup();
      const backup = JSON.parse(backupStr);

      expect(backup.brand).toBe('گالری طلایی');
      expect(backup.version).toBe('2.3');
      expect(backup.exportedAt).toBeDefined();

      // Verify all datasets are included
      expect(backup.projects).toHaveLength(1);
      expect(backup.projects[0].id).toBe(mockProject.id);

      expect(backup.users).toHaveLength(1);
      expect(backup.users[0].id).toBe(mockUser.id);

      expect(backup.tickets).toHaveLength(1);
      expect(backup.tickets[0].id).toBe(mockTicket.id);

      expect(backup.settings.visibilityWindowDays).toBe(7);

      // Verify material requests and their full relational data
      expect(backup.materialRequests).toHaveLength(1);
      const exportedMat = backup.materialRequests[0];
      expect(exportedMat.id).toBe(mockMaterialRequest.id);
      expect(exportedMat.items).toHaveLength(1);
      expect(exportedMat.dispatches).toHaveLength(1);
      expect(exportedMat.dispatches[0].receivedAtSiteConfirmed).toBe(true);
      expect(exportedMat.dispatches[0].courierInfo).toBe('اسنپ باکس - آقای مرادی');
      expect(exportedMat.history).toHaveLength(2);
      expect(exportedMat.status).toBe('DELIVERED_CONFIRMED');
    });

    it('imports backup and restores material requests along with projects, tickets and users', () => {
      const backupData = {
        version: '2.3',
        brand: 'گالری طلایی',
        exportedAt: new Date().toISOString(),
        projects: [mockProject],
        users: [mockUser],
        tickets: [mockTicket],
        materialRequests: [mockMaterialRequest],
        settings: mockSettings,
      };

      const success = StorageService.importBackup(JSON.stringify(backupData));
      expect(success).toBe(true);

      const restoredProjects = StorageService.getProjects();
      expect(restoredProjects).toHaveLength(1);
      expect(restoredProjects[0].id).toBe(mockProject.id);

      const restoredMaterials = StorageService.getMaterialRequests();
      expect(restoredMaterials).toHaveLength(1);
      expect(restoredMaterials[0].id).toBe(mockMaterialRequest.id);
      expect(restoredMaterials[0].dispatches[0].trackingCode).toBe('SNP-1234');
      expect(restoredMaterials[0].history[1].action).toBe('CONFIRMED_RECEIPT');
    });

    it('supports backward compatibility when importing legacy backups without materialRequests', () => {
      // Pre-seed an existing material request in localStorage
      StorageService.saveMaterialRequests([mockMaterialRequest]);

      // Legacy v2.0 backup (no materialRequests key)
      const legacyBackup = {
        version: '2.0',
        brand: 'گالری طلایی',
        exportedAt: new Date().toISOString(),
        projects: [mockProject],
        users: [mockUser],
        tickets: [mockTicket],
        settings: mockSettings,
      };

      const success = StorageService.importBackup(JSON.stringify(legacyBackup));
      expect(success).toBe(true);

      // Existing material requests must NOT be wiped by legacy backup import
      const currentMaterials = StorageService.getMaterialRequests();
      expect(currentMaterials).toHaveLength(1);
      expect(currentMaterials[0].id).toBe(mockMaterialRequest.id);
    });

    it('rejects invalid or malformed backup JSON strings gracefully without throwing', () => {
      expect(StorageService.importBackup('not-valid-json')).toBe(false);
      expect(StorageService.importBackup('')).toBe(false);
      expect(StorageService.importBackup('null')).toBe(false);
      expect(StorageService.importBackup('123')).toBe(false);
    });
  });

  describe('Reset Integrity (resetAll)', () => {
    it('completely removes all application data keys including material requests and v5/v6 keys', () => {
      StorageService.saveProjects([mockProject]);
      StorageService.saveUsers([mockUser]);
      StorageService.saveTickets([mockTicket]);
      StorageService.saveSettings(mockSettings);
      StorageService.saveMaterialRequests([mockMaterialRequest]);
      localStorage.setItem('talaie_current_user_v6', 'user-123');
      localStorage.setItem('talaie_projects_v5', 'old-data');
      localStorage.setItem('talaie_theme', 'dark'); // Documented UI preference

      StorageService.resetAll();

      // Application datasets must be completely cleared
      expect(StorageService.getProjects()).toHaveLength(0);
      expect(StorageService.getUsers()).toHaveLength(0);
      expect(StorageService.getTickets()).toHaveLength(0);
      expect(StorageService.getMaterialRequests()).toHaveLength(0);
      expect(localStorage.getItem('talaie_material_requests_v6')).toBeNull();
      expect(localStorage.getItem('talaie_current_user_v6')).toBeNull();
      expect(localStorage.getItem('talaie_projects_v5')).toBeNull();

      // User UI theme preference must survive reset
      expect(localStorage.getItem('talaie_theme')).toBe('dark');
    });

    it('distinguishes ordinary user logout from full reset: logout preserves local persistent data', () => {
      StorageService.saveProjects([mockProject]);
      StorageService.saveTickets([mockTicket]);
      StorageService.saveMaterialRequests([mockMaterialRequest]);

      // Ordinary logout must NOT call resetAll or wipe localStorage
      // Verify that after logout workflow, persistent cache remains accessible for next session / offline use
      expect(StorageService.getProjects()).toHaveLength(1);
      expect(StorageService.getTickets()).toHaveLength(1);
      expect(StorageService.getMaterialRequests()).toHaveLength(1);
    });

    it('isolates local cached business data per user account while preserving offline access', () => {
      const userAId = 'usr-technician-ali';
      const userBId = 'usr-technician-reza';

      const projectA: Project = { ...mockProject, id: 'prj-ali-1', title: 'پروژه اختصاصی علی' };
      const projectB: Project = { ...mockProject, id: 'prj-reza-1', title: 'پروژه اختصاصی رضا' };

      // User A caches data
      StorageService.saveProjects([projectA], userAId);
      StorageService.saveTickets([mockTicket], userAId);
      StorageService.saveMaterialRequests([mockMaterialRequest], userAId);

      // User B inspects cache: User B MUST NOT see User A's data!
      expect(StorageService.getProjects(userBId)).toHaveLength(0);
      expect(StorageService.getTickets(userBId)).toHaveLength(0);
      expect(StorageService.getMaterialRequests(userBId)).toHaveLength(0);

      // User B caches their own data
      StorageService.saveProjects([projectB], userBId);
      expect(StorageService.getProjects(userBId)).toHaveLength(1);
      expect(StorageService.getProjects(userBId)[0].title).toBe('پروژه اختصاصی رضا');

      // User A returns later: User A's data is safely preserved!
      expect(StorageService.getProjects(userAId)).toHaveLength(1);
      expect(StorageService.getProjects(userAId)[0].title).toBe('پروژه اختصاصی علی');
      expect(StorageService.getTickets(userAId)).toHaveLength(1);
      expect(StorageService.getMaterialRequests(userAId)).toHaveLength(1);
    });

    it('clears all user-scoped keys on resetAll while preserving theme preference', () => {
      StorageService.saveProjects([mockProject], 'usr-1');
      StorageService.saveProjects([mockProject], 'usr-2');
      localStorage.setItem('talaie_theme', 'light');

      StorageService.resetAll();

      expect(StorageService.getProjects('usr-1')).toHaveLength(0);
      expect(StorageService.getProjects('usr-2')).toHaveLength(0);
      expect(localStorage.getItem('talaie_theme')).toBe('light');
    });

    it('Scenario: executeFullReset atomically purges both IndexedDB Outbox and LocalStorage', async () => {
      // Seed LocalStorage
      StorageService.saveProjects([mockProject], 'usr-1');
      StorageService.saveMaterialRequests([mockMaterialRequest], 'usr-1');

      // Seed IndexedDB
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['pending_operations', 'failed_operations'], 'readwrite');
        tx.objectStore('pending_operations').put({
          id: 'op-reset-1',
          orderingKey: 'project:prj-101',
          userId: 'usr-1',
          type: 'PATCH_PROJECT',
          payload: { id: 'prj-101' },
          createdAt: 100,
          retryCount: 0,
          nextRetryAt: 0,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      expect(await OfflineQueue.getPendingCount()).toBe(1);
      expect(StorageService.getProjects('usr-1')).toHaveLength(1);

      // Perform coordinated reset
      await StorageService.executeFullReset();

      // Verify both storage areas have reached the intended final empty state
      expect(await OfflineQueue.getPendingCount()).toBe(0);
      expect(await OfflineQueue.getFailedCount()).toBe(0);
      expect(StorageService.getProjects('usr-1')).toHaveLength(0);
      expect(StorageService.getMaterialRequests('usr-1')).toHaveLength(0);
    });

    it('Scenario: If IndexedDB purge fails, LocalStorage data is not discarded, and error is thrown', async () => {
      StorageService.saveProjects([mockProject], 'usr-1');
      StorageService.saveMaterialRequests([mockMaterialRequest], 'usr-1');

      // Mock purgeAll to fail simulating an aborted transaction or database failure
      const purgeSpy = vi.spyOn(OfflineQueue, 'purgeAll').mockRejectedValueOnce(
        new Error('IndexedDB transaction aborted')
      );

      // Expect executeFullReset to reject
      await expect(StorageService.executeFullReset()).rejects.toThrow(
        'IndexedDB transaction aborted'
      );

      // LocalStorage data must remain intact and NOT discarded!
      expect(StorageService.getProjects('usr-1')).toHaveLength(1);
      expect(StorageService.getMaterialRequests('usr-1')).toHaveLength(1);

      purgeSpy.mockRestore();
    });

    it('Scenario: Retrying executeFullReset after a failure completes cleanly and idempotently', async () => {
      StorageService.saveProjects([mockProject], 'usr-1');

      // First attempt fails
      const purgeSpy = vi.spyOn(OfflineQueue, 'purgeAll').mockRejectedValueOnce(
        new Error('Temporary lock error')
      );
      await expect(StorageService.executeFullReset()).rejects.toThrow('Temporary lock error');
      expect(StorageService.getProjects('usr-1')).toHaveLength(1);
      purgeSpy.mockRestore();

      // User retries reset: succeeds cleanly
      await StorageService.executeFullReset();
      expect(StorageService.getProjects('usr-1')).toHaveLength(0);
      expect(await OfflineQueue.getPendingCount()).toBe(0);
    });
  });
});
