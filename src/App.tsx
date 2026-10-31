import React, { useState, useEffect, useRef } from 'react';
import {
  Project,
  User,
  Ticket,
  SystemSettings,
  HandoverChecklist,
  PreInstallationInspection,
  PersonnelEvaluation,
  StuckIncident,
} from './types';
import { StorageService } from './utils/storage';
import { SupabaseSyncService } from './utils/supabase';
import { Outbox, OutboxMutation, OfflineQueue } from './utils/offlineQueue';
import {
  validateProjectPatchRoleGuards,
  validateTicketRoleGuards,
  validateEvaluationRoleGuards,
  isValidStatusTransition,
} from './utils/roleGuards';
import { Header } from './components/Header';
import { FailedOperationsModal } from './components/admin/FailedOperationsModal';
import { LoginModal } from './components/LoginModal';
import { ProposalViewerModal } from './components/ProposalViewerModal';
import { TicketModal } from './components/TicketModal';
import { MonthPlanner } from './components/admin/MonthPlanner';
import { ProjectFormModal, ProjectFormSaveData } from './components/admin/ProjectFormModal';
import { QcDesk } from './components/admin/QcDesk';
import { TicketCenter } from './components/admin/TicketCenter';
import { TechniciansManager } from './components/admin/TechniciansManager';
import { SettingsView } from './components/admin/SettingsView';
import { StuckProjectsDesk } from './components/admin/StuckProjectsDesk';
import { PreInstallationModal } from './components/admin/PreInstallationModal';
import { PersonnelEvaluationModal } from './components/admin/PersonnelEvaluationModal';
import { TechnicianDashboard } from './components/technician/TechnicianDashboard';
import { ToolChecklistDrawer } from './components/technician/ToolChecklistDrawer';
import { ReportCompletionModal } from './components/technician/ReportCompletionModal';
import { HandoverCertificateModal } from './components/HandoverCertificateModal';
import { ReportStuckModal } from './components/technician/ReportStuckModal';
import { Toast, ToastMessage } from './components/Toast';

