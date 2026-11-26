/**
 * صفحه‌ها و مودال‌هایی که با تقسیم کد (code-split) بارگذاری می‌شوند.
 * تکنسین‌ها هرگز کد صفحات مدیریتی را دانلود نمی‌کنند؛ هر صفحه فقط هنگام نیاز لود می‌شود.
 */
import React from 'react';

// Code-split Manager Screens so technicians never download manager JS
export const OperationsControlCenter = React.lazy(() =>
  import('../components/admin/OperationsControlCenter').then((m) => ({ default: m.OperationsControlCenter }))
);
export const MonthPlanner = React.lazy(() =>
  import('../components/admin/MonthPlanner').then((m) => ({ default: m.MonthPlanner }))
);
export const QcDesk = React.lazy(() =>
  import('../components/admin/QcDesk').then((m) => ({ default: m.QcDesk }))
);
export const TicketCenter = React.lazy(() =>
  import('../components/admin/TicketCenter').then((m) => ({ default: m.TicketCenter }))
);
export const MaterialCenter = React.lazy(() =>
  import('../components/admin/MaterialCenter').then((m) => ({ default: m.MaterialCenter }))
);
export const TechniciansManager = React.lazy(() =>
  import('../components/admin/TechniciansManager').then((m) => ({ default: m.TechniciansManager }))
);
export const SettingsView = React.lazy(() =>
  import('../components/admin/SettingsView').then((m) => ({ default: m.SettingsView }))
);
export const IssuesDesk = React.lazy(() =>
  import('../components/admin/IssuesDesk').then((m) => ({ default: m.IssuesDesk }))
);
export const ProjectsHub = React.lazy(() =>
  import('../components/admin/ProjectsHub').then((m) => ({ default: m.ProjectsHub }))
);
export const StuckProjectsDesk = React.lazy(() =>
  import('../components/admin/StuckProjectsDesk').then((m) => ({ default: m.StuckProjectsDesk }))
);
export const PreInstallationModal = React.lazy(() =>
  import('../components/admin/PreInstallationModal').then((m) => ({ default: m.PreInstallationModal }))
);
export const PersonnelEvaluationModal = React.lazy(() =>
  import('../components/admin/PersonnelEvaluationModal').then((m) => ({ default: m.PersonnelEvaluationModal }))
);
export const FailedOperationsModal = React.lazy(() =>
  import('../components/admin/FailedOperationsModal').then((m) => ({ default: m.FailedOperationsModal }))
);
export const PendingOperationsModal = React.lazy(() =>
  import('../components/admin/PendingOperationsModal').then((m) => ({ default: m.PendingOperationsModal }))
);
export const CeoMasterRegistry = React.lazy(() =>
  import('../components/ceo/CeoMasterRegistry').then((m) => ({ default: m.CeoMasterRegistry }))
);
export const ProjectDossierModal = React.lazy(() =>
  import('../components/ceo/ProjectDossierModal').then((m) => ({ default: m.ProjectDossierModal }))
);
export const ProjectPassportPrint = React.lazy(() =>
  import('../components/common/ProjectPassportPrint').then((m) => ({ default: m.ProjectPassportPrint }))
);
export const MeasurementDashboard = React.lazy(() =>
  import('../components/measurement/MeasurementDashboard').then((m) => ({ default: m.MeasurementDashboard }))
);
export const WarehouseDesk = React.lazy(() =>
  import('../components/warehouse/WarehouseDesk').then((m) => ({ default: m.WarehouseDesk }))
);
export const SalesPortal = React.lazy(() =>
  import('../components/sales/SalesPortal').then((m) => ({ default: m.SalesPortal }))
);

// Code-split Modals loaded on demand
export const ProjectFormModal = React.lazy(() =>
  import('../components/admin/ProjectFormModal').then((m) => ({ default: m.ProjectFormModal }))
);
export const ProposalViewerModal = React.lazy(() =>
  import('../components/ProposalViewerModal').then((m) => ({ default: m.ProposalViewerModal }))
);
export const TicketModal = React.lazy(() =>
  import('../components/TicketModal').then((m) => ({ default: m.TicketModal }))
);
export const MaterialRequestModal = React.lazy(() =>
  import('../components/technician/MaterialRequestModal').then((m) => ({ default: m.MaterialRequestModal }))
);
export const ToolChecklistDrawer = React.lazy(() =>
  import('../components/technician/ToolChecklistDrawer').then((m) => ({ default: m.ToolChecklistDrawer }))
);
export const ReportCompletionModal = React.lazy(() =>
  import('../components/technician/ReportCompletionModal').then((m) => ({ default: m.ReportCompletionModal }))
);
export const HandoverCertificateModal = React.lazy(() =>
  import('../components/HandoverCertificateModal').then((m) => ({ default: m.HandoverCertificateModal }))
);
export const ReportStuckModal = React.lazy(() =>
  import('../components/technician/ReportStuckModal').then((m) => ({ default: m.ReportStuckModal }))
);
export const DailyLogModal = React.lazy(() =>
  import('../components/technician/DailyLogModal').then((m) => ({ default: m.DailyLogModal }))
);
export const ProjectManagerSheet = React.lazy(() =>
  import('../components/admin/ProjectManagerSheet').then((m) => ({ default: m.ProjectManagerSheet }))
);

