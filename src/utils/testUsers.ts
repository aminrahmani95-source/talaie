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
];

export const DEFAULT_TEAMS: InstallationTeam[] = [
  { id: 'TEAM_1', name: 'اکیپ نصب ۱', code: 'TEAM_1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'TEAM_2', name: 'اکیپ نصب ۲', code: 'TEAM_2', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
];

export const DEFAULT_TEAM_MEMBERS: TeamMember[] = [];

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

export const MOCK_TEST_USER_IDS = new Set([
  'u-coordinator',
  'u-measurement',
  'u-warehouse',
  'u-sales-1',
  'u-sales-2',
  'u-sales-3',
  'u-lead-1',
  'u-tech-1',
  'u-tech-2',
  'u-lead-2',
  'u-tech-3',
  'u-tech-4',
  'u-lead-3',
  'u-tech-5',
  'u-lead-4',
  'u-tech-6',
  'usr-lead-a',
  'usr-tech-a',
  'usr-lead-b',
  'usr-tech-b',
  'usr-wh',
  'usr-sales',
]);

export function isTestOrMockUser(id?: string | null): boolean {
  if (!id) return false;
  if (id === 'u-ceo' || id === 'u-qc-manager') return false;
  if (MOCK_TEST_USER_IDS.has(id)) return true;
  if (id.startsWith('usr-') || id.startsWith('u-test-') || id.startsWith('u-demo-')) return true;
  return false;
}