export const App: React.FC = () => {
  // Session & Authentication via Supabase Auth
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [isSyncedWithServer, setIsSyncedWithServer] = useState<boolean>(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [failedQueueCount, setFailedQueueCount] = useState<number>(0);
  const [isFailedOpsModalOpen, setIsFailedOpsModalOpen] = useState<boolean>(false);

  const [users, setUsers] = useState<User[]>(() => StorageService.getUsers());
  const [projects, setProjects] = useState<Project[]>(() => StorageService.getProjects());
  const [tickets, setTickets] = useState<Ticket[]>(() => StorageService.getTickets());
  const [settings, setSettings] = useState<SystemSettings>(() => StorageService.getSettings());

  // Keep a synchronous ref of projects for predictable state updates in handlers
  const projectsRef = useRef<Project[]>(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  // Request sequence tracker to drop stale server responses
  const fetchSeqRef = useRef<number>(0);
  const isSyncedWithServerRef = useRef<boolean>(false);
  useEffect(() => {
    isSyncedWithServerRef.current = isSyncedWithServer;
  }, [isSyncedWithServer]);

  // Subscribe to offline operations queue counts
  useEffect(() => {
    const unsubPending = OfflineQueue.subscribePendingCount((count) => {
      setPendingQueueCount(count);
    });
    const unsubFailed = OfflineQueue.subscribeFailedCount((count) => {
      setFailedQueueCount(count);
    });
    return () => {
      unsubPending();
      unsubFailed();
    };
  }, []);

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
      setCurrentUser(user);
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

    setIsSyncedWithServer(false);

    // 1. Fetch initial server data after login
    const loadCloudData = async () => {
      const currentSeq = ++fetchSeqRef.current;
      try {
        const [cloudProjects, cloudTickets, cloudUsers, cloudSettings] = await Promise.all([
          SupabaseSyncService.fetchProjects(),
          SupabaseSyncService.fetchTickets(),
          SupabaseSyncService.fetchProfiles(),
          SupabaseSyncService.fetchSettings(),
        ]);

        if (currentSeq !== fetchSeqRef.current) return;

        // Merge any pending outbox operations so unsent local mutations don't vanish
        const mergedProjects = await Outbox.applyPendingToProjects(cloudProjects);
        const mergedTickets = await Outbox.applyPendingToTickets(cloudTickets);
        const mergedSettings = cloudSettings
          ? await Outbox.applyPendingToSettings(cloudSettings)
          : undefined;

        if (currentSeq !== fetchSeqRef.current) return;

        setProjects(mergedProjects);
        projectsRef.current = mergedProjects;
        setTickets(mergedTickets);
        if (cloudUsers.length > 0) {
          setUsers(cloudUsers);
        }
        if (mergedSettings) {
          setSettings((prev) => ({ ...prev, ...mergedSettings }));
        }
        setIsSyncedWithServer(true);
        setIsOfflineMode(false);

        // Attempt processing any pending offline operations
        SupabaseSyncService.processOfflineQueue(currentUser.id);
      } catch (err) {
        if (currentSeq !== fetchSeqRef.current) return;
        console.warn('Initial cloud fetch error (running in offline mode with cached data):', err);
        // Retain existing cached projects & tickets in state
        setIsSyncedWithServer(false);
        setIsOfflineMode(true);
      }
    };

    loadCloudData();

    // Re-try fetching cloud data on online event and trigger offline sync
    const handleOnline = () => {
      loadCloudData();
      SupabaseSyncService.processOfflineQueue(currentUser?.id);
    };
    window.addEventListener('online', handleOnline);

    const handleSyncTrigger = () => {
      SupabaseSyncService.processOfflineQueue(currentUser?.id);
    };
    window.addEventListener('talaie-trigger-offline-sync', handleSyncTrigger);

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
        setProjects((prev) => {
          if (prev.some((p) => p.id === newProject.id)) return prev;
          const next = [newProject, ...prev];
          projectsRef.current = next;
          return next;
        });
      },
      onUpdate: (updatedProject) => {
        setProjects((prev) => {
          const existing = prev.find((p) => p.id === updatedProject.id);
          if (!existing) {
            const next = [updatedProject, ...prev];
            projectsRef.current = next;
            return next;
          }
          // Conflict resolution: Ignore cloud update if local update is newer
          const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const cloudTime = updatedProject.updatedAt ? new Date(updatedProject.updatedAt).getTime() : 0;
          if (localTime > cloudTime) {
            return prev;
          }
          const next = prev.map((p) => (p.id === updatedProject.id ? updatedProject : p));
          projectsRef.current = next;
          return next;
        });
      },
      onDelete: (deletedId) => {
        setProjects((prev) => {
          const next = prev.filter((p) => p.id !== deletedId);
          projectsRef.current = next;
          return next;
        });
      },
    });

    const unsubTickets = SupabaseSyncService.subscribeTickets({
      onInsert: (newTicket) => {
        setTickets((prev) => {
          if (prev.some((t) => t.id === newTicket.id)) return prev;
          return [newTicket, ...prev];
        });
      },
      onUpdate: (updatedTicket) => {
        setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
      },
      onDelete: (deletedId) => {
        setTickets((prev) => prev.filter((t) => t.id !== deletedId));
      },
    });

    const unsubSettings = SupabaseSyncService.subscribeSettings((cloudSettings) => {
      setSettings((prev) => ({ ...prev, ...cloudSettings }));
    });

    const unsubProfiles = SupabaseSyncService.subscribeProfiles((updatedProfiles) => {
      if (updatedProfiles.length > 0) {
        setUsers(updatedProfiles);
        setCurrentUser((prevUser) => {
          if (!prevUser) return null;
          const currentProfile = updatedProfiles.find((p) => p.id === prevUser.id);
          if (!currentProfile || !currentProfile.active) {
            SupabaseSyncService.signOut();
            return null;
          }
          return currentProfile;
        });
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('talaie-trigger-offline-sync', handleSyncTrigger);
      clearInterval(intervalId);
      unsubProjects();
      unsubTickets();
      unsubSettings();
      unsubProfiles();
    };
  }, [currentUser?.id, authChecking]);

  // Navigation tab for QC Manager
  const [activeTab, setActiveTab] = useState<string>('planner');

  // Dark Mode state with persistence and system detection
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('talaie_theme');
    if (saved) return saved === 'dark';
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('talaie_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('talaie_theme', 'light');
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = () => setIsDarkMode((prev) => !prev);

  // Modals
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [presetDateKey, setPresetDateKey] = useState<string | undefined>(undefined);

  // Viewer and action modals
  const [proposalModalProject, setProposalModalProject] = useState<Project | null>(null);
  const [toolChecklistProject, setToolChecklistProject] = useState<Project | null>(null);
  const [ticketModalProject, setTicketModalProject] = useState<Project | null>(null);
  const [completionModalProject, setCompletionModalProject] = useState<Project | null>(null);
  const [certificateModalProject, setCertificateModalProject] = useState<Project | null>(null);
  const [preInspectionProject, setPreInspectionProject] = useState<Project | null>(null);
  const [evaluationProject, setEvaluationProject] = useState<Project | null>(null);
  const [stuckModalProject, setStuckModalProject] = useState<Project | null>(null);

  // Modern Toast notification system
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (type: ToastMessage['type'], message: string) => {
    setToast({ type, message });
  };

  // Lightweight local storage caching (only when user is active session)
  useEffect(() => {
    if (currentUser) {
      StorageService.saveProjects(projects);
    }
  }, [projects, currentUser]);

  useEffect(() => {
    if (currentUser) {
      StorageService.saveTickets(tickets);
    }
  }, [tickets, currentUser]);

  useEffect(() => {
    if (currentUser) {
      StorageService.saveSettings(settings);
    }
  }, [settings, currentUser]);

  // Unified single write path (Outbox Pattern)
  const commit = async (
    mutation: OutboxMutation,
    onOptimisticApply: () => void
  ): Promise<boolean> => {
    if (!currentUser) return false;

    // Client-side role guards: validate before pushing to outbox
    if (currentUser.role !== 'QC_MANAGER') {
      if (mutation.type === 'PATCH_PROJECT') {
        const projectId = mutation.payload?.id || mutation.orderingKey.replace('project:', '');
        const currentProject = projectsRef.current.find((p) => p.id === projectId);
        if (currentProject) {
          const patch = mutation.payload?.patch || mutation.payload;
          try {
            validateProjectPatchRoleGuards(currentUser, currentProject, patch);
          } catch (err: any) {
            showToast('error', err.message || 'خطای عدم دسترسی نقش.');
            return false;
          }
        }
      } else if (mutation.type === 'CREATE_PROJECT' || mutation.type === 'DELETE_PROJECT') {
        showToast('error', 'تنها مدیر ارشد QC مجاز به ثبت یا حذف مستقیم پروژه است.');
        return false;
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
      }
    }

    try {
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
    if (!isSyncedWithServer) {
      showToast('warning', 'اطلاعات در حال دریافت از سرور است، لطفاً شکیبا باشید.');
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
        }
      );
      showToast('success', 'پروژه جدید با موفقیت ثبت شد.');
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

  const handleDeleteProject = async (projectId: string) => {
    if (!currentUser) return;
    if (!isSyncedWithServer) {
      showToast('warning', 'اطلاعات در حال دریافت از سرور است، لطفاً شکیبا باشید.');
      return;
    }

    await commit(
      {
        type: 'DELETE_PROJECT',
        orderingKey: `project:${projectId}`,
        payload: { id: projectId },
      },
      () => {
        const next = projectsRef.current.filter((p) => p.id !== projectId);
        setProjects(next);
        projectsRef.current = next;
      }
    );
    showToast('success', 'پروژه با موفقیت حذف گردید.');
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

    // Acquire lock synchronously before any await
    transitioningLockRef.current.add(projectId);
    setInFlightTransitions((prev) => new Set(prev).add(projectId));

    const patch: Partial<Project> = {
      status: to,
      updatedAt: new Date().toISOString(),
    };
    if (to === 'IN_PROGRESS' && !current.startedAt) {
      patch.startedAt = new Date().toISOString();
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

  // Completion report from field
  const handleReportCompletion = async (completionData: {
    completionNotes: string;
    beforePhotos: string[];
    afterPhotos: string[];
    completionPhotos: string[];
    handoverChecklist: HandoverChecklist;
    customerSignature?: string;
    customerSatisfaction?: number;
  }) => {
    if (!completionModalProject || !currentUser) return;
    const projectId = completionModalProject.id;

    const patch: Partial<Project> = {
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      completionNotes: completionData.completionNotes,
      beforePhotos: completionData.beforePhotos,
      afterPhotos: completionData.afterPhotos,
      completionPhotos: completionData.completionPhotos,
      handoverChecklist: completionData.handoverChecklist,
      customerSignature: completionData.customerSignature,
      customerSatisfaction: completionData.customerSatisfaction,
      completedAt: new Date().toISOString(),
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
        setCompletionModalProject(null);
      }
    );
    showToast('success', 'گزارش اتمام کار با موفقیت ثبت شد و به دسک QC ارسال گردید.');
  };

  // Pre-Installation inspection & 2nd measurement handler
  const handleSavePreInspection = async (
    inspection: PreInstallationInspection,
    newScheduledDate?: string
  ) => {
    if (!preInspectionProject || !currentUser) return;
    const projectId = preInspectionProject.id;
    const current = projectsRef.current.find((p) => p.id === projectId);

    const patch: Partial<Project> = {
      scheduledDate: newScheduledDate || current?.scheduledDate,
      preInspection: inspection,
      updatedAt: new Date().toISOString(),
    };

    // Only change status if current status is MEASUREMENT_PENDING or SCHEDULED
    if (current && (current.status === 'MEASUREMENT_PENDING' || current.status === 'SCHEDULED')) {
      patch.status = (inspection.status === 'APPROVED' ? 'SCHEDULED' : 'MEASUREMENT_PENDING') as Project['status'];
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
    showToast('success', 'گزارش کارشناسی فضا و اندازه‌گیری دوم با موفقیت در سرور ثبت شد.');
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

  // On-site acute stoppage / Stuck report handler (<72h KPI)
  const handleReportStuck = (project: Project) => {
    setStuckModalProject(project);
  };

  const handleConfirmReportStuck = async (incident: StuckIncident) => {
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
    showToast('warning', 'پروژه به دسک رفع استاک (<72h) ارسال شد و بلافاصله به مسئولین فنی ارجاع یافت.');
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
    const exists = users.some((u) => u.id === user.id);
    let updated: User[];
    if (exists) {
      updated = users.map((u) => (u.id === user.id ? user : u));
    } else {
      updated = [...users, user];
    }
    setUsers(updated);
    StorageService.saveUsers(updated);
  };

  const handleDeleteUser = (userId: string) => {
    setUsers((prev) => {
      const filtered = prev.filter((u) => u.id !== userId);
      StorageService.saveUsers(filtered);
      return filtered;
    });
  };

  // Clear local device cache & reload from cloud
  const handleResetData = () => {
    if (confirm('آیا مایلید حافظه محلی (کش) این مرورگر پاک‌سازی شود و داده‌ها مجدداً از سرور ابری دریافت شوند؟')) {
      StorageService.resetAll();
      window.location.reload();
    }
  };

  // Open Project Form Modal
  const handleOpenNewProject = (dateKey?: string) => {
    setEditingProject(null);
    setPresetDateKey(dateKey);
    setIsProjectFormOpen(true);
  };

  const handleOpenEditProject = (project: Project) => {
    setEditingProject(project);
    setIsProjectFormOpen(true);
  };

  const handleLogout = async () => {
    if (pendingQueueCount > 0) {
      const confirmed = window.confirm(
        'تغییرات ذخیره‌نشده روی این دستگاه دارید که در صورت خروج ممکن است بعداً با اکانت دیگر ارسال نشود. آیا مطمئن هستید که می‌خواهید خارج شوید؟'
      );
      if (!confirmed) {
        return;
      }
    }
    await SupabaseSyncService.signOut();
    setCurrentUser(null);
    setProjects([]);
    projectsRef.current = [];
    setTickets([]);
    setIsSyncedWithServer(false);
    StorageService.saveProjects([]);
    StorageService.saveTickets([]);
    showToast('info', 'با موفقیت از حساب کاربری خارج شدید.');
  };

  // Splash screen while checking persistent session
  if (authChecking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#121212] text-[#C1A056] p-4">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-3xl bg-[#1A1A1A] border-2 border-[#C1A056] flex items-center justify-center p-3 shadow-2xl">
            <img
              src="./talaei-lion-gold.png"
              alt="نشان گالری طلایی"
              className="w-full h-full object-contain animate-pulse"
            />
          </div>
          <div className="text-center">
            <div className="text-base font-black text-white">سامانه گالری طلایی</div>
            <div className="text-xs text-[#C1A056] mt-1 font-mono">در حال بررسی نشست کاربری...</div>
          </div>
        </div>
      </div>
    );
  }

  // If no user is authenticated, render the dedicated secure login page
  if (!currentUser) {
    return (
      <LoginModal
        users={users}
        isOpen={true}
        isStandalone={true}
        onSelectUser={(u) => {
          setCurrentUser(u);
        }}
      />
    );
  }

  // Counters for alerts with synchronized QC status logic
  const openTicketCount = tickets.filter((t) => t.status === 'OPEN').length;
  const isStuckOpen = (p: Project) =>
    p.status === 'STUCK' ||
    (p.stuckIncident && p.stuckIncident.resolutionStatus !== 'RESOLVED');
  const openStuckCount = projects.filter(isStuckOpen).length;
  const isAwaitingQc = (p: Project) =>
    (p.status === 'COMPLETED' || p.qcStatus === 'PENDING') &&
    p.qcStatus !== 'APPROVED' &&
    p.qcStatus !== 'REJECTED';
  const pendingQcCount = projects.filter(isAwaitingQc).length;

  const isQcManager = currentUser.role === 'QC_MANAGER';

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#121212] text-[#212121] dark:text-[#F5EFEB] flex flex-col font-sans selection:bg-[#C1A056] selection:text-white transition-colors duration-200">
      {/* Skip to Content for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#C1A056] focus:text-[#212121] focus:font-black focus:rounded-xl focus:shadow-xl focus:ring-2 focus:ring-[#212121]"
      >
        پرش به محتوای اصلی صفحه
      </a>

      {/* App Header */}
      <Header
        currentUser={currentUser}
        users={users}
        settings={settings}
        openTicketCount={openTicketCount}
        openStuckCount={openStuckCount}
        pendingQcCount={pendingQcCount}
        pendingQueueCount={pendingQueueCount}
        failedQueueCount={failedQueueCount}
        onOpenFailedOperations={() => setIsFailedOpsModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onLogout={handleLogout}
        onResetData={handleResetData}
        onOpenSettings={() => setActiveTab('settings')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Offline state or syncing banner */}
      {isOfflineMode ? (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs py-2 px-4 text-center font-bold flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>حالت آفلاین — اطلاعات ممکن است قدیمی باشد. تغییرات تکنسین‌ها در صف ذخیره شده و پس از برقراری اینترنت به سرور ارسال خواهد شد.</span>
        </div>
      ) : !isSyncedWithServer ? (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs py-2 px-4 text-center font-bold flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>در حال دریافت و همگام‌سازی اطلاعات با سرور ابری... انجام ویرایش کلی پروژه‌ها پس از همگام‌سازی کامل فعال می‌گردد.</span>
        </div>
      ) : null}

      {/* Main Body */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 focus:outline-none">
        {isQcManager ? (
          // ================= QC MANAGER VIEW =================
          <div>
            {activeTab === 'planner' && (
              <MonthPlanner
                projects={projects}
                users={users}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onNewProject={handleOpenNewProject}
                onEditProject={handleOpenEditProject}
                onDeleteProject={handleDeleteProject}
                onMoveProjectDate={handleMoveProjectDate}
                onViewProposal={(p) => setProposalModalProject(p)}
                onOpenPreInspection={(p) => setPreInspectionProject(p)}
              />
            )}

            {activeTab === 'qc' && (
              <QcDesk
                projects={projects}
                users={users}
                currentUser={currentUser}
                onPatchProject={handlePatchProject}
                onViewProposal={(p) => setProposalModalProject(p)}
                onOpenCertificate={(p) => setCertificateModalProject(p)}
                onOpenEvaluation={(p) => setEvaluationProject(p)}
              />
            )}

            {activeTab === 'stuck' && (
              <StuckProjectsDesk
                projects={projects}
                currentUser={currentUser}
                onPatchProject={handlePatchProject}
              />
            )}

            {activeTab === 'tickets' && (
              <TicketCenter
                tickets={tickets}
                onUpdateTicket={handleUpdateTicket}
              />
            )}

            {activeTab === 'technicians' && (
              <TechniciansManager
                users={users}
                onSaveUser={handleSaveUser}
                onDeleteUser={handleDeleteUser}
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
              />
            )}
          </div>
        ) : (
          // ================= TECHNICIAN & LEAD VIEW =================
          <TechnicianDashboard
            currentUser={currentUser}
            settings={settings}
            projects={projects}
            onViewProposal={(p) => setProposalModalProject(p)}
            onOpenToolChecklist={(p) => setToolChecklistProject(p)}
            onOpenTicketModal={(p) => setTicketModalProject(p)}
            onOpenCompletionModal={(p) => setCompletionModalProject(p)}
            onUpdateStatus={transitionStatus}
            inFlightTransitions={inFlightTransitions}
            onOpenCertificate={(p) => setCertificateModalProject(p)}
            onReportStuck={handleReportStuck}
          />
        )}
      </main>

      {/* Modals */}
      {isProjectFormOpen && (
        <ProjectFormModal
          project={editingProject}
          defaultDate={presetDateKey}
          users={users}
          settings={settings}
          onClose={() => {
            setIsProjectFormOpen(false);
            setEditingProject(null);
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

      {completionModalProject && (
        <ReportCompletionModal
          project={completionModalProject}
          onClose={() => setCompletionModalProject(null)}
          onSubmit={handleReportCompletion}
        />
      )}

      {certificateModalProject && (
        <HandoverCertificateModal
          project={certificateModalProject}
          users={users}
          onClose={() => setCertificateModalProject(null)}
        />
      )}

      {preInspectionProject && (
        <PreInstallationModal
          project={preInspectionProject}
          currentUser={currentUser}
          isOpen={!!preInspectionProject}
          onClose={() => setPreInspectionProject(null)}
          onSaveInspection={handleSavePreInspection}
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
          reporterName={currentUser.name}
          onClose={() => setStuckModalProject(null)}
          onSubmit={handleConfirmReportStuck}
        />
      )}

      {/* Failed Operations Modal for QC Manager */}
      <FailedOperationsModal
        isOpen={isFailedOpsModalOpen}
        onClose={() => setIsFailedOpsModalOpen(false)}
        onActionComplete={() => {
          OfflineQueue.getFailedCount().then(setFailedQueueCount);
          OfflineQueue.getPendingCount().then(setPendingQueueCount);
        }}
      />

      {/* Floating System Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default App;
