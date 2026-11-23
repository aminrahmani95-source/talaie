import { User, InstallationTeam, TeamMember } from '../types';

export const TEST_USERS: User[] = [
  {
    id: 'u-ceo',
    name: 'امید طلایی (مدیرعامل)',
    phone: '09121111110',
    role: 'CEO',
    avatar: '👑',
    active: true,
  },
  {
    id: 'u-qc-manager',
    name: 'مهندس رحمانی (مدیر اپ و QC)',
    phone: '09124339038',
    role: 'QC_MANAGER',
    avatar: '👔',
    active: true,
  },
  {
    id: 'usr-lead-a',
    name: 'رضا کریمی',
    phone: '09120000001',
    role: 'LEAD_TECHNICIAN',
    teamId: 'TEAM_1',
    avatar: '⭐',
    active: true,
  },
  {
    id: 'usr-tech-a',
    name: 'مهدی نوری',
    phone: '09120000002',
    role: 'TECHNICIAN',
    teamId: 'TEAM_1',
    avatar: '🔧',
    active: true,
  },
  {
    id: 'usr-lead-b',
    name: 'حسین مرادی',
    phone: '09120000003',
    role: 'LEAD_TECHNICIAN',
    teamId: 'TEAM_2',
    avatar: '⭐',
    active: true,
  },
  {
    id: 'usr-tech-b',
    name: 'علی صادقی',
    phone: '09120000004',
    role: 'TECHNICIAN',
    teamId: 'TEAM_2',
    avatar: '🔧',
    active: true,
  },
  {
    id: 'usr-wh',
    name: 'سعید احمدی',
    phone: '09120000005',
    role: 'WAREHOUSE',
    avatar: '📦',
    active: true,
  },
  {
    id: 'usr-sales',
    name: 'نگار رستمی',
    phone: '09120000006',
    role: 'SALES_REP',
    avatar: '🎯',
    active: true,
  },
];

export const DEFAULT_TEAMS: InstallationTeam[] = [
  {
    id: 'TEAM_1',
    name: 'اکیپ نصب ۱',
    code: 'TEAM_1',
    supervisorId: 'usr-lead-a',
    supervisorName: 'رضا کریمی',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'TEAM_2',
    name: 'اکیپ نصب ۲',
    code: 'TEAM_2',
    supervisorId: 'usr-lead-b',
    supervisorName: 'حسین مرادی',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

export const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  { id: 'tm-1', teamId: 'TEAM_1', userId: 'usr-lead-a', userName: 'رضا کریمی', roleInTeam: 'LEAD', joinedAt: '2026-01-01' },
  { id: 'tm-2', teamId: 'TEAM_1', userId: 'usr-tech-a', userName: 'مهدی نوری', roleInTeam: 'TECHNICIAN', joinedAt: '2026-01-01' },
  { id: 'tm-3', teamId: 'TEAM_2', userId: 'usr-lead-b', userName: 'حسین مرادی', roleInTeam: 'LEAD', joinedAt: '2026-01-01' },
  { id: 'tm-4', teamId: 'TEAM_2', userId: 'usr-tech-b', userName: 'علی صادقی', roleInTeam: 'TECHNICIAN', joinedAt: '2026-01-01' },
];

export const ROLE_BADGES: Record<string, { title: string; color: string }> = {
  CEO: { title: 'مدیر عامل', color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' },
  QC_MANAGER: { title: 'مدیر اپ و QC', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  SCHEDULING_COORDINATOR: { title: 'هماهنگی', color: 'bg-blue-500/10 text-blue-300 border-blue-500/30' },
  MEASUREMENT_LEAD: { title: 'متراژ دوم', color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' },
  WAREHOUSE: { title: 'انبار', color: 'bg-orange-500/10 text-orange-300 border-orange-500/30' },
  LEAD_TECHNICIAN: { title: 'سرپرست', color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' },
  TECHNICIAN: { title: 'تکنسین', color: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30' },
  SALES_REP: { title: 'کارشناس فروش', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
};

export const INITIAL_TEST_USER_IDS = new Set(TEST_USERS.map((u) => u.id));
export const isTestUserId = (id: string): boolean => INITIAL_TEST_USER_IDS.has(id);
