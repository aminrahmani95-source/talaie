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
import { OfflineQueue } from './utils/offlineQueue';
import { Header } from './components/Header';
import { FailedOperationsModal } from './components/admin/FailedOperationsModal';
import { LoginModal } from './components/LoginModal';
import { ProposalViewerModal } from './components/ProposalViewerModal';
import { TicketModal } from './components/TicketModal';
import { MonthPlanner } from './components/admin/MonthPlanner';
import { ProjectFormModal } from './components/admin/ProjectFormModal';
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
      try {
        const [cloudProjects, cloudTickets, cloudUsers, cloudSettings] = await Promise.all([
          SupabaseSyncService.fetchProjects(),
          SupabaseSyncService.fetchTickets(),
          SupabaseSyncService.fetchProfiles(),
          SupabaseSyncService.fetchSettings(),
        ]);

        setProjects(cloudProjects);
        projectsRef.current = cloudProjects;
        setTickets(cloudTickets);
        if (cloudUsers.length > 0) {
          setUsers(cloudUsers);
        }
        if (cloudSettings) {
          setSettings((prev) => ({ ...prev, ...cloudSettings }));
        }
        setIsSyncedWithServer(true);
        setIsOfflineMode(false);

        // Attempt processing any pending offline operations
        SupabaseSyncService.processOfflineQueue();
      } catch (err) {
        console.warn('Initial cloud fetch error (running in offline mode with cached data):', err);
        // Retain existing cached projects & tickets in state
        setIsSyncedWithServer(false);
        setIsOfflineMode(true);
      }
    };

    loadCloudData();

    // Re-try fetching cloud data on online event and periodic 30s timer
    const handleOnline = () => {
      loadCloudData();
      SupabaseSyncService.processOfflineQueue();
    };
    window.addEventListener('online', handleOnline);

    const intervalId = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        loadCloudData();
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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
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

  // Project handlers
  const handleSaveProject = async (project: Project) => {
    if (!isSyncedWithServer) {
      showToast('warning', 'اطلاعات در حال دریافت از سرور است، لطفاً شکیبا باشید.');
      return;
    }

    if (project.__fromCache) {
      showToast('warning', 'این پروژه هنوز از سرور دریافت نشده است و قابل ویرایش نیست.');
      return;
    }

    const currentList = projectsRef.current;
    const existing = currentList.find((p) => p.id === project.id);
    let updatedProject: Project;

    if (existing) {
      // Merge ONLY edited fields over the live project state to prevent wiping technician reports/photos
      updatedProject = {
        ...existing,
        title: project.title,
        customerName: project.customerName,
        customerPhone: project.customerPhone,
        address: project.address,
        locationUrl: project.locationUrl,
        shadePanels: project.shadePanels,
        curtainPanels: project.curtainPanels,
        mechanismType: project.mechanismType,
        approximateArea: project.approximateArea,
        specialNotes: project.specialNotes,
        proposalImages: project.proposalImages,
        scheduledDate: project.scheduledDate,
        scheduledTime: project.scheduledTime,
        assignedTechnicianIds: project.assignedTechnicianIds,
        leadTechnicianId: project.leadTechnicianId,
        isFullTools: project.isFullTools,
        toolsRequired: project.toolsRequired,
        customToolsNotes: project.customToolsNotes,
        status: project.status,
        qcStatus: project.qcStatus,
        updatedAt: new Date().toISOString(),
      };
      const nextProjects = currentList.map((p) => (p.id === project.id ? updatedProject : p));
      setProjects(nextProjects);
      projectsRef.current = nextProjects;
    } else {
      updatedProject = {
        ...project,
        updatedAt: new Date().toISOString(),
      };
      const nextProjects = [updatedProject, ...currentList];
      setProjects(nextProjects);
      projectsRef.current = nextProjects;
    }

    setIsProjectFormOpen(false);
    setEditingProject(null);

    // Atomically upsert row to Supabase
    try {
      await SupabaseSyncService.upsertProject(updatedProject);
      showToast('success', existing ? 'تغییرات پروژه با موفقیت در سرور ذخیره شد.' : 'پروژه جدید با موفقیت در سرور ثبت گردید.');
    } catch (err) {
      console.warn('Upsert project cloud error:', err);
      await OfflineQueue.enqueue('UPSERT_PROJECT', updatedProject);
      showToast('warning', 'ارتباط با سرور برقرار نشد؛ تغییرات در صف ارسال آفلاین قرار گرفت.');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!isSyncedWithServer) {
      showToast('warning', 'اطلاعات در حال دریافت از سرور است، لطفاً شکیبا باشید.');
      return;
    }

    const nextProjects = projectsRef.current.filter((p) => p.id !== projectId);
    setProjects(nextProjects);
    projectsRef.current = nextProjects;

    try {
      await SupabaseSyncService.deleteProject(projectId);
      showToast('success', 'پروژه با موفقیت از سرور حذف گردید.');
    } catch (err) {
      console.warn('Delete project cloud error:', err);
      await OfflineQueue.enqueue('DELETE_PROJECT', projectId);
      showToast('warning', 'دستور حذف در صف ارسال آفلاین ذخیره شد.');
    }
  };

  const handleMoveProjectDate = async (projectId: string, newDateKey: string) => {
    const current = projectsRef.current.find((p) => p.id === projectId);
    if (!current) return;

    const patch = {
      scheduledDate: newDateKey,
      updatedAt: new Date().toISOString(),
    };

    const nextProjects = projectsRef.current.map((p) => (p.id === projectId ? { ...p, ...patch } : p));
    setProjects(nextProjects);
    projectsRef.current = nextProjects;

    try {
      await SupabaseSyncService.patchProject(projectId, patch);
    } catch (err) {
      console.warn('Move project cloud error:', err);
      await OfflineQueue.enqueue('PATCH_PROJECT', { id: projectId, ...patch }, projectId);
      showToast('warning', 'تغییر تاریخ در صف ارسال آفلاین قرار گرفت.');
    }
  };

  const handleUpdateStatus = async (projectId: string, newStatus: Project['status']) => {
    const current = projectsRef.current.find((p) => p.id === projectId);
    if (!current) return;

    const patch = {
      status: newStatus,
      startedAt: newStatus === 'IN_PROGRESS' && !current.startedAt ? new Date().toISOString() : current.startedAt,
      updatedAt: new Date().toISOString(),
    };

    const nextProjects = projectsRef.current.map((p) => (p.id === projectId ? { ...p, ...patch } : p));
    setProjects(nextProjects);
    projectsRef.current = nextProjects;

    try {
      await SupabaseSyncService.patchProject(projectId, patch);
    } catch (err) {
      console.warn('Update status cloud error:', err);
      await OfflineQueue.enqueue('PATCH_PROJECT', { id: projectId, ...patch }, projectId);
      showToast('warning', 'تغییر وضعیت در صف ارسال آفلاین ثبت شد.');
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
    if (!completionModalProject) return;

    const current = projectsRef.current.find((p) => p.id === completionModalProject.id);
    if (!current) return;

    const patch = {
      status: 'COMPLETED' as const,
      qcStatus: 'PENDING' as const,
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

    const updatedProject: Project = {
      ...current,
      ...patch,
    };

    const nextProjects = projectsRef.current.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    setProjects(nextProjects);
    projectsRef.current = nextProjects;
    setCompletionModalProject(null);

    try {
      await SupabaseSyncService.patchProject(completionModalProject.id, patch);
      showToast('success', 'گزارش اتمام کار با موفقیت در سرور ثبت شد و به دسک QC ارسال گردید.');
    } catch (err) {
      console.warn('Report completion cloud error:', err);
      await OfflineQueue.enqueue('PATCH_PROJECT', { id: completionModalProject.id, ...patch }, completionModalProject.id);
      showToast('warning', 'گزارش اتمام کار در صف ارسال آفلاین ذخیره شد و پس از پایداری اینترنت ارسال می‌گردد.');
    }
  };

  // Pre-Installation inspection & 2nd measurement handler
  const handleSavePreInspection = async (
    inspection: PreInstallationInspection,
    newScheduledDate?: string
  ) => {
    if (!preInspectionProject) return;

    const current = projectsRef.current.find((p) => p.id === preInspectionProject.id);
    if (!current) return;

    const patch = {
      status: (inspection.status === 'APPROVED' ? 'SCHEDULED' : 'MEASUREMENT_PENDING') as Project['status'],
      scheduledDate: newScheduledDate || current.scheduledDate,
      preInspection: inspection,
      updatedAt: new Date().toISOString(),
    };

    const updatedProject: Project = {
      ...current,
      ...patch,
    };

    const nextProjects = projectsRef.current.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    setProjects(nextProjects);
    projectsRef.current = nextProjects;
    setPreInspectionProject(null);

    try {
      await SupabaseSyncService.patchProject(preInspectionProject.id, patch);
      showToast('success', 'گزارش کارشناسی فضا و اندازه‌گیری دوم با موفقیت در سرور ثبت شد.');
    } catch (err) {
      console.warn('Save pre-inspection cloud error:', err);
      await OfflineQueue.enqueue('PATCH_PROJECT', { id: preInspectionProject.id, ...patch }, preInspectionProject.id);
      showToast('warning', 'گزارش کارشناسی در صف ارسال آفلاین ثبت شد.');
    }
  };

  // 360-degree Personnel evaluation handler
  const handleSaveEvaluation = async (evaluation: PersonnelEvaluation) => {
    if (!evaluationProject) return;

    const current = projectsRef.current.find((p) => p.id === evaluationProject.id);
    if (!current) return;

    const patch = {
      evaluations: [...(current.evaluations || []), evaluation],
      updatedAt: new Date().toISOString(),
    };

    const updatedProject: Project = {
      ...current,
      ...patch,
    };

    const nextProjects = projectsRef.current.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    setProjects(nextProjects);
    projectsRef.current = nextProjects;
    setEvaluationProject(null);

    try {
      await SupabaseSyncService.patchProject(evaluationProject.id, patch);
      showToast('success', `ارزیابی عملکرد ${evaluation.userName} با موفقیت در سرور ثبت گردید.`);
    } catch (err) {
      console.warn('Save evaluation cloud error:', err);
      await OfflineQueue.enqueue('PATCH_PROJECT', { id: evaluationProject.id, ...patch }, evaluationProject.id);
      showToast('warning', 'ارزیابی در صف ارسال آفلاین ثبت شد.');
    }
  };

  // On-site acute stoppage / Stuck report handler (<72h KPI)
  const handleReportStuck = (project: Project) => {
    setStuckModalProject(project);
  };

  const handleConfirmReportStuck = async (incident: StuckIncident) => {
    if (!stuckModalProject) return;

    const current = projectsRef.current.find((p) => p.id === stuckModalProject.id);
    if (!current) return;

    const patch = {
      status: 'STUCK' as const,
      stuckIncident: incident,
      updatedAt: new Date().toISOString(),
    };

    const updatedProject: Project = {
      ...current,
      ...patch,
    };

    const nextProjects = projectsRef.current.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    setProjects(nextProjects);
    projectsRef.current = nextProjects;
    setStuckModalProject(null);

    try {
      await SupabaseSyncService.patchProject(stuckModalProject.id, patch);
      showToast('warning', 'پروژه به دسک رفع استاک (<72h) ارسال شد و بلافاصله به مسئولین فنی ارجاع یافت.');
    } catch (err) {
      console.warn('Report stuck cloud error:', err);
      await OfflineQueue.enqueue('PATCH_PROJECT', { id: stuckModalProject.id, ...patch }, stuckModalProject.id);
      showToast('warning', 'گزارش استاک در صف ارسال آفلاین ثبت شد.');
    }
  };

  // Ticket handlers
  const handleCreateTicket = async (newTicket: Ticket) => {
    setTickets((prev) => [newTicket, ...prev]);
    setTicketModalProject(null);

    try {
      await SupabaseSyncService.upsertTicket(newTicket);
      showToast('warning', 'تیکت اضطراری با موفقیت در سرور ثبت شد و به اطلاع مدیر QC رسید.');
    } catch (err) {
      console.warn('Create ticket cloud error:', err);
      await OfflineQueue.enqueue('UPSERT_TICKET', newTicket);
      showToast('warning', 'تیکت در صف ارسال آفلاین ثبت شد.');
    }
  };

  const handleUpdateTicket = async (updatedTicket: Ticket) => {
    setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));

    try {
      await SupabaseSyncService.upsertTicket(updatedTicket);
      showToast('success', 'تیکت با موفقیت به‌روزرسانی شد.');
    } catch (err) {
      console.warn('Update ticket cloud error:', err);
      await OfflineQueue.enqueue('UPSERT_TICKET', updatedTicket);
      showToast('warning', 'به‌روزرسانی تیکت در صف ارسال آفلاین ثبت شد.');
    }
  };

  // Settings handler
  const handleUpdateSettings = async (newSettings: SystemSettings) => {
    setSettings(newSettings);
    StorageService.saveSettings(newSettings);

    try {
      await SupabaseSyncService.upsertSettings(newSettings);
      showToast('success', 'تنظیمات با موفقیت در سرور ابری ثبت شد.');
    } catch (err) {
      console.warn('Update settings cloud error:', err);
      await OfflineQueue.enqueue('UPSERT_SETTINGS', newSettings);
      showToast('warning', 'تنظیمات در صف ارسال آفلاین ثبت شد.');
    }
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
  };

  const handleDeleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // Reset to demo data
  const handleResetData = () => {
    if (confirm('آیا مایلید تمام داده‌ها به حالت نمونه تستی اولیه بازنشانی شوند؟')) {
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
        onSwitchUser={
          import.meta.env.DEV
            ? (u) => {
                setCurrentUser(u);
              }
            : undefined
        }
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
                onUpdateProject={(updated) => {
                  setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                  SupabaseSyncService.upsertProject(updated);
                }}
                onViewProposal={(p) => setProposalModalProject(p)}
                onOpenCertificate={(p) => setCertificateModalProject(p)}
                onOpenEvaluation={(p) => setEvaluationProject(p)}
              />
            )}

            {activeTab === 'stuck' && (
              <StuckProjectsDesk
                projects={projects}
                onUpdateProject={handleSaveProject}
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
            onUpdateStatus={handleUpdateStatus}
            onOpenCertificate={(p) => setCertificateModalProject(p)}
            onReportStuck={handleReportStuck}
          />
        )}
      </main>

      {/* Modals */}
      {isProjectFormOpen && (
        <ProjectFormModal
          project={
            editingProject ||
            (presetDateKey
              ? ({ scheduledDate: presetDateKey } as unknown as Project)
              : null)
          }
          users={users}
          settings={settings}
          onClose={() => {
            setIsProjectFormOpen(false);
            setEditingProject(null);
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
          isOpen={!!preInspectionProject}
          onClose={() => setPreInspectionProject(null)}
          onSaveInspection={handleSavePreInspection}
        />
      )}

      {evaluationProject && (
        <PersonnelEvaluationModal
          project={evaluationProject}
          users={users}
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
