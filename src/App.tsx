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
import { Header } from './components/Header';
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
  // Load state from StorageService
  const [currentUser, setCurrentUser] = useState<User | null>(() => StorageService.getCurrentUser());
  const [users, setUsers] = useState<User[]>(() => StorageService.getUsers());
  const [projects, setProjects] = useState<Project[]>(() => StorageService.getProjects());
  const [tickets, setTickets] = useState<Ticket[]>(() => StorageService.getTickets());
  const [settings, setSettings] = useState<SystemSettings>(() => StorageService.getSettings());

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

  // Flag to avoid loopbacks when cloud updates state
  const isRemoteSyncRef = useRef(false);

  // Cross-tab and real-time synchronization
  useEffect(() => {
    // 1. BroadcastChannel for instant multi-tab sync
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('talaie_realtime_sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'SYNC_DATA') {
          setProjects(StorageService.getProjects());
          setTickets(StorageService.getTickets());
          setUsers(StorageService.getUsers());
          setSettings(StorageService.getSettings());
        }
      };
    } catch {
      // BroadcastChannel not available in older environments
    }

    // 2. Storage event for cross-window / cross-tab fallback
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('talaie_')) {
        setProjects(StorageService.getProjects());
        setTickets(StorageService.getTickets());
        setUsers(StorageService.getUsers());
        setSettings(StorageService.getSettings());
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, []);

  // Broadcast helper
  const broadcastSync = () => {
    try {
      const bc = new BroadcastChannel('talaie_realtime_sync');
      bc.postMessage({ type: 'SYNC_DATA', timestamp: Date.now() });
      bc.close();
    } catch {}
  };

  // Cloud sync via Supabase
  useEffect(() => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return;

    let unsubscribe: (() => void) | undefined;
    SupabaseSyncService.subscribe(
      settings.supabaseUrl,
      settings.supabaseAnonKey,
      {
        onProjectsSync: (cloudProjects) => {
          if (Array.isArray(cloudProjects) && cloudProjects.length > 0) {
            isRemoteSyncRef.current = true;
            setProjects(cloudProjects);
            setTimeout(() => { isRemoteSyncRef.current = false; }, 800);
          }
        },
        onTicketsSync: (cloudTickets) => {
          if (Array.isArray(cloudTickets) && cloudTickets.length > 0) {
            isRemoteSyncRef.current = true;
            setTickets(cloudTickets);
            setTimeout(() => { isRemoteSyncRef.current = false; }, 800);
          }
        },
        onUsersSync: (cloudUsers) => {
          if (Array.isArray(cloudUsers) && cloudUsers.length > 0) {
            isRemoteSyncRef.current = true;
            setUsers(cloudUsers);
            setTimeout(() => { isRemoteSyncRef.current = false; }, 800);
          }
        },
        onSettingsSync: (cloudSettings) => {
          if (cloudSettings && typeof cloudSettings === 'object') {
            isRemoteSyncRef.current = true;
            setSettings((prev) => ({ ...prev, ...cloudSettings }));
            setTimeout(() => { isRemoteSyncRef.current = false; }, 800);
          }
        },
      }
    ).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  // Sync state changes with StorageService & Supabase Cloud (debounced and guarded)
  useEffect(() => {
    StorageService.saveProjects(projects);
    broadcastSync();
    if (!isRemoteSyncRef.current && settings.supabaseUrl && settings.supabaseAnonKey) {
      const timer = setTimeout(() => {
        SupabaseSyncService.push(settings.supabaseUrl, settings.supabaseAnonKey, 'projects', projects);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [projects]);

  useEffect(() => {
    StorageService.saveUsers(users);
    broadcastSync();
    if (!isRemoteSyncRef.current && settings.supabaseUrl && settings.supabaseAnonKey) {
      const timer = setTimeout(() => {
        SupabaseSyncService.push(settings.supabaseUrl, settings.supabaseAnonKey, 'users', users);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [users]);

  useEffect(() => {
    StorageService.saveTickets(tickets);
    broadcastSync();
    if (!isRemoteSyncRef.current && settings.supabaseUrl && settings.supabaseAnonKey) {
      const timer = setTimeout(() => {
        SupabaseSyncService.push(settings.supabaseUrl, settings.supabaseAnonKey, 'tickets', tickets);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tickets]);

  useEffect(() => {
    StorageService.saveSettings(settings);
    broadcastSync();
    if (!isRemoteSyncRef.current && settings.supabaseUrl && settings.supabaseAnonKey) {
      const timer = setTimeout(() => {
        SupabaseSyncService.push(settings.supabaseUrl, settings.supabaseAnonKey, 'settings', settings);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [settings]);

  useEffect(() => {
    StorageService.setCurrentUser(currentUser);
  }, [currentUser]);

  // Project handlers
  const handleSaveProject = (project: Project) => {
    const exists = projects.some((p) => p.id === project.id);
    let updated: Project[];
    if (exists) {
      updated = projects.map((p) => (p.id === project.id ? project : p));
    } else {
      updated = [project, ...projects];
    }
    setProjects(updated);
    setIsProjectFormOpen(false);
    setEditingProject(null);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  const handleMoveProjectDate = (projectId: string, newDateKey: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, scheduledDate: newDateKey } : p))
    );
  };

  const handleUpdateStatus = (projectId: string, newStatus: Project['status']) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              status: newStatus,
              startedAt: newStatus === 'IN_PROGRESS' && !p.startedAt ? new Date().toISOString() : p.startedAt,
            }
          : p
      )
    );
  };

  // Completion report from field
  const handleReportCompletion = (completionData: {
    completionNotes: string;
    beforePhotos: string[];
    afterPhotos: string[];
    completionPhotos: string[];
    handoverChecklist: HandoverChecklist;
    customerSignature?: string;
    customerSatisfaction?: number;
  }) => {
    if (!completionModalProject) return;

    setProjects((prev) =>
      prev.map((p) =>
        p.id === completionModalProject.id
          ? {
              ...p,
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
            }
          : p
      )
    );

    setCompletionModalProject(null);
  };

  // Pre-Installation inspection & 2nd measurement handler
  const handleSavePreInspection = (
    inspection: PreInstallationInspection,
    newScheduledDate?: string
  ) => {
    if (!preInspectionProject) return;

    setProjects((prev) =>
      prev.map((p) =>
        p.id === preInspectionProject.id
          ? {
              ...p,
              status: inspection.status === 'APPROVED' ? 'SCHEDULED' : 'MEASUREMENT_PENDING',
              scheduledDate: newScheduledDate || p.scheduledDate,
              preInspection: inspection,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
    setPreInspectionProject(null);
    showToast('success', 'گزارش کارشناسی فضا و اندازه‌گیری دوم با موفقیت در سامانه ثبت شد.');
  };

  // 360-degree Personnel evaluation handler
  const handleSaveEvaluation = (evaluation: PersonnelEvaluation) => {
    if (!evaluationProject) return;

    setProjects((prev) =>
      prev.map((p) =>
        p.id === evaluationProject.id
          ? {
              ...p,
              evaluations: [...(p.evaluations || []), evaluation],
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
    setEvaluationProject(null);
    showToast('success', `ارزیابی عملکرد ${evaluation.userName} با موفقیت ثبت گردید.`);
  };

  // On-site acute stoppage / Stuck report handler (<72h KPI)
  const handleReportStuck = (project: Project) => {
    setStuckModalProject(project);
  };

  const handleConfirmReportStuck = (incident: StuckIncident) => {
    if (!stuckModalProject) return;

    setProjects((prev) =>
      prev.map((p) =>
        p.id === stuckModalProject.id
          ? {
              ...p,
              status: 'STUCK',
              stuckIncident: incident,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
    setStuckModalProject(null);
    showToast('warning', 'پروژه به دسک رفع استاک (<72h) ارسال شد و بلافاصله به مسئولین فنی ارجاع یافت.');
  };

  // Ticket handlers
  const handleCreateTicket = (newTicket: Ticket) => {
    setTickets((prev) => [newTicket, ...prev]);
    setTicketModalProject(null);
    showToast('warning', 'تیکت اضطراری با موفقیت ثبت شد و به اطلاع مدیر QC رسید.');
  };

  const handleUpdateTicket = (updatedTicket: Ticket) => {
    setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
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

  const handleLogout = () => {
    setCurrentUser(null);
    StorageService.setCurrentUser(null);
  };

  // If no user is authenticated, render the dedicated secure login page
  if (!currentUser) {
    return (
      <LoginModal
        users={users}
        isOpen={true}
        isStandalone={true}
        onSelectUser={(u) => {
          setCurrentUser(u);
          StorageService.setCurrentUser(u);
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
        onSwitchUser={(u) => {
          setCurrentUser(u);
          StorageService.setCurrentUser(u);
        }}
        settings={settings}
        openTicketCount={openTicketCount}
        openStuckCount={openStuckCount}
        pendingQcCount={pendingQcCount}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onLogout={handleLogout}
        onResetData={handleResetData}
        onOpenSettings={() => setActiveTab('settings')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

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
                onUpdateSettings={setSettings}
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
                isDarkMode={isDarkMode}
                onToggleDarkMode={handleToggleDarkMode}
                onUpdateSettings={setSettings}
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

      {/* Floating System Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default App;
