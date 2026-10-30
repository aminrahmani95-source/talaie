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
  // Session & Authentication via Supabase Auth
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [users, setUsers] = useState<User[]>(() => StorageService.getUsers());
  const [projects, setProjects] = useState<Project[]>(() => StorageService.getProjects());
  const [tickets, setTickets] = useState<Ticket[]>(() => StorageService.getTickets());
  const [settings, setSettings] = useState<SystemSettings>(() => StorageService.getSettings());

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

  // Fetch profiles from database and subscribe to real-time profile changes
  useEffect(() => {
    SupabaseSyncService.fetchProfiles().then((cloudUsers) => {
      if (cloudUsers.length > 0) {
        setUsers(cloudUsers);
      }
    });

    const unsubscribeProfiles = SupabaseSyncService.subscribeProfiles((updatedProfiles) => {
      if (updatedProfiles.length > 0) {
        setUsers(updatedProfiles);

        // Verify current session user is still active and update profile if changed
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
      unsubscribeProfiles();
    };
  }, []);

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

  // Fetch initial data from cloud tables (Migration 002: dedicated tables)
  useEffect(() => {
    SupabaseSyncService.fetchProjects().then((cloudProjects) => {
      if (cloudProjects.length > 0) {
        setProjects(cloudProjects);
      }
    });

    SupabaseSyncService.fetchTickets().then((cloudTickets) => {
      if (cloudTickets.length > 0) {
        setTickets(cloudTickets);
      }
    });

    SupabaseSyncService.fetchSettings().then((cloudSettings) => {
      if (cloudSettings) {
        setSettings((prev) => ({ ...prev, ...cloudSettings }));
      }
    });
  }, []);

  // Realtime row-by-row subscriptions for Projects, Tickets, and Settings
  useEffect(() => {
    const unsubProjects = SupabaseSyncService.subscribeProjects({
      onInsert: (newProject) => {
        setProjects((prev) => {
          if (prev.some((p) => p.id === newProject.id)) return prev;
          return [newProject, ...prev];
        });
      },
      onUpdate: (updatedProject) => {
        setProjects((prev) => {
          const existing = prev.find((p) => p.id === updatedProject.id);
          if (!existing) {
            return [updatedProject, ...prev];
          }
          // Conflict resolution: Ignore cloud update if local update is newer
          const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const cloudTime = updatedProject.updatedAt ? new Date(updatedProject.updatedAt).getTime() : 0;
          if (localTime > cloudTime) {
            return prev;
          }
          return prev.map((p) => (p.id === updatedProject.id ? updatedProject : p));
        });
      },
      onDelete: (deletedId) => {
        setProjects((prev) => prev.filter((p) => p.id !== deletedId));
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

    return () => {
      unsubProjects();
      unsubTickets();
      unsubSettings();
    };
  }, []);

  // Lightweight local storage caching (no loopback, no remote push from effect)
  useEffect(() => {
    StorageService.saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    StorageService.saveTickets(tickets);
  }, [tickets]);

  useEffect(() => {
    StorageService.saveSettings(settings);
  }, [settings]);

  // Project handlers
  const handleSaveProject = async (project: Project) => {
    const exists = projects.some((p) => p.id === project.id);
    let updatedProject: Project;

    if (exists) {
      // Merge ONLY edited fields over the live project state to prevent wiping technician reports/photos
      const liveCurrent = projects.find((p) => p.id === project.id)!;
      updatedProject = {
        ...liveCurrent,
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
      setProjects((prev) => prev.map((p) => (p.id === project.id ? updatedProject : p)));
    } else {
      updatedProject = {
        ...project,
        updatedAt: new Date().toISOString(),
      };
      setProjects((prev) => [updatedProject, ...prev]);
    }

    setIsProjectFormOpen(false);
    setEditingProject(null);

    // Atomically upsert row to Supabase
    try {
      await SupabaseSyncService.upsertProject(updatedProject);
    } catch (err) {
      console.warn('Upsert project cloud error:', err);
      showToast('error', 'خطا در همگام‌سازی ابری پروژه. اطلاعات در کش محلی ذخیره شد.');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    try {
      await SupabaseSyncService.deleteProject(projectId);
    } catch (err) {
      console.warn('Delete project cloud error:', err);
      showToast('error', 'خطا در حذف پروژه از سرور ابری.');
    }
  };

  const handleMoveProjectDate = async (projectId: string, newDateKey: string) => {
    let targetProject: Project | null = null;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          targetProject = { ...p, scheduledDate: newDateKey, updatedAt: new Date().toISOString() };
          return targetProject;
        }
        return p;
      })
    );

    if (targetProject) {
      try {
        await SupabaseSyncService.upsertProject(targetProject);
      } catch (err) {
        console.warn('Move project cloud error:', err);
      }
    }
  };

  const handleUpdateStatus = async (projectId: string, newStatus: Project['status']) => {
    let targetProject: Project | null = null;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          targetProject = {
            ...p,
            status: newStatus,
            startedAt: newStatus === 'IN_PROGRESS' && !p.startedAt ? new Date().toISOString() : p.startedAt,
            updatedAt: new Date().toISOString(),
          };
          return targetProject;
        }
        return p;
      })
    );

    if (targetProject) {
      try {
        await SupabaseSyncService.upsertProject(targetProject);
      } catch (err) {
        console.warn('Update status cloud error:', err);
      }
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

    let targetProject: Project | null = null;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === completionModalProject.id) {
          targetProject = {
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
            updatedAt: new Date().toISOString(),
          };
          return targetProject;
        }
        return p;
      })
    );

    setCompletionModalProject(null);
    showToast('success', 'گزارش اتمام کار با موفقیت ثبت شد و به دسک QC ارسال گردید.');

    if (targetProject) {
      try {
        await SupabaseSyncService.upsertProject(targetProject);
      } catch (err) {
        console.warn('Report completion cloud error:', err);
        showToast('error', 'خطا در ارسال ابری گزارش. در حافظه محلی ذخیره شد.');
      }
    }
  };

  // Pre-Installation inspection & 2nd measurement handler
  const handleSavePreInspection = async (
    inspection: PreInstallationInspection,
    newScheduledDate?: string
  ) => {
    if (!preInspectionProject) return;

    let targetProject: Project | null = null;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === preInspectionProject.id) {
          targetProject = {
            ...p,
            status: inspection.status === 'APPROVED' ? 'SCHEDULED' : 'MEASUREMENT_PENDING',
            scheduledDate: newScheduledDate || p.scheduledDate,
            preInspection: inspection,
            updatedAt: new Date().toISOString(),
          };
          return targetProject;
        }
        return p;
      })
    );

    setPreInspectionProject(null);
    showToast('success', 'گزارش کارشناسی فضا و اندازه‌گیری دوم با موفقیت در سامانه ثبت شد.');

    if (targetProject) {
      try {
        await SupabaseSyncService.upsertProject(targetProject);
      } catch (err) {
        console.warn('Save pre-inspection cloud error:', err);
      }
    }
  };

  // 360-degree Personnel evaluation handler
  const handleSaveEvaluation = async (evaluation: PersonnelEvaluation) => {
    if (!evaluationProject) return;

    let targetProject: Project | null = null;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === evaluationProject.id) {
          targetProject = {
            ...p,
            evaluations: [...(p.evaluations || []), evaluation],
            updatedAt: new Date().toISOString(),
          };
          return targetProject;
        }
        return p;
      })
    );

    setEvaluationProject(null);
    showToast('success', `ارزیابی عملکرد ${evaluation.userName} با موفقیت ثبت گردید.`);

    if (targetProject) {
      try {
        await SupabaseSyncService.upsertProject(targetProject);
      } catch (err) {
        console.warn('Save evaluation cloud error:', err);
      }
    }
  };

  // On-site acute stoppage / Stuck report handler (<72h KPI)
  const handleReportStuck = (project: Project) => {
    setStuckModalProject(project);
  };

  const handleConfirmReportStuck = async (incident: StuckIncident) => {
    if (!stuckModalProject) return;

    let targetProject: Project | null = null;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === stuckModalProject.id) {
          targetProject = {
            ...p,
            status: 'STUCK',
            stuckIncident: incident,
            updatedAt: new Date().toISOString(),
          };
          return targetProject;
        }
        return p;
      })
    );

    setStuckModalProject(null);
    showToast('warning', 'پروژه به دسک رفع استاک (<72h) ارسال شد و بلافاصله به مسئولین فنی ارجاع یافت.');

    if (targetProject) {
      try {
        await SupabaseSyncService.upsertProject(targetProject);
      } catch (err) {
        console.warn('Report stuck cloud error:', err);
      }
    }
  };

  // Ticket handlers
  const handleCreateTicket = async (newTicket: Ticket) => {
    setTickets((prev) => [newTicket, ...prev]);
    setTicketModalProject(null);
    showToast('warning', 'تیکت اضطراری با موفقیت ثبت شد و به اطلاع مدیر QC رسید.');

    try {
      await SupabaseSyncService.upsertTicket(newTicket);
    } catch (err) {
      console.warn('Create ticket cloud error:', err);
    }
  };

  const handleUpdateTicket = async (updatedTicket: Ticket) => {
    setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));

    try {
      await SupabaseSyncService.upsertTicket(updatedTicket);
    } catch (err) {
      console.warn('Update ticket cloud error:', err);
    }
  };

  // Settings handler
  const handleUpdateSettings = async (newSettings: SystemSettings) => {
    setSettings(newSettings);
    StorageService.saveSettings(newSettings);

    try {
      await SupabaseSyncService.upsertSettings(newSettings);
    } catch (err) {
      console.warn('Update settings cloud error:', err);
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

      {/* Floating System Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default App;
