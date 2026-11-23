import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Project,
  User,
  Ticket,
  SystemSettings,
  HandoverChecklist,
  SiteReadinessInspection,
  PersonnelEvaluation,
  StuckIncident,
  DailyLog,
  DailyActivityProgress,
  InstallationTeam,
  TeamMember,
  InstallationTeamWithMembers,
  ScheduleChangeRequest,
  MaterialRequest,
  CustomerAcceptanceRecord,
  ProjectTechnicalHandover,
  UserRole,
} from './types';
import { StorageService } from './utils/storage';
import { TEST_USERS, DEFAULT_TEAMS, DEFAULT_TEAM_MEMBERS } from './utils/testUsers';
import { SupabaseSyncService } from './utils/supabase';
import { startSalesBookingSync } from './utils/salesBookingSync';
import { setSalesCapacityConfig } from './utils/salesCapacity';
import { mergeUsersList } from './utils/userMerge';
import { getUserRoleLabel } from './utils/roleLabels';
import { buildWarehouseReferralTicket } from './utils/ticketFactory';
import { defaultTeamName, nextTeamCode } from './utils/teamNaming';
import { getIncompleteActivitiesSummary } from './utils/planProgress';
import { buildActionQueue } from './utils/actionQueue';
import { useNotificationWatcher } from './hooks/useNotificationWatcher';
import { NOTIFICATION_OPEN_TAB_EVENT, markLocalChange } from './utils/notifications';
import { NotificationPrompt } from './components/layout/NotificationBell';
import { useTheme } from './hooks/useTheme';
import { useLatestRef } from './hooks/useLatestRef';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { SplashScreen } from './components/layout/SplashScreen';
import { ImpersonationBanner } from './components/layout/ImpersonationBanner';
import { computeNavCounts } from './utils/navCounts';
import { Outbox, OutboxMutation, OfflineQueue } from './utils/offlineQueue';
import {
  validateProjectPatchRoleGuards,
  validateTicketRoleGuards,
  validateEvaluationRoleGuards,
  validateProjectDeleteRoleGuards,
  isValidStatusTransition,
} from './utils/roleGuards';
import {
  createConfirmTransferReceiptPayload,
  createManagerOverrideTransferPayload,
  getLatestTeamTransfer,
  isTransferResolved,
} from './utils/teamTransfer';
import {
  createConfirmReceiptPayload,
  canCreateMaterialRequest,
  canConfirmMaterialReceipt,
} from './utils/materialRequests';
import { createDefectResolutionPayload } from './utils/qcWorkflow';
import { getDisplayName } from './utils/technicianName';
import { localDateKey, toPersianDigits } from './utils/jalali';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { TechnicianDashboard } from './components/technician/TechnicianDashboard';
import { Toast, ToastMessage, TOAST_EVENT } from './components/Toast';
import { Sidebar } from './components/navigation/Sidebar';
import { BottomNav, ManagerTab } from './components/navigation/BottomNav';
import { DashboardSkeleton } from './components/ui/DashboardSkeleton';
import type { ProjectFormSaveData } from './components/admin/ProjectFormModal';

import {
  OperationsControlCenter,
  MonthPlanner,
  QcDesk,
  TicketCenter,
  MaterialCenter,
  TechniciansManager,
  SettingsView,
  StuckProjectsDesk,
  PreInstallationModal,
  PersonnelEvaluationModal,
  FailedOperationsModal,
  PendingOperationsModal,
  CeoMasterRegistry,
  ProjectDossierModal,
  ProjectPassportPrint,
  MeasurementDashboard,
  SalesPortal,
  ProjectFormModal,
  ProposalViewerModal,
  TicketModal,
  MaterialRequestModal,
  ToolChecklistDrawer,
  ReportCompletionModal,
  HandoverCertificateModal,
  ReportStuckModal,
  DailyLogModal,
  ProjectManagerSheet,
} from './app/lazyScreens';

// Re-exported for backward compatibility (tests import it from App)
export { getUserRoleLabel } from './utils/roleLabels';

