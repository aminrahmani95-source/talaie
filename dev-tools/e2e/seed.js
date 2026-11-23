// Test-only demo data injected into the local browser for visual review (never sent anywhere).
(() => {
  const d = (off) => { const x = new Date(); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10); };
  const now = new Date().toISOString();
  const users = [
    { id: 'u-ceo', name: 'امید طلایی (مدیرعامل)', phone: '09121111110', role: 'CEO', avatar: '👑', active: true },
    { id: 'u-qc-manager', name: 'مهندس رحمانی (مدیر اپ و QC)', phone: '09124339038', role: 'QC_MANAGER', avatar: '👔', active: true },
    { id: 'usr-lead-a', name: 'رضا کریمی', phone: '09120000001', role: 'LEAD_TECHNICIAN', teamId: 'TEAM_1', active: true },
    { id: 'usr-tech-a', name: 'مهدی نوری', phone: '09120000002', role: 'TECHNICIAN', teamId: 'TEAM_1', active: true },
    { id: 'usr-lead-b', name: 'حسین مرادی', phone: '09120000003', role: 'LEAD_TECHNICIAN', teamId: 'TEAM_2', active: true },
    { id: 'usr-tech-b', name: 'علی صادقی', phone: '09120000004', role: 'TECHNICIAN', teamId: 'TEAM_2', active: true },
    { id: 'usr-wh', name: 'سعید احمدی', phone: '09120000005', role: 'WAREHOUSE', active: true },
    { id: 'usr-sales', name: 'نگار رستمی', phone: '09120000006', role: 'SALES_REP', active: true },
    { id: 'usr-coord', name: 'سارا هماهنگ', phone: '09120000007', role: 'SCHEDULING_COORDINATOR', active: true },
    { id: 'usr-meas', name: 'کاوه متراژ', phone: '09120000008', role: 'MEASUREMENT_LEAD', active: true },
  ];
  const members = [
    { id: 'tm-1', teamId: 'TEAM_1', userId: 'usr-lead-a', userName: 'رضا کریمی', roleInTeam: 'LEAD', joinedAt: now },
    { id: 'tm-2', teamId: 'TEAM_1', userId: 'usr-tech-a', userName: 'مهدی نوری', roleInTeam: 'TECHNICIAN', joinedAt: now },
    { id: 'tm-3', teamId: 'TEAM_2', userId: 'usr-lead-b', userName: 'حسین مرادی', roleInTeam: 'LEAD', joinedAt: now },
    { id: 'tm-4', teamId: 'TEAM_2', userId: 'usr-tech-b', userName: 'علی صادقی', roleInTeam: 'TECHNICIAN', joinedAt: now },
  ];
  const teams = [
    { id: 'TEAM_1', name: 'اکیپ نصب ۱', code: 'TEAM_1', supervisorId: 'usr-lead-a', createdAt: now, updatedAt: now },
    { id: 'TEAM_2', name: 'اکیپ نصب ۲', code: 'TEAM_2', supervisorId: 'usr-lead-b', createdAt: now, updatedAt: now },
  ];
  const base = (id, extra) => ({
    id, code: 'PRJ-' + id.slice(-3), title: extra.customerName, customerPhone: '09125550000',
    address: 'تهران، سعادت‌آباد، خیابان سرو غربی، پلاک ۱۲', shadePanels: 8, curtainPanels: 6,
    proposalImages: [], scheduledTime: '09:30', isFullTools: true, toolsRequired: [], completionPhotos: [],
    assignedTechnicianIds: [], qcStatus: 'NOT_STARTED', evaluations: [], createdAt: now, updatedAt: now, ...extra,
  });
  const projects = [
    base('prj-101', { customerName: 'خانواده محمدی', status: 'IN_PROGRESS', scheduledDate: d(0), assignedTeamId: 'TEAM_1', assignedTeamName: 'اکیپ نصب ۱', leadTechnicianId: 'usr-lead-a', assignedTechnicianIds: ['usr-lead-a', 'usr-tech-a'], startedAt: now, estimatedWorkload: 14 }),
    base('prj-102', { customerName: 'دفتر معماری نقش', status: 'SCHEDULED', scheduledDate: d(0), scheduledTime: '14:00', assignedTeamId: 'TEAM_2', assignedTeamName: 'اکیپ نصب ۲', leadTechnicianId: 'usr-lead-b', assignedTechnicianIds: ['usr-lead-b', 'usr-tech-b'], estimatedWorkload: 10 }),
    base('prj-103', { customerName: 'ویلا لواسان - آقای فرهمند', status: 'SCHEDULED', scheduledDate: d(1), assignedTeamId: 'TEAM_1', assignedTeamName: 'اکیپ نصب ۱', leadTechnicianId: 'usr-lead-a', assignedTechnicianIds: ['usr-lead-a', 'usr-tech-a'], estimatedWorkload: 18 }),
    base('prj-104', { customerName: 'آپارتمان زعفرانیه', status: 'STUCK', scheduledDate: d(-1), assignedTeamId: 'TEAM_2', assignedTeamName: 'اکیپ نصب ۲', leadTechnicianId: 'usr-lead-b', assignedTechnicianIds: ['usr-lead-b'],
      stuckIncidents: [{ id: 'si-1', stuckAt: new Date(Date.now() - 30 * 3600e3).toISOString(), category: 'HARDWARE_SHORTAGE', description: 'کسری ۴ عدد براکت دیواری موتور', reportedBy: 'حسین مرادی', photos: [], resolutionStatus: 'OPEN', targetMaxHours: 72 }] }),
    base('prj-105', { customerName: 'کلینیک دندانپزشکی آرین', status: 'COMPLETED', qcStatus: 'PENDING', scheduledDate: d(-2), completedAt: now, assignedTeamId: 'TEAM_1', assignedTeamName: 'اکیپ نصب ۱', leadTechnicianId: 'usr-lead-a', assignedTechnicianIds: ['usr-lead-a'] }),
    base('prj-106', { customerName: 'برج الماس - واحد ۱۲', status: 'COMPLETED', qcStatus: 'APPROVED', qcScore: 4.6, scheduledDate: d(-5), completedAt: now, qcReviewedAt: now, assignedTeamId: 'TEAM_2', assignedTeamName: 'اکیپ نصب ۲' }),
    base('prj-107', { customerName: 'خانم اسدی - نیاوران', status: 'MEASUREMENT_PENDING', scheduledDate: d(3) }),
    base('prj-108', { customerName: 'هتل پارسیان - لابی', status: 'SCHEDULED', scheduledDate: d(2), assignedTeamId: 'TEAM_2', assignedTeamName: 'اکیپ نصب ۲', leadTechnicianId: 'usr-lead-b', assignedTechnicianIds: ['usr-lead-b', 'usr-tech-b'], estimatedWorkload: 24 }),
  ];
  const tickets = [
    { id: 'tk-201', projectId: 'prj-104', projectCode: 'PRJ-104', projectTitle: 'آپارتمان زعفرانیه', authorId: 'usr-lead-b', authorName: 'حسین مرادی', type: 'DAMAGED_HARDWARE', category: 'EQUIPMENT_DEFECT', description: 'کسری ۴ عدد براکت دیواری موتور', photos: [], status: 'OPEN', isBlocking: true, assignedRole: 'WAREHOUSE', createdAt: new Date(Date.now() - 30 * 3600e3).toISOString() },
  ];
  const bookings = [
    { id: 'book-a1', customerName: 'آقای کاظمی', customerPhone: '09121234567', address: 'پاسداران', lathsCount: 16, isSmart: true, notes: '', requestedDate: d(4), jalaliDate: '', allocationMode: 'SPREAD_DAILY', allocatedTeams: ['TEAM_1'], allocatedDaysCount: 1, salesRepId: 'usr-sales', salesRepName: 'نگار رستمی', createdAt: now },
  ];
  const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set('talaie_users_v6', users);
  set('talaie_team_members_v6', members);
  set('talaie_teams_v6', teams);
  for (const uid of ['', '_u-qc-manager', '_u-ceo', '_usr-lead-a']) {
    set('talaie_projects_v6' + uid, projects);
    set('talaie_tickets_v6' + uid, tickets);
  }
  set('talaei_sales_bookings_v1', bookings);
  localStorage.setItem('talaie_storage_initialized_v6', 'true');
})();
