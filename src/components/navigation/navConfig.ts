import {
  Activity,
  CalendarDays,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  Package,
  Users,
  Settings,
  FileCheck2,
  Trophy,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

/**
 * ساختار واحد ناوبری مدیران.
 * سایدبار دسکتاپ، نوار پایین موبایل و شیت «بیشتر» همه از همین فایل ساخته می‌شوند تا
 * برچسب‌ها، ترتیب و دسترسی نقش‌ها هیچ‌وقت با هم ناهماهنگ نشوند.
 */
export type ManagerTab =
  | 'control'
  | 'planner'
  | 'qc'
  | 'stuck'
  | 'tickets'
  | 'materials'
  | 'technicians'
  | 'settings'
  | 'registry'
  | 'sales'
  /** توقف‌ها + تیکت‌ها در یک صفحه («موانع») — 'stuck' و 'tickets' همچنان به همین صفحه می‌رسند */
  | 'issues'
  /** همه‌ی پروژه‌ها (شناسنامه) + گزارش دوره‌ای */
  | 'projects';

export interface NavCounts {
  pendingQcCount?: number;
  openStuckCount?: number;
  openTicketCount?: number;
  pendingMaterialCount?: number;
  /** ردیف‌های صف اقدام پیشخوان (همان عدد کاشی «نیازمند اقدام») */
  actionQueueCount?: number;
  /** پروژه‌های دارای توقف باز یا تیکت باز (هر پروژه یک بار) */
  issuesCount?: number;
}

export type BadgeTone = 'danger' | 'brand' | 'info';

export interface NavItem {
  id: ManagerTab;
  label: string; // برچسب کوتاه (سایدبار و شیت)
  shortLabel: string; // برچسب خیلی کوتاه نوار پایین موبایل
  hint: string; // یک خط توضیح در شیت «بیشتر»
  icon: LucideIcon;
  badge?: number;
  badgeTone?: BadgeTone;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ITEM: Record<ManagerTab, Omit<NavItem, 'badge' | 'badgeTone'>> = {
  control: { id: 'control', label: 'پیشخوان', shortLabel: 'پیشخوان', hint: 'صف اقدام و وضعیت امروز', icon: Activity },
  planner: { id: 'planner', label: 'تقویم نصب', shortLabel: 'تقویم', hint: 'برنامه و ظرفیت اکیپ‌ها', icon: CalendarDays },
  qc: { id: 'qc', label: 'کنترل کیفیت', shortLabel: 'QC', hint: 'بازرسی و تایید نهایی کارها', icon: ShieldCheck },
  stuck: { id: 'stuck', label: 'پروژه‌های متوقف', shortLabel: 'متوقف', hint: 'رفع موانع زیر 72 ساعت', icon: AlertOctagon },
  tickets: { id: 'tickets', label: 'تیکت‌ها', shortLabel: 'تیکت', hint: 'شکایات و موارد SLA', icon: AlertTriangle },
  sales: { id: 'sales', label: 'فروش و ظرفیت', shortLabel: 'فروش', hint: 'رزرو لت و تقویم 3 ماهه', icon: Trophy },
  materials: { id: 'materials', label: 'انبار و متریال', shortLabel: 'انبار', hint: 'درخواست، بسته‌بندی و ارسال', icon: Package },
  technicians: { id: 'technicians', label: 'پرسنل و اکیپ‌ها', shortLabel: 'پرسنل', hint: 'نصابان، سرپرستان و تیم‌ها', icon: Users },
  registry: { id: 'registry', label: 'شناسنامه پروژه‌ها', shortLabel: 'شناسنامه', hint: 'سوابق کامل و چاپ شناسنامه', icon: FileCheck2 },
  issues: { id: 'issues', label: 'توقف و تیکت', shortLabel: 'موانع', hint: 'رفع توقف‌ها (72 ساعت) و تیکت‌ها', icon: AlertOctagon },
  projects: { id: 'projects', label: 'پروژه‌ها و گزارش', shortLabel: 'پروژه‌ها', hint: 'همه‌ی پروژه‌ها، شناسنامه و گزارش دوره‌ای', icon: BarChart3 },
  settings: { id: 'settings', label: 'تنظیمات', shortLabel: 'تنظیمات', hint: 'پیکربندی و ابزارهای سیستم', icon: Settings },
};

function withBadges(id: ManagerTab, c: NavCounts): NavItem {
  const base = { ...ITEM[id] } as NavItem;
  const urgent = (c.openStuckCount || 0) + (c.pendingQcCount || 0) + (c.openTicketCount || 0);
  const set = (n: number | undefined, tone: BadgeTone) => {
    if (n && n > 0) {
      base.badge = n;
      base.badgeTone = tone;
    }
  };
  if (id === 'control') set(c.actionQueueCount ?? urgent, 'danger');
  if (id === 'qc') set(c.pendingQcCount, 'brand');
  if (id === 'stuck') set(c.openStuckCount, 'danger');
  if (id === 'tickets') set(c.openTicketCount, 'danger');
  if (id === 'materials') set(c.pendingMaterialCount, 'info');
  if (id === 'issues') set(c.issuesCount ?? (c.openStuckCount || 0) + (c.openTicketCount || 0), 'danger');
  return base;
}

/** بخش‌های منو بر اساس نقش */
export function getNavSections(role: string | undefined, counts: NavCounts): NavSection[] {
  const mk = (ids: ManagerTab[]) => ids.map((id) => withBadges(id, counts));
  if (role === 'CEO') {
    return [{ title: 'مدیریت', items: mk(['registry', 'planner', 'sales']) }];
  }
  // هماهنگ‌کننده‌ی جدا: فقط کار اکیپ‌های خودش؛ انبار و فروش فقط دیدن (utils/coordinatorScope)
  if (role === 'SCHEDULING_COORDINATOR') {
    const items = mk(['materials', 'sales']).map((it) =>
      it.id === 'materials'
        ? { ...it, label: 'وضعیت انبار', shortLabel: 'انبار', hint: 'بار پروژه‌های اکیپ‌های شما (فقط دیدن)' }
        : { ...it, label: 'رزروهای فروش', shortLabel: 'فروش', hint: 'برنامه‌ی فروشنده‌ها (دیدن)' }
    );
    return [
      { title: 'کار روزانه', items: mk(['control', 'planner', 'qc', 'issues']) },
      { title: 'انبار و فروش', items },
    ];
  }
  // مدیر QC و هماهنگ‌کننده: کار روزانه اول، بعد تدارکات، بعد پروژه‌ها و تیم
  return [
    { title: 'کار روزانه', items: mk(['control', 'planner', 'qc', 'issues']) },
    { title: 'تدارکات و فروش', items: mk(['materials', 'sales']) },
    { title: 'پروژه‌ها و تیم', items: mk(['projects', 'technicians', 'settings']) },
  ];
}

/** شناسه‌های قدیمی که حالا داخل یک صفحه‌ی ادغام‌شده‌اند */
export function canonicalTab(tab: ManagerTab): ManagerTab {
  if (tab === 'stuck' || tab === 'tickets') return 'issues';
  return tab;
}

/** آیتم‌های ثابت نوار پایین موبایل؛ بقیه در شیت «بیشتر» قرار می‌گیرند */
export function getBottomBarIds(role: string | undefined): ManagerTab[] {
  if (role === 'CEO') return ['registry', 'planner', 'sales'];
  return ['control', 'planner', 'qc', 'issues'];
}

export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  danger: 'bg-rose-600 text-white',
  brand: 'bg-brand text-on-brand',
  info: 'bg-purple-600 text-white',
};

export function formatBadge(n: number): string {
  return n > 99 ? '99+' : String(n);
}