export const App: React.FC = () => {
  // Session & Authentication via Supabase Auth
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [isSyncedWithServer, setIsSyncedWithServer] = useState<boolean>(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [failedQueueCount, setFailedQueueCount] = useState<number>(0);
  const [isFailedOpsModalOpen, setIsFailedOpsModalOpen] = useState<boolean>(false);
  const [isPendingOpsModalOpen, setIsPendingOpsModalOpen] = useState<boolean>(false);

  // CEO Impersonation Mode (ورود و بازرسی پنل پرسنل توسط مدیرعامل)
  const [impersonatorCeo, setImpersonatorCeo] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('talaie_impersonator_ceo');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [users, setUsers] = useState<User[]>(() => {
    const stored = StorageService.getUsers();
    const deletedIds = StorageService.getDeletedUserIds();

    // Ensure all official TEST_USERS are present on all devices
    const userMap = new Map<string, User>();
    for (const tu of TEST_USERS) {
      if (!deletedIds.has(tu.id)) {
        userMap.set(tu.id, { ...tu });
      }
    }

    for (const su of stored) {
      if (!su || !su.id || deletedIds.has(su.id)) continue;
      const official = userMap.get(su.id);
      if (official) {
        // Keep official role, phone, and identity; preserve active status
        userMap.set(su.id, {
          ...official,
          active: su.active !== undefined ? su.active : official.active,
        });
      } else {
        // Custom user created by admin
        userMap.set(su.id, su);
      }
    }

    const unifiedUsers = Array.from(userMap.values());
    StorageService.saveUsers(unifiedUsers);
    StorageService.markInitialized(true);
    return unifiedUsers;
  });

  const [teams, setTeams] = useState<InstallationTeam[]>(() => {
    const stored = StorageService.getTeams();
    const teamMap = new Map<string, InstallationTeam>();
    for (const dt of DEFAULT_TEAMS) {
      teamMap.set(dt.id, { ...dt });
    }
    for (const st of stored) {
      if (!st || !st.id) continue;
      const def = teamMap.get(st.id);
      teamMap.set(st.id, {
        ...(def || {}),
        ...st,
        name: st.name || (def ? def.name : st.code),
        supervisorId: st.supervisorId || (def ? def.supervisorId : undefined),
        supervisorName: st.supervisorName || (def ? def.supervisorName : undefined),
      });
    }
    const unifiedTeams = Array.from(teamMap.values());
    StorageService.saveTeams(unifiedTeams);
    return unifiedTeams;
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const stored = StorageService.getTeamMembers();
    const deletedMemberIds = StorageService.getDeletedTeamMemberIds();
    const deletedUserIds = StorageService.getDeletedUserIds();

    const memberMap = new Map<string, TeamMember>();
    for (const dm of DEFAULT_TEAM_MEMBERS) {
      if (!deletedMemberIds.has(dm.id) && !deletedUserIds.has(dm.userId)) {
        memberMap.set(dm.id, { ...dm });
      }
    }
    for (const sm of stored) {
      if (!sm || !sm.id || deletedMemberIds.has(sm.id) || deletedUserIds.has(sm.userId)) continue;
      memberMap.set(sm.id, sm);
    }
    const unifiedMembers = Array.from(memberMap.values());
    StorageService.saveTeamMembers(unifiedMembers);
    return unifiedMembers;
  });
  const [projects, setProjects] = useState<Project[]>(() => StorageService.getProjects());
  const [tickets, setTickets] = useState<Ticket[]>(() => StorageService.getTickets());
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(() => StorageService.getSettings());
  const [scheduleChangeRequests, setScheduleChangeRequests] = useState<ScheduleChangeRequest[]>([]);

  // Fast offline restore of user-scoped cached data when user session is active
  useEffect(() => {
    if (currentUser?.id) {
      const cachedProjects = StorageService.getProjects(currentUser.id);
      const cachedTickets = StorageService.getTickets(currentUser.id);
      const cachedMaterials = StorageService.getMaterialRequests(currentUser.id);
      if (cachedProjects.length > 0) {
        setProjects(cachedProjects);
        projectsRef.current = cachedProjects;
      }
      if (cachedTickets.length > 0) {
        setTickets(cachedTickets);
      }
      if (cachedMaterials.length > 0) {
        setMaterialRequests(cachedMaterials);
      }
    }
  }, [currentUser?.id]);

  const teamsWithMembers: InstallationTeamWithMembers[] = useMemo(() => {
    return teams.map((team) => {
      const leadMember = teamMembers.find((m) => m.teamId === team.id && m.roleInTeam === 'LEAD');
      const supervisor = leadMember
        ? users.find((u) => u.id === leadMember.userId)
        : team.supervisorId
        ? users.find((u) => u.id === team.supervisorId)
        : undefined;
      const supervisorDisplayName = supervisor ? getDisplayName(supervisor.name) : undefined;
      const dynamicName = supervisorDisplayName
        ? `اکیپ نصب ${supervisorDisplayName}`
        : team.name;
      const techMembers = teamMembers.filter((m) => m.teamId === team.id && m.roleInTeam === 'TECHNICIAN');
      const technicians = techMembers
        .map((m) => users.find((u) => u.id === m.userId))
        .filter(Boolean) as User[];
      return {
        ...team,
        name: dynamicName,
        supervisor,
        supervisorName: supervisorDisplayName,
        technicians,
        totalMembers: (supervisor ? 1 : 0) + technicians.length,
      };
    });
  }, [teams, teamMembers, users]);

  // Keep a synchronous ref of projects for predictable state updates in handlers
  const projectsRef = useLatestRef(projects);

  // Real warehouse person for auto-referred tickets (previously a hardcoded placeholder user id)
  const warehouseAssignee = useMemo(
    () => users.find((u) => u.role === 'WAREHOUSE' && u.active !== false) || null,
    [users]
  );

  // Synchronous ref of tickets (used by handlers that append tickets after async commits)
  const ticketsRef = useLatestRef(tickets);

  const materialRequestsRef = useLatestRef(materialRequests);

  // Request sequence tracker to drop stale server responses
  const fetchSeqRef = useRef<number>(0);
  const sessionEpochRef = useRef<number>(1);
  const isSyncedWithServerRef = useRef<boolean>(false);
  useEffect(() => {
    isSyncedWithServerRef.current = isSyncedWithServer;
  }, [isSyncedWithServer]);

  // Subscribe to user-scoped offline operations queue counts
  useEffect(() => {
    if (!currentUser?.id) {
      setPendingQueueCount(0);
      setFailedQueueCount(0);
      return;
    }
    const uid = currentUser.id;
    OfflineQueue.getPendingCount(uid).then(setPendingQueueCount);
    OfflineQueue.getFailedCount(uid).then(setFailedQueueCount);

    const unsubPending = OfflineQueue.subscribePendingCount(() => {
      OfflineQueue.getPendingCount(uid).then(setPendingQueueCount);
    });
    const unsubFailed = OfflineQueue.subscribeFailedCount(() => {
      OfflineQueue.getFailedCount(uid).then(setFailedQueueCount);
    });
    return () => {
      unsubPending();
      unsubFailed();
    };
  }, [currentUser?.id]);

  // Check Supabase Auth session on initial load and listen to auth changes
  useEffect(() => {
    SupabaseSyncService.getCurrentSessionUser()
      .then((user) => {
        setCurrentUser(user);
      })
      .finally(() => {
        setAuthChecking(false);
      });

    const unsubscribeAuth = SupabaseSyncService.onAuthStateChange((user) => {
      setCurrentUser((prevUser) => {
        if (prevUser?.id !== user?.id) {
          sessionEpochRef.current++;
        }
        return user;
      });
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Fetch data & subscriptions strictly tied to currentUser?.id (runs after login, disconnects on logout)
  useEffect(() => {
    // Never run or clear cache while checking initial auth session
    if (authChecking) {
      return;
    }

    if (!currentUser?.id) {
      setIsSyncedWithServer(false);
      setIsOfflineMode(false);
      return;
    }

    const capturedEpoch = sessionEpochRef.current;
    const capturedUserId = currentUser.id;

    setIsSyncedWithServer(false);

    // 1. Fetch initial server data after login
    const loadCloudData = async () => {
      const client = SupabaseSyncService.getClient();
      if (!client) {
        setIsSyncedWithServer(true);
        setIsOfflineMode(false);
        return;
      }
      const currentSeq = ++fetchSeqRef.current;
      try {
        const [cloudProjects, cloudTickets, cloudUsers, cloudSettings, cloudTeams, cloudTeamMembers, cloudScheduleChanges, cloudMaterials] = await Promise.all([
          SupabaseSyncService.fetchProjects(),
          SupabaseSyncService.fetchTickets(),
          SupabaseSyncService.fetchProfiles().catch(() => []),
          SupabaseSyncService.fetchSettings().catch(() => null),
          SupabaseSyncService.fetchInstallationTeams().catch(() => []),
          SupabaseSyncService.fetchTeamMembers().catch(() => []),
          SupabaseSyncService.fetchScheduleChangeRequests().catch(() => []),
          SupabaseSyncService.fetchMaterialRequests().catch(() => []),
        ]);

        if (currentSeq !== fetchSeqRef.current || sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;

        // Base material requests: prefer cloud materials if available, merged with local cache
        const localMaterials = StorageService.getMaterialRequests(currentUser.id);
        const baseMaterials = (cloudMaterials && cloudMaterials.length > 0)
          ? [
              ...cloudMaterials,
              ...localMaterials.filter((lm) => !cloudMaterials.some((cm) => cm.id === lm.id)),
            ]
          : localMaterials;

        // Merge any pending outbox operations for current user so unsent local mutations don't vanish
        const mergedProjects = await Outbox.applyPendingToProjects(cloudProjects, undefined, currentUser.id);
        const mergedTickets = await Outbox.applyPendingToTickets(cloudTickets, undefined, currentUser.id);
        const mergedMaterialRequests = await Outbox.applyPendingToMaterialRequests(
          baseMaterials,
          undefined,
          currentUser.id
        );
        const mergedSettings = cloudSettings
          ? await Outbox.applyPendingToSettings(cloudSettings)
          : undefined;

        if (currentSeq !== fetchSeqRef.current || sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;

        setProjects(mergedProjects);
        projectsRef.current = mergedProjects;
        setTickets(mergedTickets);
        setMaterialRequests(mergedMaterialRequests);
        if (cloudUsers && cloudUsers.length > 0) {
          setUsers((prevUsers) => {
            const current = prevUsers.length > 0 ? prevUsers : StorageService.getUsers();
            const fallback = StorageService.isInitialized() ? [] : TEST_USERS;
            const merged = mergeUsersList(current.length > 0 ? current : fallback, cloudUsers);
            StorageService.saveUsers(merged);
            return merged;
          });
        }
        if (cloudTeams && cloudTeams.length > 0) {
          setTeams(cloudTeams);
          StorageService.saveTeams(cloudTeams);
        }
        if (cloudTeamMembers && cloudTeamMembers.length > 0) {
          const deletedMemberIds = StorageService.getDeletedTeamMemberIds();
          const deletedUserIds = StorageService.getDeletedUserIds();
          const filteredMembers = cloudTeamMembers.filter(
            (m) => !deletedMemberIds.has(m.id) && (!m.userId || !deletedUserIds.has(m.userId))
          );
          setTeamMembers(filteredMembers);
          StorageService.saveTeamMembers(filteredMembers);
        }
        if (cloudScheduleChanges && cloudScheduleChanges.length >= 0) {
          setScheduleChangeRequests(cloudScheduleChanges);
        }
        if (mergedSettings) {
          setSettings((prev) => ({ ...prev, ...mergedSettings }));
        }
        setIsSyncedWithServer(true);
        setIsOfflineMode(false);

        // Attempt processing any pending offline operations
        SupabaseSyncService.processOfflineQueue(currentUser.id, () => sessionEpochRef.current);
      } catch (err) {
        if (currentSeq !== fetchSeqRef.current || sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
        console.warn('Initial cloud fetch error (running in offline mode with cached data):', err);
        // Retain existing cached projects & tickets in state
        setIsSyncedWithServer(false);
        setIsOfflineMode(true);
      }
    };

    loadCloudData();

    // On slow/filtered connections the initial fetch can hang for a long time. Instead of showing
    // "syncing…" forever, switch to the honest offline banner after a while; a later successful
    // fetch flips it back automatically.
    const slowSyncTimer = window.setTimeout(() => {
      if (sessionEpochRef.current !== capturedEpoch) return;
      if (!isSyncedWithServerRef.current) setIsOfflineMode(true);
    }, 15000);

    // Re-try fetching cloud data on online event and trigger offline sync
    const handleOnline = () => {
      if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
      loadCloudData();
      SupabaseSyncService.processOfflineQueue(currentUser?.id, () => sessionEpochRef.current);
    };
    window.addEventListener('online', handleOnline);

    const handleSyncTrigger = () => {
      if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
      SupabaseSyncService.processOfflineQueue(currentUser?.id, () => sessionEpochRef.current);
    };
    window.addEventListener('talaie-trigger-offline-sync', handleSyncTrigger);

    const handleLeaseReleased = () => {
      if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
      SupabaseSyncService.processOfflineQueue(currentUser?.id, () => sessionEpochRef.current);
    };
    window.addEventListener('talaie-queue-lease-released', handleLeaseReleased);

    // Polling every 30s ONLY when desynced or offline
    const intervalId = setInterval(() => {
      if (!isSyncedWithServerRef.current || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          loadCloudData();
        }
      }
    }, 30000);

    // 2. Realtime row-by-row subscriptions
    const unsubProjects = SupabaseSyncService.subscribeProjects({
      onInsert: (newProject) => {
        if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
        setProjects((prev) => {
          if (prev.some((p) => p.id === newProject.id)) return prev;
          const next = [newProject, ...prev];
          projectsRef.current = next;
          return next;
        });
      },
      onUpdate: async (cloudProject) => {
        if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
        // Our own unsent edits are re-applied on top of the server row. The old rule
        // ("ignore the server if my copy has a later timestamp") compared clocks of two
        // different phones, so a phone whose clock ran ahead stopped receiving updates.
        let updatedProject = cloudProject;
        try {
          const [merged] = await Outbox.applyPendingToProjects([cloudProject], undefined, capturedUserId);
          if (merged) updatedProject = merged;
        } catch {
          // no outbox available: use the server row as-is
        }
        if (sessionEpochRef.current !== capturedEpoch) return;
        setProjects((prev) => {
          const exists = prev.some((p) => p.id === updatedProject.id);
          const next = exists
            ? prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
            : [updatedProject, ...prev];
          projectsRef.current = next;
          return next;
        });
      },
      onDelete: (deletedId) => {
        if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
        setProjects((prev) => {
          const next = prev.filter((p) => p.id !== deletedId);
          projectsRef.current = next;
          return next;
        });
      },
    });

    const unsubTickets = SupabaseSyncService.subscribeTickets({
      onInsert: (newTicket) => {
        if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
        setTickets((prev) => {
          if (prev.some((t) => t.id === newTicket.id)) return prev;
          return [newTicket, ...prev];
        });
      },
      onUpdate: (updatedTicket) => {
        if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
        // a ticket this device didn't have yet (e.g. created while it was offline) is added, not dropped
        setTickets((prev) =>
          prev.some((t) => t.id === updatedTicket.id)
            ? prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
            : [updatedTicket, ...prev],
        );
      },
      onDelete: (deletedId) => {
        if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
        setTickets((prev) => prev.filter((t) => t.id !== deletedId));
      },
    });

    const unsubSettings = SupabaseSyncService.subscribeSettings((cloudSettings) => {
      if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
      setSettings((prev) => ({ ...prev, ...cloudSettings }));
    });

    const unsubProfiles = SupabaseSyncService.subscribeProfiles((updatedProfiles) => {
      if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
      if (updatedProfiles && updatedProfiles.length > 0) {
        setUsers((prevUsers) => {
          const merged = mergeUsersList(prevUsers, updatedProfiles);
          StorageService.saveUsers(merged);
          return merged;
        });
        setCurrentUser((prevUser) => {
          if (!prevUser) return null;
          const currentProfile = updatedProfiles.find((p) => p.id === prevUser.id);
          if (!currentProfile || !currentProfile.active) {
            SupabaseSyncService.signOut();
            return null;
          }
          return { ...prevUser, ...currentProfile };
        });
      }
    });

    const unsubTeams = SupabaseSyncService.subscribeTeams(async () => {
      if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
      try {
        const [t, tm] = await Promise.all([
          SupabaseSyncService.fetchInstallationTeams(),
          SupabaseSyncService.fetchTeamMembers(),
        ]);
        if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
        setTeams(t);
        setTeamMembers(tm);
      } catch (err) {
        console.warn('Realtime teams refresh failed:', err);
      }
    });

    const unsubScheduleChanges = SupabaseSyncService.subscribeScheduleChanges(async () => {
      if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
      try {
        const sc = await SupabaseSyncService.fetchScheduleChangeRequests();
        if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
        setScheduleChangeRequests(sc);
      } catch (err) {
        console.warn('Realtime schedule changes refresh failed:', err);
      }
    });

    const unsubMaterials = SupabaseSyncService.subscribeMaterialRequests(async () => {
      if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
      try {
        const cloud = await SupabaseSyncService.fetchMaterialRequests();
        const merged = await Outbox.applyPendingToMaterialRequests(cloud, undefined, capturedUserId);
        if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
        setMaterialRequests(merged);
      } catch (err) {
        console.warn('Realtime material requests refresh failed:', err);
      }
    });

    // Phones suspend the realtime connection while the app is in the background, so
    // changes made meanwhile were missed until a manual reload. Catch up on return.
    let lastCatchUp = Date.now();
    const handleVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (sessionEpochRef.current !== capturedEpoch || currentUser?.id !== capturedUserId) return;
      if (Date.now() - lastCatchUp < 20000) return;
      lastCatchUp = Date.now();
      loadCloudData();
    };
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      document.removeEventListener('visibilitychange', handleVisible);
      unsubMaterials();
      window.clearTimeout(slowSyncTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('talaie-trigger-offline-sync', handleSyncTrigger);
      window.removeEventListener('talaie-queue-lease-released', handleLeaseReleased);
      clearInterval(intervalId);
      unsubProjects();
      unsubTickets();
      unsubSettings();
      unsubProfiles();
      unsubTeams();
      unsubScheduleChanges();
    };
  }, [currentUser?.id, authChecking]);

  // Sales capacity bookings: sync local cache <-> Supabase so every device sees the same calendar
  useEffect(() => {
    if (!currentUser || authChecking) return;
    if (!['SALES_REP', 'QC_MANAGER', 'CEO', 'SCHEDULING_COORDINATOR'].includes(currentUser.role)) return;
    return startSalesBookingSync();
  }, [currentUser?.id, currentUser?.role, authChecking]);

  // Installation capacity (teams × laths) set by the QC manager drives the sales calendar
  useEffect(() => {
    const teamNames: Record<string, string> = {};
    for (const t of teamsWithMembers) {
      // sales capacity identifies teams as TEAM_1..n, which is the team's code (server ids are uuids)
      const key = t.code || t.id;
      if (key && t.name) teamNames[key] = t.name;
    }
    setSalesCapacityConfig({
      teamCount: settings.installationTeamCount,
      lathsPerTeam: settings.lathsPerTeamPerDay,
      teamNames,
      workingDays: settings.workingDaysPerWeek,
    });
  }, [settings.installationTeamCount, settings.lathsPerTeamPerDay, settings.workingDaysPerWeek, teamsWithMembers]);

  // Navigation tab for QC Manager / Coordinator - default to Operational Command Center ('control')
  const [activeTab, setActiveTab] = useState<ManagerTab>('control');

  // Each section opens at the top (otherwise the previous page's scroll position was kept)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeTab]);

  // Phone notifications: watch every data change for what concerns this person's role
  const notifySnapshot = useMemo(
    () => ({ projects, tickets, materialRequests, scheduleChangeRequests }),
    [projects, tickets, materialRequests, scheduleChangeRequests],
  );
  useNotificationWatcher(notifySnapshot, currentUser, isSyncedWithServer);

  // Tapping a notification (in the bell list or on the phone) opens the related section
  useEffect(() => {
    const open = (e: Event) => {
      const tab = (e as CustomEvent<string>).detail;
      if (tab && currentUser && ['QC_MANAGER', 'SCHEDULING_COORDINATOR'].includes(currentUser.role)) {
        setActiveTab(tab as ManagerTab);
      }
    };
    window.addEventListener(NOTIFICATION_OPEN_TAB_EVENT, open);
    // the app was closed and opened from a notification: ./#tab=qc
    const fromHash = /^#tab=([a-z]+)$/.exec(window.location.hash);
    if (fromHash && currentUser) {
      open(new CustomEvent(NOTIFICATION_OPEN_TAB_EVENT, { detail: fromHash[1] }));
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return () => window.removeEventListener(NOTIFICATION_OPEN_TAB_EVENT, open);
  }, [currentUser]);


  // CEO navigation restriction: CEO only accesses 'registry' (داشبورد مدیر کل) and 'planner' (دیدن برنامه)
  useEffect(() => {
    if (currentUser?.role === 'CEO' && activeTab !== 'registry' && activeTab !== 'planner') {
      setActiveTab('registry');
    }
  }, [currentUser?.role, activeTab]);

  // Theme (dark by default; light only when chosen) — see hooks/useTheme
  const { isDarkMode, toggleTheme: handleToggleDarkMode } = useTheme();

  // Modals
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [presetDateKey, setPresetDateKey] = useState<string | undefined>(undefined);

  // Viewer and action modals
  const [proposalModalProject, setProposalModalProject] = useState<Project | null>(null);
  const [toolChecklistProject, setToolChecklistProject] = useState<Project | null>(null);
  const [ticketModalProject, setTicketModalProject] = useState<Project | null>(null);
  const [materialModalProject, setMaterialModalProject] = useState<Project | null>(null);
  const [completionModalProject, setCompletionModalProject] = useState<Project | null>(null);
  const [certificateModalProject, setCertificateModalProject] = useState<Project | null>(null);
  const [printingPassportProject, setPrintingPassportProject] = useState<Project | null>(null);
  const [preInspectionProject, setPreInspectionProject] = useState<Project | null>(null);
  const [evaluationProject, setEvaluationProject] = useState<Project | null>(null);
  const [stuckModalProject, setStuckModalProject] = useState<Project | null>(null);
  const [dailyLogModalProject, setDailyLogModalProject] = useState<Project | null>(null);
  const [managedProjectId, setManagedProjectId] = useState<string | null>(null);
  const [selectedQcProjectId, setSelectedQcProjectId] = useState<string | null>(null);

  // Modern Toast notification system
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (type: ToastMessage['type'], message: string) => {
    setToast({ type, message });
  };

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ type?: ToastMessage['type']; message?: string }>;
      if (customEvent.detail?.message) {
        showToast(customEvent.detail.type || 'info', customEvent.detail.message);
      }
    };
    window.addEventListener(TOAST_EVENT, handleToastEvent);
    return () => window.removeEventListener(TOAST_EVENT, handleToastEvent);
  }, []);

  // Lightweight local storage caching (scoped to authenticated user session)
  useEffect(() => {
    if (currentUser?.id) {
      StorageService.saveProjects(projects, currentUser.id);
    }
  }, [projects, currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      StorageService.saveTickets(tickets, currentUser.id);
    }
  }, [tickets, currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      StorageService.saveMaterialRequests(materialRequests, currentUser.id);
    }
  }, [materialRequests, currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      StorageService.saveSettings(settings);
    }
  }, [settings, currentUser]);

  useEffect(() => {
    if (StorageService.isInitialized()) {
      StorageService.saveTeams(teams);
    }
  }, [teams]);

  useEffect(() => {
    if (StorageService.isInitialized()) {
      StorageService.saveTeamMembers(teamMembers);
    }
  }, [teamMembers]);

  useEffect(() => {
    if (StorageService.isInitialized()) {
      StorageService.saveUsers(users);
    }
  }, [users]);

  // Unified single write path (Outbox Pattern)
  const commit = async (
    mutation: OutboxMutation,
    onOptimisticApply: () => void
  ): Promise<boolean> => {
    if (!currentUser) return false;

    // Absolute deletion guard: physical deletion of material requests is prohibited to preserve audit trail
    if (mutation.type === 'DELETE_MATERIAL_REQUEST') {
      showToast('error', 'حذف فیزیکی درخواست متریال مجاز نمی‌باشد. لطفاً از فرآیند لغو درخواست استفاده نمایید.');
      return false;
    }

    // Client-side role guards: validate before pushing to outbox
    if (currentUser.role !== 'QC_MANAGER') {
      if (mutation.type === 'PATCH_PROJECT') {
        const projectId = mutation.payload?.id || mutation.orderingKey.replace('project:', '');
        const currentProject = projectsRef.current.find((p) => p.id === projectId);
        if (currentProject) {
          const patch = mutation.payload?.patch || mutation.payload;
          try {
            validateProjectPatchRoleGuards(currentUser, currentProject, patch, currentUser.teamId);
          } catch (err: any) {
            showToast('error', err.message || 'خطای عدم دسترسی نقش.');
            return false;
          }
        }
      } else if (mutation.type === 'CREATE_PROJECT') {
        if (currentUser.role !== 'SCHEDULING_COORDINATOR') {
          showToast('error', 'تنها مدیر ارشد QC یا مسئول هماهنگی مجاز به ثبت پروژه است.');
          return false;
        }
      } else if (mutation.type === 'DELETE_PROJECT') {
        try {
          validateProjectDeleteRoleGuards(currentUser);
        } catch (err: any) {
          showToast('error', err.message || 'دسترسی غیرمجاز: تنها مدیرعامل مجاز به حذف کامل پروژه است.');
          return false;
        }
      } else if (mutation.type === 'APPEND_PROJECT_EVALUATION') {
        try {
          validateEvaluationRoleGuards(currentUser);
        } catch (err: any) {
          showToast('error', err.message || 'خطای عدم دسترسی به ثبت ارزیابی.');
          return false;
        }
      } else if (mutation.type === 'CREATE_TICKET' || mutation.type === 'PATCH_TICKET') {
        const ticket = mutation.payload?.ticket || mutation.payload;
        const project = projectsRef.current.find((p) => p.id === ticket?.projectId);
        try {
          validateTicketRoleGuards(currentUser, project, ticket);
        } catch (err: any) {
          showToast('error', err.message || 'خطای عدم دسترسی به تیکت.');
          return false;
        }
      } else if (mutation.type === 'CREATE_MATERIAL_REQUEST') {
        const req = (mutation.payload?.request || mutation.payload) as MaterialRequest;
        const project = projectsRef.current.find((p) => p.id === req?.projectId);
        if (!canCreateMaterialRequest(currentUser, project)) {
          showToast('error', 'شما دسترسی مجاز برای ثبت درخواست متریال در این پروژه را ندارید.');
          return false;
        }
      } else if (mutation.type === 'PATCH_MATERIAL_REQUEST') {
        // QC_MANAGER is already bypassed above (line 541); SCHEDULING_COORDINATOR is also authorized
        if (currentUser.role !== 'SCHEDULING_COORDINATOR') {
          const reqId = mutation.payload?.id || mutation.orderingKey.replace('material:', '');
          const original = materialRequestsRef.current.find((r) => r.id === reqId);
          const updated = mutation.payload?.patch || mutation.payload;
          const project = projectsRef.current.find((p) => p.id === (updated?.projectId || original?.projectId));

          // If technician is cancelling their own request
          const isCancellation =
            updated?.status === 'CANCELLED' && original?.requestedByUserId === currentUser.id;

          // If technician is confirming receipt of a dispatch
          const isReceiptConfirmation =
            Boolean(project &&
            canConfirmMaterialReceipt(currentUser, project) &&
            updated?.dispatches?.some((d: any, idx: number) => d.receivedAtSiteConfirmed && !original?.dispatches?.[idx]?.receivedAtSiteConfirmed));

          if (!isCancellation && !isReceiptConfirmation) {
            showToast('error', 'تکنسین تنها مجاز به تایید دریافت محموله کارگاه یا لغو درخواست ثبت‌شده خود است.');
            return false;
          }
        }
      }
    }

    // Baseline snapshot capture for PATCH_PROJECT to support lifecycle conflict detection
    if (mutation.type === 'PATCH_PROJECT' && !mutation.baselineSnapshot) {
      const projectId = mutation.payload?.id || mutation.orderingKey.replace('project:', '');
      const currentProject = projectsRef.current.find((p) => p.id === projectId);
      if (currentProject) {
        mutation.baselineSnapshot = {
          projectId,
          status: currentProject.status,
          updatedAt: currentProject.updatedAt,
          customerSignature: currentProject.customerSignature ? 'present' : 'none',
          dailyLogsCount: currentProject.dailyLogs?.length || 0,
          workSessionsCount: currentProject.workSessions?.length || 0,
        };
      }
    }

    try {
      // this device's own change must not come back as a notification
      markLocalChange(mutation.orderingKey);
      await Outbox.commit(mutation, currentUser.id, onOptimisticApply);
      return true;
    } catch (err: any) {
      console.error('Outbox commit error:', err);
      showToast('error', 'خطا در ذخیره‌سازی محلی تغییرات. لطفاً مجدداً تلاش نمایید.');
      throw err;
    }
  };

  // Project handlers
  const handleSaveProject = async (data: ProjectFormSaveData) => {
    if (!currentUser) return;
    // New missions can be queued offline (they have their own id, so nothing can be overwritten).
    // Edits still wait for a server sync to avoid clobbering changes made on other devices.
    const canQueueOffline = data.type === 'CREATE_PROJECT' && isOfflineMode;
    if (!isSyncedWithServer && !canQueueOffline) {
      showToast(
        'warning',
        isOfflineMode
          ? 'ویرایش پروژه‌ها بدون اتصال به سرور ممکن نیست. پس از وصل شدن اینترنت دوباره تلاش کنید.'
          : 'اطلاعات در حال دریافت از سرور است، لطفاً چند لحظه صبر کنید.'
      );
      return;
    }

    if (data.type === 'CREATE_PROJECT') {
      const newProj = data.project;
      await commit(
        {
          type: 'CREATE_PROJECT',
          orderingKey: `project:${newProj.id}`,
          payload: newProj,
        },
        () => {
          const next = [newProj, ...projectsRef.current];
          setProjects(next);
          projectsRef.current = next;
          setIsProjectFormOpen(false);
          setEditingProject(null);
          setProjectFormInitialData(null);
        }
      );
      showToast(
        'success',
        canQueueOffline
          ? 'مأموریت ذخیره شد و پس از اتصال به اینترنت به سرور ارسال می‌شود.'
          : 'پروژه جدید با موفقیت ثبت شد.'
      );
    } else {
      const { id, patch } = data;
      if (Object.keys(patch).length === 0) {
        setIsProjectFormOpen(false);
        setEditingProject(null);
        return;
      }
      const cleanPatch = { ...patch, updatedAt: new Date().toISOString() };
      await commit(
        {
          type: 'PATCH_PROJECT',
          orderingKey: `project:${id}`,
          payload: { id, patch: cleanPatch },
        },
        () => {
          const next = projectsRef.current.map((p) =>
            p.id === id ? { ...p, ...cleanPatch } : p
          );
          setProjects(next);
          projectsRef.current = next;
          setIsProjectFormOpen(false);
          setEditingProject(null);
          setProjectFormInitialData(null);
        }
      );
      showToast('success', 'تغییرات پروژه با موفقیت ذخیره شد.');
    }
  };

  const handlePatchProject = async (projectId: string, patch: Partial<Project>) => {
    if (!currentUser) return;
    const cleanPatch = { ...patch, updatedAt: new Date().toISOString() };
    await commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, patch: cleanPatch },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === projectId ? { ...p, ...cleanPatch } : p
        );
        setProjects(next);
        projectsRef.current = next;
      }
    );
  };

  // ---- Manager / Coordinator control ----
  const handleManagerPatch = async (
    projectId: string,
    patch: Record<string, unknown>,
    successMessage: string
  ) => {
    if (!currentUser || (currentUser.role !== 'QC_MANAGER' && currentUser.role !== 'SCHEDULING_COORDINATOR')) return;
    if (!projectsRef.current.some((p) => p.id === projectId)) {
      showToast('error', 'این پروژه دیگر وجود ندارد.');
      setManagedProjectId(null);
      return;
    }
    const cleanPatch: Record<string, unknown> = { ...patch, updatedAt: new Date().toISOString() };
    const { _auditReason: _reason, ...localPatch } = cleanPatch;
    const ok = await commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, patch: cleanPatch },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === projectId ? ({ ...p, ...localPatch } as Project) : p
        );
        setProjects(next);
        projectsRef.current = next;
      }
    );
    if (ok) showToast('success', successMessage);
  };

  const handleManagerDelete = async (
    projectId: string,
    options: { reason: string; deleteTicketsAndFiles: boolean }
  ) => {
    if (!currentUser) return;
    try {
      validateProjectDeleteRoleGuards(currentUser);
    } catch (err: any) {
      showToast('error', err.message || 'دسترسی غیرمجاز: منحصراً مدیرعامل مجاز به حذف پروژه است.');
      return;
    }
    if (!isSyncedWithServer) {
      showToast('warning', 'اطلاعات در حال دریافت از سرور است، لطفاً شکیبا باشید.');
      return;
    }
    const ok = await commit(
      {
        type: 'DELETE_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, reason: options.reason, deleteTicketsAndFiles: options.deleteTicketsAndFiles },
      },
      () => {
        const next = projectsRef.current.filter((p) => p.id !== projectId);
        setProjects(next);
        projectsRef.current = next;
        if (options.deleteTicketsAndFiles) {
          setTickets((prev) => prev.filter((t) => t.projectId !== projectId));
        }
        setManagedProjectId(null);
      }
    );
    if (ok) showToast('success', 'پروژه به‌طور کامل حذف شد.');
  };

  const handleMoveProjectDate = async (projectId: string, newDateKey: string) => {
    if (!currentUser) return;
    const patch = {
      scheduledDate: newDateKey,
      updatedAt: new Date().toISOString(),
    };

    await commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, patch },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === projectId ? { ...p, ...patch } : p
        );
        setProjects(next);
        projectsRef.current = next;
      }
    );
  };

  const handleProposeScheduleChange = async (
    projectId: string,
    proposedDate: string,
    proposedEndDate?: string,
    proposedTeamId?: string,
    reason?: string
  ) => {
    try {
      await SupabaseSyncService.proposeScheduleChange(
        projectId,
        proposedDate,
        proposedEndDate,
        proposedTeamId,
        reason || ''
      );
      const reqs = await SupabaseSyncService.fetchScheduleChangeRequests();
      setScheduleChangeRequests(reqs);
      showToast('success', 'پیشنهاد جابجایی زمان‌بندی ثبت شد و جهت بررسی به مدیر QC ارسال گردید.');
    } catch (err: any) {
      showToast('error', err.message || 'خطا در ثبت پیشنهاد جابجایی زمان‌بندی.');
      throw err;
    }
  };

  const handleReviewScheduleChange = async (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string
  ) => {
    try {
      await SupabaseSyncService.reviewScheduleChange(requestId, decision, notes || '');
      const [reqs, updatedProjects] = await Promise.all([
        SupabaseSyncService.fetchScheduleChangeRequests(),
        SupabaseSyncService.fetchProjects(),
      ]);
      setScheduleChangeRequests(reqs);
      if (updatedProjects && updatedProjects.length > 0) {
        setProjects(updatedProjects);
        projectsRef.current = updatedProjects;
      }
      showToast(
        decision === 'APPROVED' ? 'success' : 'info',
        decision === 'APPROVED'
          ? 'درخواست جابجایی تایید و زمان‌بندی جدید پروژه اعمال شد.'
          : 'درخواست جابجایی زمان‌بندی رد شد.'
      );
    } catch (err: any) {
      showToast('error', err.message || 'خطا در بررسی درخواست زمان‌بندی.');
      throw err;
    }
  };

  const transitioningLockRef = useRef<Set<string>>(new Set());
  const [inFlightTransitions, setInFlightTransitions] = useState<Set<string>>(new Set());

  const transitionStatus = async (
    projectId: string,
    from: Project['status'],
    to: Project['status']
  ) => {
    if (!currentUser) return;
    if (transitioningLockRef.current.has(projectId)) return;

    const current = projectsRef.current.find((p) => p.id === projectId);
    if (!current) return;

    // Check that current status matches the expected 'from'
    if (current.status !== from) {
      console.warn(`Transition ignored: expected status ${from}, but got ${current.status}`);
      return;
    }

    if (!isValidStatusTransition(from, to)) {
      showToast('error', `انتقال وضعیت از «${from}» به «${to}» مجاز نیست.`);
      return;
    }

    if (['EN_ROUTE', 'IN_PROGRESS'].includes(to)) {
      const latestTransfer = getLatestTeamTransfer(current);
      if (latestTransfer && !isTransferResolved(latestTransfer)) {
        showToast(
          'error',
          'پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه یا رفع انسداد مدیر QC است. تا پیش از ثبت تایید، شروع یا ادامه کار مجاز نیست.'
        );
        return;
      }
    }

    // Acquire lock synchronously before any await
    transitioningLockRef.current.add(projectId);
    setInFlightTransitions((prev) => new Set(prev).add(projectId));

    const patch: Partial<Project> = {
      status: to,
      updatedAt: new Date().toISOString(),
    };
    if (to === 'IN_PROGRESS') {
      if (!current.startedAt) {
        patch.startedAt = new Date().toISOString();
      }
      const existingSessions = current.workSessions || [];
      const hasOpenSession = existingSessions.some((s) => !s.endedAt);
      if (!hasOpenSession) {
        const nowIso = new Date().toISOString();
        const todayKey = localDateKey();
        patch.workSessions = [
          ...existingSessions,
          {
            date: todayKey,
            startedAt: nowIso,
            byUserId: currentUser.id,
            byUserName: currentUser.name,
          },
        ];
      }
    }

    try {
      await commit(
        {
          type: 'PATCH_PROJECT',
          orderingKey: `project:${projectId}`,
          payload: { id: projectId, patch },
        },
        () => {
          const next = projectsRef.current.map((p) =>
            p.id === projectId ? { ...p, ...patch } : p
          );
          setProjects(next);
          projectsRef.current = next;
        }
      );
    } finally {
      transitioningLockRef.current.delete(projectId);
      setInFlightTransitions((prev) => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    }
  };

  // Completion report from field (P1 Task 4)
  const handleReportCompletion = async (completionData: {
    completionNotes: string;
    beforePhotos: string[];
    afterPhotos: string[];
    completionPhotos: string[];
    handoverChecklist: HandoverChecklist;
    handoverSigneeType?: any;
    customerSignature?: string;
    customerSatisfaction?: number;
    representativeName?: string;
    representativeRole?: string;
    representativePhone?: string;
    unavailabilityReason?: string;
    unavailabilityPhotos?: string[];
    isExceptionalCompletion?: boolean;
    exceptionalCompletionDetails?: any;
  }) => {
    if (!completionModalProject || !currentUser) return;
    const projectId = completionModalProject.id;
    const nowIso = new Date().toISOString();

    const existingSessions = completionModalProject.workSessions || [];
    let updatedSessions = existingSessions;
    if (existingSessions.length > 0 && !existingSessions[existingSessions.length - 1].endedAt) {
      updatedSessions = existingSessions.map((s, idx) =>
        idx === existingSessions.length - 1 ? { ...s, endedAt: nowIso } : s
      );
    }

    // «همه اقلام امروز نصب شد»: the remaining units are recorded as today's work,
    // otherwise the card and the dossier keep showing e.g. «0 / 8 لت» for a finished job.
    const remaining = getIncompleteActivitiesSummary(completionModalProject);
    const finalDayLogs: DailyLog[] =
      !completionData.isExceptionalCompletion && remaining.hasIncomplete
        ? [
            {
              id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}`,
              date: localDateKey(),
              activityProgress: remaining.remainingItems.map((item) => ({
                activityId: item.activityId,
                activityTitle: item.title,
                completedQuantity: item.remainingQuantity,
                unit: item.unit,
              })),
              note: 'اتمام کار: نصب اقلام باقیمانده در روز آخر',
              photos: [],
              supervisorConfirmed: true,
              supervisorConfirmedBy: currentUser.name,
              supervisorConfirmedAt: nowIso,
              byUserId: currentUser.id,
              byUserName: currentUser.name,
              createdAt: nowIso,
            },
          ]
        : [];

    const isUnavailable = completionData.handoverSigneeType === 'UNAVAILABLE_EXEMPT';
    const customerAcceptance: CustomerAcceptanceRecord = {
      status: isUnavailable ? 'UNAVAILABLE' : 'ACCEPTED',
      representativeName: completionData.representativeName || undefined,
      representativeRole: completionData.representativeRole || undefined,
      signature: completionData.customerSignature || undefined,
      customerSatisfaction: completionData.customerSatisfaction || undefined,
      unavailabilityReason: completionData.unavailabilityReason || undefined,
      unavailabilityPhotos: completionData.unavailabilityPhotos || undefined,
      acceptedAt: nowIso,
    };

    const patch: Partial<Project> = {
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      completionNotes: completionData.completionNotes,
      beforePhotos: completionData.beforePhotos,
      afterPhotos: completionData.afterPhotos,
      completionPhotos: completionData.completionPhotos,
      handoverChecklist: completionData.handoverChecklist,
      handoverSigneeType: completionData.handoverSigneeType,
      customerSignature: completionData.customerSignature,
      customerSatisfaction: completionData.customerSatisfaction,
      representativeName: completionData.representativeName,
      representativeRole: completionData.representativeRole,
      representativePhone: completionData.representativePhone,
      unavailabilityReason: completionData.unavailabilityReason,
      unavailabilityPhotos: completionData.unavailabilityPhotos,
      isExceptionalCompletion: completionData.isExceptionalCompletion,
      exceptionalCompletionDetails: completionData.exceptionalCompletionDetails,
      customerAcceptance,
      completedAt: nowIso,
      updatedAt: nowIso,
      workSessions: updatedSessions,
      ...(finalDayLogs.length > 0
        ? { dailyLogs: [...(completionModalProject.dailyLogs || []), ...finalDayLogs] }
        : {}),
    };

    await commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, patch },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === projectId ? { ...p, ...patch } : p
        );
        setProjects(next);
        projectsRef.current = next;
        setCompletionModalProject(null);
      }
    );
    showToast('success', 'گزارش اتمام کار با موفقیت ثبت شد و به بررسی QC ارسال گردید.');
  };

  // Daily log (temporary pause for multi-day project - P1 Task 5 & P2.1)
  const handleEndDailyWork = async (data: {
    note?: string;
    photos: string[];
    startTime?: string;
    endTime?: string;
    completedQuantity?: number;
    remainingQuantity?: number;
    quantityUnit?: string;
    activityProgress?: DailyActivityProgress[];
    obstacles?: string;
    equipmentIssues?: string;
    plannedContinuationDate?: string;
    supervisorConfirmed?: boolean;
  }) => {
    if (!dailyLogModalProject || !currentUser) return;
    // Use the freshest copy (realtime may have changed it while the modal was open)
    const project = projectsRef.current.find((p) => p.id === dailyLogModalProject.id);
    if (!project) {
      setDailyLogModalProject(null);
      showToast('error', 'این پروژه توسط مدیر تغییر کرده یا حذف شده است.');
      return;
    }
    if (project.status !== 'IN_PROGRESS') {
      setDailyLogModalProject(null);
      showToast('error', 'فقط پروژه‌ی در حال اجرا را می‌توان برای امروز متوقف کرد.');
      return;
    }
    const nowIso = new Date().toISOString();
    const todayKey = localDateKey();

    const existingSessions = project.workSessions || [];
    let updatedSessions = existingSessions;
    if (existingSessions.length > 0 && !existingSessions[existingSessions.length - 1].endedAt) {
      updatedSessions = existingSessions.map((s, idx) =>
        idx === existingSessions.length - 1 ? { ...s, endedAt: nowIso } : s
      );
    }

    const isSupervisor =
      currentUser.role === 'LEAD_TECHNICIAN' ||
      currentUser.role === 'QC_MANAGER' ||
      project.leadTechnicianId === currentUser.id;

    const newDailyLog: DailyLog = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}`,
      date: todayKey,
      startTime: data.startTime,
      endTime: data.endTime,
      completedQuantity: data.completedQuantity,
      remainingQuantity: data.remainingQuantity,
      quantityUnit: data.quantityUnit,
      activityProgress: data.activityProgress,
      note: data.note || 'ثبت پیشرفت کاری روزانه',
      obstacles: data.obstacles,
      equipmentIssues: data.equipmentIssues,
      photos: data.photos,
      plannedContinuationDate: data.plannedContinuationDate,
      supervisorConfirmed: data.supervisorConfirmed ?? isSupervisor,
      supervisorConfirmedBy: isSupervisor ? currentUser.name : undefined,
      supervisorConfirmedAt: isSupervisor ? nowIso : undefined,
      byUserId: currentUser.id,
      byUserName: currentUser.name,
      createdAt: nowIso,
    };

    const patch: Partial<Project> = {
      status: 'PAUSED',
      workSessions: updatedSessions,
      dailyLogs: [...(project.dailyLogs || []), newDailyLog],
      updatedAt: nowIso,
    };

    await commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: `project:${project.id}`,
        payload: { id: project.id, patch },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === project.id ? { ...p, ...patch } : p
        );
        setProjects(next);
        projectsRef.current = next;
        setDailyLogModalProject(null);
      }
    );
    showToast('success', 'پایان کار امروز ثبت شد و پروژه در وضعیت نیمه‌کاره قرار گرفت.');
  };

  // Pre-Installation site readiness inspection handler (Task 4)
  const handleSavePreInspection = async (
    inspection: SiteReadinessInspection,
    newScheduledDate?: string
  ) => {
    if (!preInspectionProject || !currentUser) return;
    const projectId = preInspectionProject.id;
    const current = projectsRef.current.find((p) => p.id === projectId);

    const isPassed = inspection.status === 'PASSED' || Boolean(inspection.isReady);

    const patch: Partial<Project> = {
      scheduledDate: newScheduledDate || current?.scheduledDate,
      siteReadiness: inspection,
      updatedAt: new Date().toISOString(),
    };

    // Only change status if current status is MEASUREMENT_PENDING or SCHEDULED
    if (current && (current.status === 'MEASUREMENT_PENDING' || current.status === 'SCHEDULED')) {
      patch.status = (isPassed ? 'SCHEDULED' : 'MEASUREMENT_PENDING') as Project['status'];
    }

    await commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, patch },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === projectId ? { ...p, ...patch } : p
        );
        setProjects(next);
        projectsRef.current = next;
        setPreInspectionProject(null);
      }
    );
    showToast('success', 'برگه بازبینی و آمادگی فیزیکی بستر نصب با موفقیت در سرور ثبت شد.');
  };

  // 360-degree Personnel evaluation handler (atomic append via append_project_evaluation RPC)
  const handleSaveEvaluation = async (evaluation: PersonnelEvaluation) => {
    if (!evaluationProject || !currentUser) return;
    const projectId = evaluationProject.id;

    await commit(
      {
        type: 'APPEND_PROJECT_EVALUATION',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, evaluation },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === projectId
            ? {
                ...p,
                evaluations: [...(p.evaluations || []), evaluation],
                updatedAt: new Date().toISOString(),
              }
            : p
        );
        setProjects(next);
        projectsRef.current = next;
        setEvaluationProject(null);
      }
    );
    showToast('success', `ارزیابی عملکرد ${evaluation.userName} با موفقیت در سرور ثبت گردید.`);
  };

  // On-site acute stoppage / Stuck report handler (<72h KPI) with Inter-Team Handover
  const handleReportStuck = (project: Project) => {
    setStuckModalProject(project);
  };

  const handleConfirmReportStuck = async (incident: StuckIncident, handoverPayload?: any) => {
    if (!stuckModalProject || !currentUser) return;
    const projectId = stuckModalProject.id;
    const current = projectsRef.current.find((p) => p.id === projectId);

    // Capture previous status
    const previousStatus = incident.previousStatus || current?.status || 'IN_PROGRESS';
    const incidentWithPrevious: StuckIncident = {
      ...incident,
      previousStatus,
    };

    // Append to stuckIncidents array while keeping stuckIncident for backward compatibility
    const existingIncidents =
      current?.stuckIncidents || (current?.stuckIncident ? [current.stuckIncident] : []);
    const updatedIncidents = [...existingIncidents, incidentWithPrevious];

    const patch: Partial<Project> = {
      status: 'STUCK',
      stuckIncidents: updatedIncidents,
      updatedAt: new Date().toISOString(),
    };

    if (handoverPayload) {
      patch.interTeamHandover = {
        ...handoverPayload,
        reportedByUserId: currentUser.id,
      };
    }

    await commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, patch },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === projectId ? { ...p, ...patch, stuckIncident: incidentWithPrevious } : p
        );
        setProjects(next);
        projectsRef.current = next;
        setStuckModalProject(null);
      }
    );

    // If stoppage is due to missing parts or shortage, auto-generate urgent ticket for warehouse
    if (
      handoverPayload?.requiredParts ||
      incident.category === 'HARDWARE_SHORTAGE' ||
      incident.category === 'FABRIC_SHORTAGE'
    ) {
      const partsText = handoverPayload?.requiredParts
        ? `کسری قطعه سر پروژه: ${handoverPayload.requiredParts}`
        : incident.description;
      const autoTicket = buildWarehouseReferralTicket({
        idPrefix: 'ticket-stuck',
        projectId,
        project: current,
        description: partsText,
        blockingReason: `توقف کار در پروژه ${current?.code || current?.title} به علت کسری قطعات: ${partsText}`,
        referralNote: `ارجاع خودکار سیستمی ناشی از اعلام توقف کار سر پروژه: ${partsText}`,
        historyNote: `اعلام توقف کار و ارسال مستقیم به کارتابل انبار: ${partsText}`,
        reporter: currentUser,
        warehouseAssignee,
      });

      await commit(
        {
          type: 'CREATE_TICKET',
          orderingKey: `ticket:${autoTicket.id}`,
          payload: autoTicket,
        },
        () => {
          const nextTickets = [autoTicket, ...ticketsRef.current];
          setTickets(nextTickets);
          ticketsRef.current = nextTickets;
        }
      );
    }

    showToast('warning', 'پروژه به فهرست پروژه‌های متوقف‌شده ارجاع یافت و درخواست قطعه در کارتابل انبار ثبت گردید.');
  };

  // Refer stuck project to warehouse from StuckProjectsDesk
  const handleReferProjectToWarehouse = async (project: Project, note: string) => {
    if (!currentUser) return;
    const urgentTicket = buildWarehouseReferralTicket({
      projectId: project.id,
      project,
      description: note,
      blockingReason: `ارجاع توقف پروژه ${project.code || project.title} به انبار: ${note}`,
      referralNote: note,
      historyNote: `دستور مدیر فنی به انبار: ${note}`,
      reporter: currentUser,
      warehouseAssignee,
    });

    await commit(
      {
        type: 'CREATE_TICKET',
        orderingKey: `ticket:${urgentTicket.id}`,
        payload: urgentTicket,
      },
      () => {
        const next = [urgentTicket, ...ticketsRef.current];
        setTickets(next);
        ticketsRef.current = next;
      }
    );
    showToast('success', `تیکت اولویت فوری برای انباردار صادر و در کارتابل انبار قرار گرفت.`);
  };

  // Pre-Install Photos Confirmation and Start Execution Gate
  const handleSavePreInstallPhotosAndStart = async (projectId: string, photos: string[]) => {
    if (!currentUser) return;
    const current = projectsRef.current.find((p) => p.id === projectId);
    if (!current) return;

    const nowIso = new Date().toISOString();
    const existingSessions = current.workSessions || [];
    const hasOpenSession = existingSessions.some((s) => !s.endedAt);
    const updatedSessions = hasOpenSession
      ? existingSessions
      : [
          ...existingSessions,
          {
            date: localDateKey(),
            startedAt: nowIso,
            byUserId: currentUser.id,
            byUserName: currentUser.name,
          },
        ];

    const patch: Partial<Project> = {
      status: 'IN_PROGRESS',
      beforePhotos: [...(current.beforePhotos || []), ...photos],
      preInstallPhotosConfirmed: true,
      startedAt: current.startedAt || nowIso,
      workSessions: updatedSessions,
      updatedAt: nowIso,
    };

    await commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, patch },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === projectId ? { ...p, ...patch } : p
        );
        setProjects(next);
        projectsRef.current = next;
      }
    );
    showToast('success', 'عکس‌های قبل از نصب تایید و وضعیت پروژه به «در حال اجرا» تغییر یافت.');
  };

  // 2nd Measurement Lead: Save verification and readiness checks
  const handleSaveMeasurement = async (projectId: string, details: any) => {
    if (!currentUser) return;
    const current = projectsRef.current.find((p) => p.id === projectId);
    if (!current) return;

    const shouldTransitionToScheduled =
      current.status === 'MEASUREMENT_PENDING' &&
      Boolean(details?.isReadinessApproved) &&
      Boolean(current.scheduledDate);

    const patch: Partial<Project> = {
      secondMeasurementDetails: details,
      updatedAt: new Date().toISOString(),
      ...(shouldTransitionToScheduled ? { status: 'SCHEDULED' } : {}),
    };

    await commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, patch },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === projectId ? { ...p, ...patch } : p
        );
        setProjects(next);
        projectsRef.current = next;
      }
    );
    showToast('success', 'تاییدیه اندازه‌گیری دوم و ارزیابی بستر فضا با موفقیت ذخیره شد.');
  };

  // Warehouse: Confirm packing ready
  const handleConfirmWarehousePacking = async (projectId: string, notes?: string) => {
    if (!currentUser) return;
    const current = projectsRef.current.find((p) => p.id === projectId);
    if (!current) return;

    const prep = {
      isPackedAndReady: true,
      packedAt: new Date().toISOString(),
      packedByUserId: currentUser.id,
      packedByUserName: currentUser.name,
      notes: notes || '',
    };

    const patch: Partial<Project> = {
      warehousePrep: prep,
      updatedAt: new Date().toISOString(),
    };

    await commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, patch },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === projectId ? { ...p, ...patch } : p
        );
        setProjects(next);
        projectsRef.current = next;
      }
    );
    showToast('success', `بسته‌بندی پروژه ${current.code || current.title} تایید شد و پرچم «بار آماده ✅» در تقویم مدیریت فعال گردید.`);
  };

  // Warehouse: Confirm arrival of goods into central warehouse (Official Handover Gate)
  const handleConfirmWarehouseReceipt = async (
    projectId: string,
    params: {
      confirmed: boolean;
      notes?: string;
      shelfLocation?: string;
    }
  ) => {
    if (!currentUser) return;
    const current = projectsRef.current.find((p) => p.id === projectId);
    if (!current) return;

    const existingHandover = current.technicalHandover || {
      isHandoverComplete: false,
      warehouseConfirmation: { confirmed: false },
    };

    const isConfirmed = params.confirmed;
    const newIsHandoverComplete = isConfirmed;

    const updatedHandover: ProjectTechnicalHandover = {
      ...existingHandover,
      warehouseConfirmation: {
        confirmed: isConfirmed,
        confirmedBy: isConfirmed ? (getDisplayName(currentUser.name) || currentUser.name) : undefined,
        confirmedAt: isConfirmed ? new Date().toISOString() : undefined,
        notes: params.notes?.trim() || undefined,
        shelfLocation: params.shelfLocation?.trim() || undefined,
      },
      isHandoverComplete: newIsHandoverComplete,
      officialHandoverDate: newIsHandoverComplete
        ? (existingHandover.officialHandoverDate || new Date().toISOString())
        : undefined,
      unlockedAt: newIsHandoverComplete
        ? (existingHandover.unlockedAt || new Date().toISOString())
        : undefined,
    };

    if ('isHistoricalMigration' in updatedHandover && !current.technicalHandover?.isHistoricalMigration) {
      delete (updatedHandover as any).isHistoricalMigration;
    }

    const patch: Partial<Project> = {
      technicalHandover: updatedHandover,
      updatedAt: new Date().toISOString(),
    };

    await commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId, patch },
      },
      () => {
        const next = projectsRef.current.map((p) =>
          p.id === projectId ? { ...p, ...patch } : p
        );
        setProjects(next);
        projectsRef.current = next;
      }
    );

    if (isConfirmed) {
      showToast('success', `ورود کالا به انبار تایید شد. گیت تحویل فنی پروژه ${current.code || current.title} باز شد و آماده زمان‌بندی نصب است.`);
    } else {
      showToast('info', `تاییدیه ورود کالا به انبار برای پروژه ${current.code || current.title} لغو شد.`);
    }
  };

  // Warehouse: Resolve urgent site ticket
  const handleResolveWarehouseTicket = async (
    ticketId: string,
    action: 'SUPPLIED' | 'DISPATCHED_COURIER' | 'DELAYED',
    payload?: {
      courierInfo?: string;
      trackingCode?: string;
      delayReason?: string;
      estimatedAvailableDate?: string;
    }
  ) => {
    if (!currentUser) return;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    let resolutionText = '';
    let status: Ticket['status'] = 'OPEN';
    if (action === 'SUPPLIED') {
      resolutionText = `تحویل حضوری از انبار: قطعه توسط انباردار (${currentUser.name}) تامین و تحویل گردید.`;
      status = 'RESOLVED';
    } else if (action === 'DISPATCHED_COURIER') {
      resolutionText = `ارسال با پیک/اسنپ به کارگاه: ${payload?.courierInfo || ''} — کد رهگیری: ${payload?.trackingCode || 'ندارد'} (ثبت شده توسط ${currentUser.name})`;
      status = 'RESOLVED';
    } else if (action === 'DELAYED') {
      resolutionText = `تاخیر در تامین: ${payload?.delayReason || 'عدم موجودی فعلی'}. تاریخ تخمینی موجودی: ${payload?.estimatedAvailableDate || 'نامشخص'}`;
      status = 'OPEN';
    }

    const patch: Partial<Ticket> = {
      status,
      resolutionNote: resolutionText,
      resolvedAt: status === 'RESOLVED' ? new Date().toISOString() : undefined,
      verifiedByUserId: currentUser.id,
      verifiedByUserName: currentUser.name,
      actionHistory: [
        ...(ticket.actionHistory || []),
        {
          id: `act-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action,
          byUserId: currentUser.id,
          byUserName: currentUser.name,
          note: resolutionText,
        },
      ],
    };

    await commit(
      {
        type: 'PATCH_TICKET',
        orderingKey: `ticket:${ticketId}`,
        payload: { id: ticketId, patch },
      },
      () => {
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...patch } : t)));
      }
    );
    showToast('success', 'وضعیت تیکت انبار با موفقیت به‌روزرسانی شد.');
  };

  // Acknowledge receipt of transferred project by receiving lead technician (Phase P2.2)
  const handleConfirmTransferReceipt = async (project: Project) => {
    if (!currentUser) return;
    try {
      const patch = createConfirmTransferReceiptPayload(project, currentUser, currentUser.teamId);
      await commit(
        {
          type: 'PATCH_PROJECT',
          orderingKey: `project:${project.id}`,
          payload: { id: project.id, patch },
        },
        () => {
          const next = projectsRef.current.map((p) =>
            p.id === project.id ? { ...p, ...patch } : p
          );
          setProjects(next);
          projectsRef.current = next;
        }
      );
      showToast('success', 'تحویل‌گیری رسمی کار و اقلام توسط سرپرست اکیپ با موفقیت ثبت شد.');
    } catch (err: any) {
      showToast('error', err.message || 'خطا در ثبت تحویل‌گیری');
    }
  };

  // Manager override for pending team transfer (Phase P2.2 Hardening)
  const handleManagerOverrideTransfer = async (project: Project, reason: string) => {
    if (!currentUser || currentUser.role !== 'QC_MANAGER') return;
    try {
      const patch = createManagerOverrideTransferPayload({ project, user: currentUser, reason });
      await commit(
        {
          type: 'PATCH_PROJECT',
          orderingKey: `project:${project.id}`,
          payload: { id: project.id, patch },
        },
        () => {
          const next = projectsRef.current.map((p) =>
            p.id === project.id ? { ...p, ...patch } : p
          );
          setProjects(next);
          projectsRef.current = next;
        }
      );
      showToast('success', 'رفع انسداد مدیریتی انتقال با موفقیت ثبت شد.');
    } catch (err: any) {
      showToast('error', err.message || 'خطا در رفع انسداد مدیریتی انتقال');
    }
  };

  // Ticket handlers
  const handleCreateTicket = async (newTicket: Ticket) => {
    if (!currentUser) return;
    await commit(
      {
        type: 'CREATE_TICKET',
        orderingKey: `ticket:${newTicket.id}`,
        payload: newTicket,
      },
      () => {
        setTickets((prev) => [newTicket, ...prev]);
        setTicketModalProject(null);
      }
    );
    showToast('warning', 'تیکت اضطراری با موفقیت ثبت شد و به اطلاع مدیر QC رسید.');
  };

  const handleUpdateTicket = async (updatedTicket: Ticket) => {
    if (!currentUser) return;
    const existing = tickets.find((t) => t.id === updatedTicket.id);
    const diff: Partial<Ticket> = {};
    if (!existing) {
      Object.assign(diff, updatedTicket);
    } else {
      (Object.keys(updatedTicket) as (keyof Ticket)[]).forEach((k) => {
        if (JSON.stringify(updatedTicket[k]) !== JSON.stringify(existing[k])) {
          (diff as any)[k] = updatedTicket[k];
        }
      });
    }

    await commit(
      {
        type: 'PATCH_TICKET',
        orderingKey: `ticket:${updatedTicket.id}`,
        payload: { id: updatedTicket.id, patch: diff },
      },
      () => {
        setTickets((prev) =>
          prev.map((t) => (t.id === updatedTicket.id ? { ...t, ...diff } : t))
        );
      }
    );
    showToast('success', 'تیکت با موفقیت به‌روزرسانی شد.');
  };

  // Material Request handlers (Phase P2.3)
  const handleCreateMaterialRequest = async (newRequest: MaterialRequest) => {
    if (!currentUser) return;
    await commit(
      {
        type: 'CREATE_MATERIAL_REQUEST',
        orderingKey: `material:${newRequest.id}`,
        payload: newRequest,
      },
      () => {
        setMaterialRequests((prev) => [newRequest, ...prev]);
        setMaterialModalProject(null);
      }
    );
    showToast('success', 'درخواست متریال با موفقیت ثبت و جهت آماده‌سازی به دفتر ارسال شد.');
  };

  const handleUpdateMaterialRequest = async (updatedRequest: MaterialRequest) => {
    if (!currentUser) return;
    await commit(
      {
        type: 'PATCH_MATERIAL_REQUEST',
        orderingKey: `material:${updatedRequest.id}`,
        payload: { id: updatedRequest.id, patch: updatedRequest },
      },
      () => {
        setMaterialRequests((prev) =>
          prev.map((r) => (r.id === updatedRequest.id ? updatedRequest : r))
        );
      }
    );
    showToast('success', 'درخواست متریال با موفقیت به‌روزرسانی شد.');
  };

  const handleConfirmMaterialReceipt = async (request: MaterialRequest, dispatchId: string) => {
    if (!currentUser) return;
    try {
      const project = projectsRef.current.find((p) => p.id === request.projectId);
      const updated = createConfirmReceiptPayload(request, dispatchId, currentUser, project);
      // In receipt confirmation, history is strictly server-generated to guarantee
      // serverRecordedAt and prevent client-supplied user names from overriding profile identity.
      const patch = {
        status: updated.status,
        dispatches: updated.dispatches,
        updatedAt: updated.updatedAt,
      };
      await commit(
        {
          type: 'PATCH_MATERIAL_REQUEST',
          orderingKey: `material:${updated.id}`,
          payload: { id: updated.id, patch },
        },
        () => {
          setMaterialRequests((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
          );
        }
      );
      showToast('success', 'تحویل محموله متریال در محل کارگاه با موفقیت تایید شد.');
    } catch (err: any) {
      showToast('error', err.message || 'خطا در تایید تحویل متریال.');
    }
  };

  const handleResolveDefect = async (
    projectId: string,
    defectId: string,
    resolutionNotes: string,
    photos?: string[]
  ) => {
    if (!currentUser) return;
    const project = projectsRef.current.find((p) => p.id === projectId);
    if (!project) return;
    try {
      const payload = createDefectResolutionPayload({
        project,
        defectId,
        resolutionNotes,
        resolutionPhotos: photos,
        user: currentUser,
      });
      await handlePatchProject(projectId, payload);
      showToast('success', 'اقدام اصلاحی و رفع نقص با موفقیت ثبت شد.');
    } catch (err: any) {
      showToast('error', err.message || 'خطا در ثبت رفع نقص');
    }
  };

  // Settings handler
  const handleUpdateSettings = async (newSettings: SystemSettings) => {
    if (!currentUser) return;
    await commit(
      {
        type: 'UPDATE_SETTINGS',
        orderingKey: 'settings',
        payload: newSettings,
      },
      () => {
        setSettings(newSettings);
        StorageService.saveSettings(newSettings);
      }
    );
    showToast('success', 'تنظیمات با موفقیت در سیستم ثبت شد.');
  };

  // User handlers
  const handleSaveUser = (user: User) => {
    const isFieldRole = user.role === 'LEAD_TECHNICIAN' || user.role === 'TECHNICIAN';
    const effectiveUser: User = {
      ...user,
      teamId: isFieldRole ? user.teamId : undefined,
      updatedAt: new Date().toISOString(),
    };

    // Remove from deletion blacklist if previously deleted
    StorageService.removeDeletedUserId(effectiveUser.id);

    if (!isFieldRole) {
      // Office / Management roles cannot be attached to installation field teams
      setTeamMembers((prev) => {
        const filtered = prev.filter((m) => m.userId !== user.id);
        StorageService.saveTeamMembers(filtered);
        return filtered;
      });
      setTeams((prev) => {
        const updated = prev.map((t) =>
          t.supervisorId === user.id
            ? {
                ...t,
                supervisorId: undefined,
                name: defaultTeamName(t.code),
              }
            : t
        );
        StorageService.saveTeams(updated);
        return updated;
      });
    } else if (user.role === 'TECHNICIAN') {
      // Regular technician cannot be the supervisor of any team
      setTeams((prev) => {
        const updated = prev.map((t) =>
          t.supervisorId === user.id
            ? {
                ...t,
                supervisorId: undefined,
                name: defaultTeamName(t.code),
              }
            : t
        );
        StorageService.saveTeams(updated);
        return updated;
      });
      setTeamMembers((prev) => {
        const updated = prev.map((m) =>
          m.userId === user.id ? { ...m, roleInTeam: 'TECHNICIAN' as const } : m
        );
        StorageService.saveTeamMembers(updated);
        return updated;
      });
    }

    setUsers((prev) => {
      const exists = prev.some((u) => u.id === effectiveUser.id);
      let updated: User[];
      if (exists) {
        updated = prev.map((u) => (u.id === effectiveUser.id ? effectiveUser : u));
      } else {
        updated = [...prev, effectiveUser];
      }
      StorageService.saveUsers(updated);
      return updated;
    });

    if (currentUser && currentUser.id === effectiveUser.id) {
      setCurrentUser(effectiveUser);
    }
    showToast('success', `اطلاعات و نقش ${getDisplayName(effectiveUser.name)} با موفقیت ثبت و ذخیره شد.`);
  };

  const handleDeleteUser = (userId: string) => {
    // 1. Add to deletion blacklist (tombstones)
    StorageService.addDeletedUserId(userId);

    // 2. Remove user from state and storage
    setUsers((prev) => {
      const filtered = prev.filter((u) => u.id !== userId);
      StorageService.saveUsers(filtered);
      return filtered;
    });

    // 3. Clean up team membership
    setTeamMembers((prev) => {
      const removedMembers = prev.filter((m) => m.userId === userId);
      for (const m of removedMembers) {
        StorageService.addDeletedTeamMemberId(m.id);
      }
      const filtered = prev.filter((m) => m.userId !== userId);
      StorageService.saveTeamMembers(filtered);
      return filtered;
    });

    // 4. Clean up team supervisor role if applicable
    setTeams((prevTeams) => {
      const updatedTeams = prevTeams.map((t) =>
        t.supervisorId === userId
          ? { ...t, supervisorId: undefined, name: defaultTeamName(t.code) }
          : t
      );
      StorageService.saveTeams(updatedTeams);
      return updatedTeams;
    });
  };

  const handleCreateTeam = async (): Promise<{ success: boolean; error?: string }> => {
    const code = nextTeamCode(teams);
    let name = defaultTeamName(code);
    if (teams.some((t) => t.name === name)) name = `${name} (${code})`;
    let created: InstallationTeam = {
      id: code,
      name,
      code,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (SupabaseSyncService.getClient()) {
      const res = await SupabaseSyncService.createInstallationTeam(name, code);
      if (!res.success || !res.data) {
        showToast('error', `اکیپ ساخته نشد: ${res.error || 'خطای نامشخص'}`);
        return { success: false, error: res.error };
      }
      created = res.data;
    }
    setTeams((prev) => {
      const updated = [...prev, created].sort((a, b) =>
        String(a.code).localeCompare(String(b.code), undefined, { numeric: true }),
      );
      StorageService.saveTeams(updated);
      return updated;
    });
    showToast('success', `«${created.name}» ساخته شد. اعضا را از همین کارت اضافه کنید.`);
    return { success: true };
  };

  const handleDeleteTeam = async (teamId: string): Promise<{ success: boolean; error?: string }> => {
    if (teamMembers.some((m) => m.teamId === teamId)) {
      const error = 'اول اعضای این اکیپ را خارج کنید.';
      showToast('error', error);
      return { success: false, error };
    }
    if (SupabaseSyncService.getClient()) {
      const res = await SupabaseSyncService.deleteInstallationTeam(teamId);
      if (!res.success) {
        showToast('error', `اکیپ حذف نشد: ${res.error || 'خطای نامشخص'}`);
        return { success: false, error: res.error };
      }
    }
    setTeams((prev) => {
      const updated = prev.filter((t) => t.id !== teamId);
      StorageService.saveTeams(updated);
      return updated;
    });
    showToast('success', 'اکیپ حذف شد.');
    return { success: true };
  };

  const handleAssignTeamMember = async (
    teamId: string,
    userId: string,
    roleInTeam: 'LEAD' | 'TECHNICIAN'
  ) => {
    if (SupabaseSyncService.getClient()) {
      const res = await SupabaseSyncService.adminAssignTeamMember(teamId, userId, roleInTeam);
      if (!res.success) {
        const error = `انتساب روی سرور انجام نشد: ${res.error || 'خطای نامشخص'}`;
        showToast('error', error);
        return { success: false, error };
      }
    }

    setTeamMembers((prev) => {
      const filtered = prev.filter((m) => m.userId !== userId);
      const withoutExistingLead = roleInTeam === 'LEAD'
        ? filtered.filter((m) => !(m.teamId === teamId && m.roleInTeam === 'LEAD'))
        : filtered;
      const newMemberId = `tm-${Date.now()}-${userId}`;
      StorageService.removeDeletedTeamMemberId(newMemberId);
      const updated: TeamMember[] = [
        ...withoutExistingLead,
        {
          id: newMemberId,
          teamId,
          userId,
          roleInTeam,
          joinedAt: new Date().toISOString(),
        },
      ];
      StorageService.saveTeamMembers(updated);
      return updated;
    });

    if (roleInTeam === 'LEAD') {
      const supervisor = users.find((u) => u.id === userId);
      const supervisorName = supervisor ? getDisplayName(supervisor.name) : '';
      setTeams((prev) => {
        const updated = prev.map((t) =>
          t.id === teamId
            ? {
                ...t,
                supervisorId: userId,
                name: supervisorName ? `اکیپ نصب ${supervisorName}` : t.name,
              }
            : t
        );
        StorageService.saveTeams(updated);
        return updated;
      });
    }

    setUsers((prev) => {
      const updated = prev.map((u) => {
        if (u.id === userId) {
          const newRole: UserRole =
            roleInTeam === 'LEAD'
              ? 'LEAD_TECHNICIAN'
              : u.role === 'LEAD_TECHNICIAN'
              ? 'TECHNICIAN'
              : u.role;
          return { ...u, teamId, role: newRole };
        }
        return u;
      });
      StorageService.saveUsers(updated);
      return updated;
    });

    showToast('success', 'عضو با موفقیت به اکیپ انتساب یافت.');
    return { success: true };
  };

  const handleRemoveTeamMember = async (userId: string) => {
    if (SupabaseSyncService.getClient()) {
      const res = await SupabaseSyncService.adminRemoveTeamMember(userId);
      if (!res.success) {
        const error = `حذف از اکیپ روی سرور انجام نشد: ${res.error || 'خطای نامشخص'}`;
        showToast('error', error);
        return { success: false, error };
      }
    }

    setTeamMembers((prev) => {
      const removedMember = prev.find((m) => m.userId === userId);
      if (removedMember) {
        StorageService.addDeletedTeamMemberId(removedMember.id);
      }
      const updated = prev.filter((m) => m.userId !== userId);
      StorageService.saveTeamMembers(updated);

      if (removedMember && removedMember.roleInTeam === 'LEAD') {
        setTeams((prevTeams) => {
          const updatedTeams = prevTeams.map((t) =>
            t.id === removedMember.teamId && t.supervisorId === userId
              ? { ...t, supervisorId: undefined, name: defaultTeamName(t.code) }
              : t
          );
          StorageService.saveTeams(updatedTeams);
          return updatedTeams;
        });
      }

      return updated;
    });

    setUsers((prev) => {
      const updated = prev.map((u) => (u.id === userId ? { ...u, teamId: undefined } : u));
      StorageService.saveUsers(updated);
      return updated;
    });

    showToast('success', 'عضو با موفقیت از اکیپ حذف شد.');
    return { success: true };
  };

  // Clear local device cache & reload from cloud with atomic coordinated outbox safety
  const handleResetData = async () => {
    try {
      const pendingCount = await OfflineQueue.getPendingCount();
      const failedCount = await OfflineQueue.getFailedCount();

      if (pendingCount > 0 || failedCount > 0) {
        const confirmed = window.confirm(
          `هشدار مهم: تعداد ${toPersianDigits(pendingCount)} تغییر ارسال‌نشده و ${toPersianDigits(failedCount)} عملیات ناموفق در صف آفلاین این دستگاه وجود دارد.\n\n` +
          `در صورت پاک‌سازی کش (Reset)، تمام این تغییرات برای همیشه از بین خواهند رفت و به سرور ارسال نخواهند شد.\n\n` +
          `آیا با اطمینان کامل می‌خواهید داده‌ها و صف‌های ارسال‌نشده را حذف کرده و از سرور بازخوانی کنید؟`
        );
        if (!confirmed) {
          return;
        }
      } else {
        const confirmed = window.confirm(
          'آیا مایلید حافظه محلی (کش) این مرورگر پاک‌سازی شود و داده‌ها مجدداً از سرور ابری دریافت شوند؟'
        );
        if (!confirmed) {
          return;
        }
      }

      await StorageService.executeFullReset();
      window.location.reload();
    } catch (err: any) {
      console.error('Coordinated reset failed:', err);
      window.alert(
        `خطا در پاک‌سازی حافظه دستگاه:\n${err?.message || 'عملیات با خطا متوقف شد.'}\n\nجهت حفظ یکپارچگی داده‌ها، صفحه بارگذاری مجدد نشد. لطفاً مجدداً تلاش کنید.`
      );
    }
  };

  // Open Project Form Modal
  const [projectFormInitialData, setProjectFormInitialData] = useState<Partial<Project> | null>(null);

  const handleOpenNewProject = (dateKey?: string, initialData?: Partial<Project>) => {
    setEditingProject(null);
    setProjectFormInitialData(initialData || null);
    setPresetDateKey(dateKey);
    setIsProjectFormOpen(true);
  };

  const handleOpenEditProject = (project: Project) => {
    setEditingProject(project);
    setIsProjectFormOpen(true);
  };

  // CEO Impersonation Handlers (ورود و بازرسی مستقیم پنل پرسنل)
  const handleImpersonateUser = (targetUser: User) => {
    if (!currentUser) return;
    const ceoToSave = impersonatorCeo || currentUser;
    setImpersonatorCeo(ceoToSave);
    try {
      localStorage.setItem('talaie_impersonator_ceo', JSON.stringify(ceoToSave));
    } catch (e) {
      console.warn('Could not persist impersonator CEO:', e);
    }

    sessionEpochRef.current++;
    setCurrentUser(targetUser);

    if (targetUser.role === 'WAREHOUSE') {
      setActiveTab('materials');
    } else if (targetUser.role === 'QC_MANAGER') {
      setActiveTab('qc');
    } else if (targetUser.role === 'SCHEDULING_COORDINATOR') {
      setActiveTab('planner');
    } else if (targetUser.role === 'MEASUREMENT_LEAD') {
      setActiveTab('control');
    }

    showToast(
      'info',
      `ورود به پنل «${getDisplayName(targetUser.name)}» (${getUserRoleLabel(targetUser.role)}) انجام شد.`
    );
  };

  const handleExitImpersonation = () => {
    if (!impersonatorCeo) return;
    sessionEpochRef.current++;
    const restoredCeo = { ...impersonatorCeo };
    setCurrentUser(restoredCeo);
    setImpersonatorCeo(null);
    try {
      localStorage.removeItem('talaie_impersonator_ceo');
    } catch (e) {
      console.warn('Could not clear impersonator CEO:', e);
    }
    setActiveTab(restoredCeo.role === 'CEO' ? 'registry' : 'control');
    showToast('success', `به حساب ${getUserRoleLabel(restoredCeo.role)} بازگشتید.`);
  };

  const handleLogout = async () => {
    setImpersonatorCeo(null);
    try {
      localStorage.removeItem('talaie_impersonator_ceo');
    } catch {}

    if (pendingQueueCount > 0) {
      const confirmed = window.confirm(
        'تغییرات ذخیره‌نشده روی این دستگاه دارید که در صورت خروج ممکن است بعداً با اکانت دیگر ارسال نشود. آیا مطمئن هستید که می‌خواهید خارج شوید؟'
      );
      if (!confirmed) {
        return;
      }
    }
    sessionEpochRef.current++;
    await SupabaseSyncService.signOut();
    setCurrentUser(null);
    setProjects([]);
    projectsRef.current = [];
    setTickets([]);
    setMaterialRequests([]);
    setIsSyncedWithServer(false);
    showToast('info', 'با موفقیت از حساب کاربری خارج شدید.');
  };

  const handleLoginSuccess = (u: User) => {
    if (u?.id) {
      if (tickets.length > 0) {
        StorageService.saveTickets(tickets, u.id);
      }
      if (projectsRef.current.length > 0) {
        StorageService.saveProjects(projectsRef.current, u.id);
      }
      if (materialRequestsRef.current.length > 0) {
        StorageService.saveMaterialRequests(materialRequestsRef.current, u.id);
      }
    }
    setCurrentUser(u);
  };

  // Splash screen while checking persistent session
  if (authChecking) {
    return <SplashScreen />;
  }

  // If no user is authenticated, render the dedicated secure login page
  if (!currentUser) {
    return (
      <LoginModal
        users={users}
        isOpen={true}
        isStandalone={true}
        onSelectUser={handleLoginSuccess}
      />
    );
  }

  // Badge counters (single source for sidebar, bottom bar and dashboard)
  const { openTicketCount, openStuckCount, pendingQcCount, pendingMaterialCount } = computeNavCounts(
    projects,
    tickets,
    materialRequests
  );
  const actionQueueCount = buildActionQueue(projects, tickets).length;

  const isQcManager = currentUser.role === 'QC_MANAGER';
  const isCoordinator = currentUser.role === 'SCHEDULING_COORDINATOR';
  const isCeo = currentUser.role === 'CEO';
  const isManagerOrCoordinator = isQcManager || isCoordinator || isCeo;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-canvas text-ink flex flex-col font-sans selection:bg-brand selection:text-on-brand transition-colors duration-150">
      {/* Skip to Content for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-50 focus:px-3.5 focus:py-2 focus:bg-brand focus:text-on-brand focus:font-black focus:rounded-md focus:shadow-xl focus:ring-1 focus:ring-brand"
      >
        پرش به محتوای اصلی صفحه
      </a>

      <ImpersonationBanner
        viewedUser={currentUser}
        impersonator={impersonatorCeo}
        onExit={handleExitImpersonation}
      />

      {/* App Header */}
      <Header
        currentUser={currentUser}
        isOfflineMode={isOfflineMode}
        isSyncing={!isSyncedWithServer && !isOfflineMode}
        pendingQueueCount={pendingQueueCount}
        failedQueueCount={failedQueueCount}
        onOpenFailedOperations={() => setIsFailedOpsModalOpen(true)}
        onOpenPendingOperations={() => setIsPendingOpsModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onLogout={handleLogout}
        impersonatorCeo={impersonatorCeo}
        onExitImpersonation={handleExitImpersonation}
      />

      <OfflineBanner visible={isOfflineMode} />

      {/* Main Body */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 focus:outline-none">
        {!impersonatorCeo && currentUser.role !== 'CEO' && <NotificationPrompt userId={currentUser.id} />}
        {currentUser.role === 'MEASUREMENT_LEAD' ? (
          // ================= 2ND MEASUREMENT & SITE READINESS DESK =================
          <React.Suspense fallback={<DashboardSkeleton />}>
            <MeasurementDashboard
              currentUser={currentUser}
              projects={projects}
              onSaveMeasurement={handleSaveMeasurement}
              onViewProposal={(p) => setProposalModalProject(p)}
            />
          </React.Suspense>
        ) : currentUser.role === 'WAREHOUSE' ? (
          // ================= WAREHOUSE PREPARATION & SITE DISPATCH DESK =================
          <React.Suspense fallback={<DashboardSkeleton />}>
            <MaterialCenter
              materialRequests={materialRequests}
              currentUser={currentUser}
              users={users}
              tickets={tickets}
              projects={projects}
              onUpdateMaterialRequest={handleUpdateMaterialRequest}
              onResolveTicket={handleResolveWarehouseTicket}
              onConfirmPacking={handleConfirmWarehousePacking}
              onConfirmGoodsReceipt={handleConfirmWarehouseReceipt}
              onViewProposal={(p) => setProposalModalProject(p)}
              onOpenTicketModal={(p) => setTicketModalProject(p)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          </React.Suspense>
        ) : currentUser.role === 'SALES_REP' ? (
          // ================= SALES REPRESENTATIVE DESK =================
          <React.Suspense fallback={<DashboardSkeleton />}>
            <SalesPortal currentUser={currentUser} />
          </React.Suspense>
        ) : isManagerOrCoordinator ? (
          // ================= MANAGER / COORDINATOR VIEW =================
          <div className="flex gap-6 pb-20 lg:pb-6">
            <Sidebar
              activeTab={activeTab}
              onSelectTab={(tab) => setActiveTab(tab)}
              userRole={currentUser.role}
              pendingQcCount={pendingQcCount}
              openStuckCount={openStuckCount}
              openTicketCount={openTicketCount}
              pendingMaterialCount={pendingMaterialCount}
              actionQueueCount={actionQueueCount}
            />

            <div className="flex-1 min-w-0">
              <React.Suspense fallback={<DashboardSkeleton />}>
                {activeTab === 'registry' && (
                  isCeo || isQcManager ? (
                    <CeoMasterRegistry
                      currentUser={currentUser}
                      projects={projects}
                      users={users}
                      fetchAudit={(id) => SupabaseSyncService.fetchProjectAudit(id)}
                    />
                  ) : (
                    <div className="bg-surface border border-rose-500/30 rounded-2xl p-8 text-center text-rose-400 space-y-2">
                      <p className="font-bold text-base">دسترسی غیرمجاز</p>
                      <p className="text-xs text-ink-2">
                        مشاهده شناسنامه رسمی و داشبورد جامع مدیر کل منحصراً در اختیار مدیرعامل و مدیر QC است.
                      </p>
                    </div>
                  )
                )}

                {activeTab === 'control' && (
                  <OperationsControlCenter
                    currentUser={currentUser}
                    projects={projects}
                    users={users}
                    tickets={tickets}
                    teamsWithMembers={teamsWithMembers}
                    scheduleChangeRequests={scheduleChangeRequests}
                    materialRequests={materialRequests}
                    settings={settings}
                    onNavigateTab={(tab) => setActiveTab(tab)}
                    onOpenProject={(p) => setManagedProjectId(p.id)}
                    onOpenQcProject={(p) => {
                      setSelectedQcProjectId(p.id);
                      setActiveTab('qc');
                    }}
                    onOpenScheduleRequests={() => setActiveTab('planner')}
                    onNewProject={handleOpenNewProject}
                  />
                )}

                {activeTab === 'planner' && (
                  <MonthPlanner
                    projects={projects}
                    users={users}
                    teams={teamsWithMembers}
                    currentUser={currentUser}
                    settings={settings}
                    scheduleChangeRequests={scheduleChangeRequests}
                    onUpdateSettings={isCeo ? undefined : handleUpdateSettings}
                    onNewProject={isCeo ? undefined : handleOpenNewProject}
                    onEditProject={isCeo ? undefined : handleOpenEditProject}
                    onManageProject={(p) => setManagedProjectId(p.id)}
                    onMoveProjectDate={isCeo ? undefined : handleMoveProjectDate}
                    onViewProposal={(p) => setProposalModalProject(p)}
                    onOpenPreInspection={(p) => setPreInspectionProject(p)}
                    onProposeScheduleChange={isCeo ? undefined : handleProposeScheduleChange}
                    onReviewScheduleChange={isCeo ? undefined : handleReviewScheduleChange}
                  />
                )}

                {activeTab === 'qc' && (
                  <QcDesk
                    projects={projects}
                    users={users}
                    currentUser={currentUser}
                    selectedProjectId={selectedQcProjectId}
                    onSelectProject={setSelectedQcProjectId}
                    onPatchProject={handlePatchProject}
                    onViewProposal={(p) => setProposalModalProject(p)}
                    onOpenCertificate={(p) => setCertificateModalProject(p)}
                    onOpenEvaluation={(p) => setEvaluationProject(p)}
                    onManageProject={(p) => setManagedProjectId(p.id)}
                  />
                )}

                {activeTab === 'stuck' && (
                  <StuckProjectsDesk
                    projects={projects}
                    currentUser={currentUser}
                    onPatchProject={handlePatchProject}
                    onManageProject={(p) => setManagedProjectId(p.id)}
                    onReferToWarehouse={handleReferProjectToWarehouse}
                  />
                )}

                {activeTab === 'tickets' && (
                  <TicketCenter
                    tickets={tickets}
                    currentUser={currentUser || undefined}
                    users={users}
                    onUpdateTicket={handleUpdateTicket}
                    onNavigateTab={(tab) => setActiveTab(tab)}
                  />
                )}

                {activeTab === 'materials' && (
                  <MaterialCenter
                    materialRequests={materialRequests}
                    currentUser={currentUser}
                    users={users}
                    tickets={tickets}
                    projects={projects}
                    onUpdateMaterialRequest={handleUpdateMaterialRequest}
                    onResolveTicket={handleResolveWarehouseTicket}
                    onConfirmPacking={handleConfirmWarehousePacking}
                    onConfirmGoodsReceipt={handleConfirmWarehouseReceipt}
                    onViewProposal={(p) => setProposalModalProject(p)}
                    onOpenTicketModal={(p) => setTicketModalProject(p)}
                    onNavigateTab={(tab) => setActiveTab(tab)}
                  />
                )}

                {activeTab === 'technicians' && (
                  <TechniciansManager
                    users={users}
                    teams={teams}
                    teamMembers={teamMembers}
                    currentUserId={currentUser.id}
                    onSaveUser={handleSaveUser}
                    onDeleteUser={handleDeleteUser}
                    onAssignTeamMember={handleAssignTeamMember}
                    onRemoveTeamMember={handleRemoveTeamMember}
                    onCreateTeam={handleCreateTeam}
                    onDeleteTeam={handleDeleteTeam}
                    onImpersonateUser={currentUser.role === 'CEO' || currentUser.role === 'QC_MANAGER' || Boolean(impersonatorCeo) ? handleImpersonateUser : undefined}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsView
                    settings={settings}
                    projects={projects}
                    onUpdateProjects={setProjects}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={handleToggleDarkMode}
                    onUpdateSettings={handleUpdateSettings}
                    onResetData={handleResetData}
                    canEditCapacity={isQcManager}
                    definedTeamCount={teams.length}
                  />
                )}

                {activeTab === 'sales' && (
                  <SalesPortal currentUser={currentUser} />
                )}
              </React.Suspense>
            </div>

            <BottomNav
              activeTab={activeTab}
              onSelectTab={(tab) => setActiveTab(tab)}
              userRole={currentUser.role}
              pendingQcCount={pendingQcCount}
              openStuckCount={openStuckCount}
              openTicketCount={openTicketCount}
              pendingMaterialCount={pendingMaterialCount}
              actionQueueCount={actionQueueCount}
            />
          </div>
        ) : (
          // ================= TECHNICIAN & LEAD VIEW =================
          <div className="max-w-3xl mx-auto pb-8">
            <TechnicianDashboard
              currentUser={currentUser}
              settings={settings}
              projects={projects}
              onViewProposal={(p) => setProposalModalProject(p)}
              onOpenToolChecklist={(p) => setToolChecklistProject(p)}
              onOpenTicketModal={(p) => setTicketModalProject(p)}
              onOpenCompletionModal={(p) => setCompletionModalProject(p)}
              onOpenDailyLogModal={(p) => setDailyLogModalProject(p)}
              onUpdateStatus={transitionStatus}
              onSavePreInstallPhotosAndStart={handleSavePreInstallPhotosAndStart}
              inFlightTransitions={inFlightTransitions}
              onOpenCertificate={(p) => setCertificateModalProject(p)}
              onReportStuck={handleReportStuck}
              onConfirmTransfer={handleConfirmTransferReceipt}
              materialRequests={materialRequests}
              onOpenMaterialModal={(p) => setMaterialModalProject(p)}
              onConfirmMaterialReceipt={handleConfirmMaterialReceipt}
              onResolveDefect={handleResolveDefect}
              tickets={tickets}
            />
          </div>
        )}
      </main>

      {/* Modals with Lazy Suspense */}
      <React.Suspense fallback={null}>
        {isProjectFormOpen && (
          <ProjectFormModal
            project={editingProject}
            initialData={projectFormInitialData}
            defaultDate={presetDateKey}
            users={users}
            teams={teams}
            teamMembers={teamMembers}
            settings={settings}
            onClose={() => {
              setIsProjectFormOpen(false);
              setEditingProject(null);
              setProjectFormInitialData(null);
              setPresetDateKey(undefined);
            }}
            onSave={handleSaveProject}
          />
        )}

        {proposalModalProject && (
          <ProposalViewerModal
            images={proposalModalProject.proposalImages}
            projectTitle={proposalModalProject.title}
            onClose={() => setProposalModalProject(null)}
          />
        )}

        {toolChecklistProject && (
          <ToolChecklistDrawer
            project={toolChecklistProject}
            onClose={() => setToolChecklistProject(null)}
          />
        )}

        {ticketModalProject && (
          <TicketModal
            project={ticketModalProject}
            currentUser={currentUser}
            onClose={() => setTicketModalProject(null)}
            onSubmit={handleCreateTicket}
          />
        )}

        {materialModalProject && currentUser && (
          <MaterialRequestModal
            project={materialModalProject}
            currentUser={currentUser}
            onClose={() => setMaterialModalProject(null)}
            onSubmit={handleCreateMaterialRequest}
          />
        )}

        {completionModalProject && (
          <ReportCompletionModal
            project={completionModalProject}
            currentUser={currentUser || undefined}
            onClose={() => setCompletionModalProject(null)}
            onSubmit={handleReportCompletion}
          />
        )}

        {(isQcManager || isCoordinator || isCeo) && managedProjectId && currentUser && (() => {
          const managed = projects.find((p) => p.id === managedProjectId);
          if (!managed) return null;
          if (currentUser.role === 'CEO') {
            return (
              <ProjectDossierModal
                project={managed}
                users={users}
                onClose={() => setManagedProjectId(null)}
                fetchAudit={(id) => SupabaseSyncService.fetchProjectAudit(id)}
                onPrintCertificate={() => {
                  const targetProj = managed;
                  setManagedProjectId(null);
                  const isQcApproved = targetProj.status === 'COMPLETED' && targetProj.qcStatus === 'APPROVED';
                  if (!isQcApproved) {
                    showToast(
                      'warning',
                      'چاپ شناسنامه رسمی منحصراً پس از اتمام کامل پروژه و صدور تأییدیه نهایی کنترل کیفی (QC) مجاز می‌باشد.'
                    );
                    return;
                  }
                  setPrintingPassportProject(targetProj);
                }}
              />
            );
          }
          return (
            <ProjectManagerSheet
              project={managed}
              users={users}
              tickets={tickets}
              teams={teamsWithMembers}
              currentUser={currentUser}
              isOnline={typeof navigator === 'undefined' || navigator.onLine}
              onClose={() => setManagedProjectId(null)}
              onEditInfo={(p) => handleOpenEditProject(p)}
              onApplyPatch={handleManagerPatch}
              onDeleteProject={isCeo || isQcManager ? handleManagerDelete : undefined}
              onOpenCertificate={(p) => setCertificateModalProject(p)}
              onViewProposal={(p) => setProposalModalProject(p)}
              fetchAudit={(id) => SupabaseSyncService.fetchProjectAudit(id)}
            />
          );
        })()}

        {dailyLogModalProject && (
          <DailyLogModal
            project={dailyLogModalProject}
            currentUser={currentUser}
            isOpen={!!dailyLogModalProject}
            onClose={() => setDailyLogModalProject(null)}
            onSubmit={handleEndDailyWork}
          />
        )}

        {certificateModalProject && (
          <HandoverCertificateModal
            project={certificateModalProject}
            users={users}
            onClose={() => setCertificateModalProject(null)}
          />
        )}

        {printingPassportProject && (
          <ProjectPassportPrint
            project={printingPassportProject}
            users={users}
            onClose={() => setPrintingPassportProject(null)}
          />
        )}

        {preInspectionProject && (
          <PreInstallationModal
            project={preInspectionProject}
            currentUser={currentUser}
            isOpen={!!preInspectionProject}
            onClose={() => setPreInspectionProject(null)}
            onSaveInspection={handleSavePreInspection}
            onCreateTicket={({ projectId, title, description }) => {
              const ticketId = 't-' + Date.now();
              const proj = projects.find((p) => p.id === projectId);
              handleCreateTicket({
                id: ticketId,
                projectId,
                projectCode: proj?.code || '',
                projectTitle: proj?.title || '',
                authorId: currentUser?.id || '',
                authorName: currentUser?.name || '',
                type: 'WALL_ISSUE',
                description: `${title}: ${description}`,
                photos: [],
                status: 'OPEN',
                createdAt: new Date().toISOString(),
              });
              showToast('success', 'تیکت نقص بستر با موفقیت ایجاد شد.');
            }}
          />
        )}

        {evaluationProject && (
          <PersonnelEvaluationModal
            project={evaluationProject}
            users={users}
            currentUser={currentUser}
            isOpen={!!evaluationProject}
            onClose={() => setEvaluationProject(null)}
            onSaveEvaluation={handleSaveEvaluation}
          />
        )}

        {stuckModalProject && (
          <ReportStuckModal
            project={stuckModalProject}
            isOpen={!!stuckModalProject}
            reporterName={getDisplayName(currentUser.name)}
            onClose={() => setStuckModalProject(null)}
            onSubmit={handleConfirmReportStuck}
          />
        )}

        {/* Failed Operations Modal for QC Manager */}
        <FailedOperationsModal
          isOpen={isFailedOpsModalOpen}
          onClose={() => setIsFailedOpsModalOpen(false)}
          currentUserId={currentUser?.id}
          onActionComplete={() => {
            const uid = currentUser?.id;
            OfflineQueue.getFailedCount(uid).then(setFailedQueueCount);
            OfflineQueue.getPendingCount(uid).then(setPendingQueueCount);
          }}
        />

        {/* Pending Operations Modal */}
        <PendingOperationsModal
          isOpen={isPendingOpsModalOpen}
          onClose={() => setIsPendingOpsModalOpen(false)}
          currentUserId={currentUser?.id}
          onActionComplete={() => {
            const uid = currentUser?.id;
            OfflineQueue.getFailedCount(uid).then(setFailedQueueCount);
            OfflineQueue.getPendingCount(uid).then(setPendingQueueCount);
          }}
        />
      </React.Suspense>

      {/* Floating System Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default App;
