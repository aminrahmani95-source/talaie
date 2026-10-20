import { Project, User, Ticket, SystemSettings } from '../types';
import { getUpcomingDays } from './jalali';

export const DEFAULT_MASTER_TOOLS = [
  'دریل بتن‌کن و چکشی',
  'نردبان ۳ متری تلسکوپی',
  'نردبان ۵ متری دوطرفه استاندارد',
  'تراز لیزری ۳۶۰ درجه و خطی',
  'جعبه ابزار دستی (آچار، پیچ‌گوشتی، انبردست، سیم‌چین)',
  'ست پیچ و رولپلاک پروانه‌ای و حلزونی (کناف و گچ)',
  'ترانس برق و تستر فاز / مولتی‌متر',
  'دستگاه تست‌باکس و راه‌انداز موتور شید',
  'ریموت کنترل خام چندکاناله (جهت ست کردن کد)',
  'پایه‌های سقفی و دیواری یدک شید و پرده',
  'ریل‌کش فلزی و روان‌کننده سیلیکونی ریل',
  'اتو بخار پرده ایستاده (جهت فرم‌دهی نهایی)',
  'متر ۵ متری لیزری و نواری',
  'تفنگ چسب حرارتی و چسب آهن فوری',
  'کاور محافظ کف و کاور پرده ضدگردوغبار',
];

export const INITIAL_USERS: User[] = [
  {
    id: 'u-admin',
    name: 'مهندس رضایی (مدیر کیوسی)',
    phone: '09121111111',
    password: '123',
    role: 'QC_MANAGER',
    avatar: '👔',
    active: true,
  },
  {
    id: 'u-lead-1',
    name: 'رضا محمدی (سرپرست اکیپ ۱)',
    phone: '09122222222',
    password: '123',
    role: 'LEAD_TECHNICIAN',
    avatar: '🧢',
    active: true,
  },
  {
    id: 'u-tech-1',
    name: 'علی قاسمی (تکنسین)',
    phone: '09123333333',
    password: '123',
    role: 'TECHNICIAN',
    avatar: '🔧',
    active: true,
  },
  {
    id: 'u-lead-2',
    name: 'مهدی احمدی (سرپرست اکیپ ۲)',
    phone: '09124444444',
    password: '123',
    role: 'LEAD_TECHNICIAN',
    avatar: '🧢',
    active: true,
  },
  {
    id: 'u-tech-2',
    name: 'حسین اکبری (تکنسین)',
    phone: '09125555555',
    password: '123',
    role: 'TECHNICIAN',
    avatar: '🔧',
    active: true,
  },
  {
    id: 'u-tech-3',
    name: 'سعید نوری (تکنسین)',
    phone: '09126666666',
    password: '123',
    role: 'TECHNICIAN',
    avatar: '🔧',
    active: true,
  },
  {
    id: 'u-tech-4',
    name: 'کامران صفری (تکنسین)',
    phone: '09127777777',
    password: '123',
    role: 'TECHNICIAN',
    avatar: '🔧',
    active: true,
  },
];

export const INITIAL_SETTINGS: SystemSettings = {
  visibilityWindowDays: 4, // پیش‌فرض ۴ روز قابل مشاهده برای تکنسین‌ها
  companyName: 'مجموعه تخصصی پرده و شید طلائیه',
  defaultTools: DEFAULT_MASTER_TOOLS,
};

// Generates high quality mock SVG sales proposal for demonstration
function generateMockProposalSvg(code: string, title: string, details: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850" viewBox="0 0 600 850" style="background:#fff;font-family:sans-serif;direction:rtl;">
    <rect width="600" height="850" fill="#fcfcfc" stroke="#e2e8f0" stroke-width="3"/>
    <rect x="0" y="0" width="600" height="90" fill="#1e3a8a"/>
    <text x="560" y="52" fill="#fff" font-size="22" font-weight="bold" text-anchor="end">برگه سفارش و پروپوزال فنی فروش</text>
    <text x="40" y="52" fill="#93c5fd" font-size="16" text-anchor="start">کد: ${code}</text>
    
    <rect x="30" y="115" width="540" height="110" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
    <text x="545" y="145" fill="#334155" font-size="14" font-weight="bold" text-anchor="end">اطلاعات پروژه / کارفرما:</text>
    <text x="545" y="175" fill="#0f172a" font-size="15" text-anchor="end">نام: ${title}</text>
    <text x="545" y="202" fill="#475569" font-size="13" text-anchor="end">واحد فروش: سرکار خانم کاظمی | وضعیت تایید نقشه: تایید نهایی</text>
    
    <rect x="30" y="245" width="540" height="230" rx="8" fill="#fff" stroke="#e2e8f0" stroke-width="1.5"/>
    <rect x="30" y="245" width="540" height="38" rx="8" fill="#f1f5f9"/>
    <text x="545" y="270" fill="#1e293b" font-size="13" font-weight="bold" text-anchor="end">ردیف | نوع پرده / شید | ابعاد (عرض × ارتفاع) | موتور / زنجیر | جهت جمع‌شو</text>
    
    <line x1="30" y1="283" x2="570" y2="283" stroke="#cbd5e1"/>
    <text x="545" y="315" fill="#0f172a" font-size="13" text-anchor="end">۱. شید رول بلک‌اوت پذیرایی (۲۸۰ × ۳۱۰ cm) - موتور سامفی رادیویی - چپ</text>
    <text x="545" y="350" fill="#0f172a" font-size="13" text-anchor="end">۲. حریر کالیفرنیا پلیسه دوبل (۵۲۰ × ۳۱۰ cm) - ریل برقی بی‌صدا - وسط‌بازشو</text>
    <text x="545" y="385" fill="#0f172a" font-size="13" text-anchor="end">۳. زبرا دو مکانیزم اتاق خواب (۱۸۰ × ۲۴۰ cm) - زنجیر استیل - راست</text>
    <text x="545" y="420" fill="#0f172a" font-size="13" text-anchor="end">۴. والان دکور مخمل ژاکارد (۱۲۰ × ۳۱۰ cm) - پایه مخفی - طرفین</text>
    <text x="545" y="455" fill="#2563eb" font-size="12" font-weight="bold" text-anchor="end">نکته حیاتی: سقف کناف دارای قوطی‌کشی آهنی پشت لبه نورمخفی است.</text>

    <rect x="30" y="495" width="540" height="150" rx="8" fill="#fffbeb" stroke="#fef3c7" stroke-width="2"/>
    <text x="545" y="525" fill="#92400e" font-size="14" font-weight="bold" text-anchor="end">یادداشت‌های فنی سرپرست فروش:</text>
    <text x="545" y="555" fill="#78350f" font-size="13" text-anchor="end">• ${details}</text>
    <text x="545" y="585" fill="#78350f" font-size="13" text-anchor="end">• حتماً قبل از سوراخکاری سقف، کابل برق روشنایی چک شود.</text>
    <text x="545" y="615" fill="#78350f" font-size="13" text-anchor="end">• کارفرما روی خط اتوی والان بسیار حساس است، بخاردهی الزامی است.</text>

    <rect x="30" y="665" width="250" height="90" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="260" y="695" fill="#64748b" font-size="12" text-anchor="end">مهر و امضای مهندسی فروش</text>
    <circle cx="150" cy="715" r="22" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
    <text x="150" y="720" fill="#1d4ed8" font-size="11" text-anchor="middle">تایید طراحی</text>

    <rect x="320" y="665" width="250" height="90" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="550" y="695" fill="#64748b" font-size="12" text-anchor="end">تاییدیه کنترل کیفیت (QC)</text>
    <circle cx="440" cy="715" r="22" fill="#dcfce7" stroke="#22c55e" stroke-width="2"/>
    <text x="440" y="720" fill="#15803d" font-size="11" text-anchor="middle">QC APPROVED</text>

    <text x="300" y="810" fill="#94a3b8" font-size="12" text-anchor="middle">سیستم یکپارچه عملیات فنی و نصب طلائیه - سند غیرقابل استناد به غیر</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export function getInitialProjects(): Project[] {
  const days = getUpcomingDays(15);
  const d0 = days[0]?.dateKey || '2026-10-20'; // امروز
  const d1 = days[1]?.dateKey || '2026-10-21'; // فردا
  const d2 = days[2]?.dateKey || '2026-10-22'; // پس‌فردا
  const d3 = days[3]?.dateKey || '2026-10-23'; // روز ۴
  const d5 = days[5]?.dateKey || '2026-10-25'; // هفته آینده

  return [
    {
      id: 'p-1',
      code: 'PRJ-101',
      title: 'پروژه پنت‌هاوس زعفرانیه (مهندس سهرابی)',
      customerName: 'مهندس نوید سهرابی',
      customerPhone: '09129876543',
      address: 'زعفرانیه، خیابان آصف، کوچه بهار، پلاک ۱۲، زنگ ۹',
      locationUrl: 'https://nshn.ir/maps',
      shadePanels: 6,
      curtainPanels: 4,
      mechanismType: 'شید موتوری هوشمند سامفی + پرده برقی ریل بی‌صدا',
      approximateArea: 65,
      specialNotes: 'کلید و پریزهای هوشمند خانه به سیستم Control4 وصل است؛ با مسئول هوشمندسازی ساختمان آقای مهندس فلاح هماهنگ شود.',
      proposalImages: [
        {
          id: 'img-1',
          title: 'برگه مشخصات فنی و نقشه‌های اجرایی زعفرانیه',
          url: generateMockProposalSvg('PRJ-101', 'پنت‌هاوس زعفرانیه - سهرابی', 'شید بلک‌اوت پشت پنجره قدی بالکن با ریموت ۴ کانال ست شود'),
          uploadedAt: '1405/07/20',
        },
      ],
      scheduledDate: d0,
      scheduledTime: '09:30',
      leadTechnicianId: 'u-lead-1',
      assignedTechnicianIds: ['u-lead-1', 'u-tech-1'],
      isFullTools: true,
      toolsRequired: DEFAULT_MASTER_TOOLS,
      customToolsNotes: 'رولپلاک فلزی مخصوص بتن مسلح به همراه ۴ عدد پایه ال کمکی اضافه شود',
      status: 'IN_PROGRESS',
      completionPhotos: [],
      qcStatus: 'PENDING',
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-20T08:00:00Z',
    },
    {
      id: 'p-2',
      code: 'PRJ-102',
      title: 'دفتر مرکزی هلدینگ پارس (برج میلینیوم)',
      customerName: 'آقای شایگان (مدیر تدارکات)',
      customerPhone: '09121234567',
      address: 'سعادت‌آباد، بلوار شهرداری، برج میلینیوم، طبقه ۱۴',
      locationUrl: 'https://balad.ir/maps',
      shadePanels: 14,
      curtainPanels: 0,
      mechanismType: 'شید اسکرین ۳ درصد سان‌اسکرین با گیربکس صنعتی',
      approximateArea: 110,
      specialNotes: 'نصب فقط تا قبل از ساعت اداری (تا ۱۲ ظهر) باید تمام شود.',
      proposalImages: [
        {
          id: 'img-2',
          title: 'نقشه لت‌های اداری برج میلینیوم',
          url: generateMockProposalSvg('PRJ-102', 'هلدینگ پارس - سعادت‌آباد', '۱۴ عدد شید با گیربکس زنجیر استیل مقاوم، پایه دوبل در ستون‌های میانی'),
          uploadedAt: '1405/07/20',
        },
      ],
      scheduledDate: d0,
      scheduledTime: '13:30',
      leadTechnicianId: 'u-lead-2',
      assignedTechnicianIds: ['u-lead-2', 'u-tech-2', 'u-tech-3'],
      isFullTools: false,
      toolsRequired: [
        'دریل بتن‌کن و چکشی',
        'نردبان ۵ متری دوطرفه استاندارد',
        'تراز لیزری ۳۶۰ درجه و خطی',
        'جعبه ابزار دستی (آچار، پیچ‌گوشتی، انبردست، سیم‌چین)',
        'ست پیچ و رولپلاک پروانه‌ای و حلزونی (کناف و گچ)',
        'متر ۵ متری لیزری و نواری',
      ],
      status: 'SCHEDULED',
      completionPhotos: [],
      qcStatus: 'NOT_STARTED',
      createdAt: '2026-10-18T11:00:00Z',
      updatedAt: '2026-10-19T09:00:00Z',
    },
    {
      id: 'p-3',
      code: 'PRJ-103',
      title: 'ویلای لواسان (خانواده دکتر پیروز)',
      customerName: 'خانم پیروز',
      customerPhone: '09128887766',
      address: 'لواسان، بلوار باستی، انتهای گلستان سوم، ویلای باغ‌بهار',
      locationUrl: 'https://maps.google.com',
      shadePanels: 8,
      curtainPanels: 6,
      mechanismType: 'شید زبرا اتاق خواب‌ها + حریر و والان پذیرایی دوبلکس',
      approximateArea: 95,
      specialNotes: 'ارتفاع سقف دوبلکس ۴ متر و نیم است؛ حتماً نردبان ۵ متری لازم است.',
      proposalImages: [
        {
          id: 'img-3',
          title: 'برگه تاییدیه پارچه‌ها و اتصالات ویلای لواسان',
          url: generateMockProposalSvg('PRJ-103', 'ویلای لواسان - دکتر پیروز', 'والان مخمل ترک + اتوبخار ایستاده برای فرم‌دهی نهایی پلیسه‌ها الزامی است'),
          uploadedAt: '1405/07/19',
        },
      ],
      scheduledDate: d1,
      scheduledTime: '10:00',
      leadTechnicianId: 'u-lead-1',
      assignedTechnicianIds: ['u-lead-1', 'u-tech-1', 'u-tech-4'],
      isFullTools: true,
      toolsRequired: DEFAULT_MASTER_TOOLS,
      status: 'SCHEDULED',
      completionPhotos: [],
      qcStatus: 'NOT_STARTED',
      createdAt: '2026-10-19T14:00:00Z',
      updatedAt: '2026-10-19T14:00:00Z',
    },
    {
      id: 'p-4',
      code: 'PRJ-104',
      title: 'آپارتمان نیاوران (آقای مظفری)',
      customerName: 'آقای مظفری',
      customerPhone: '09123334455',
      address: 'نیاوران، خ بوکان، کوچه مرجان، پلاک ۴',
      shadePanels: 3,
      curtainPanels: 2,
      mechanismType: 'شید رول ساده + توری شید',
      approximateArea: 32,
      proposalImages: [
        {
          id: 'img-4',
          title: 'پروپوزال فروش نیاوران',
          url: generateMockProposalSvg('PRJ-104', 'آپارتمان نیاوران - مظفری', 'نصب سریع ۳ لت شید با پایه سقفی استاندارد'),
          uploadedAt: '1405/07/20',
        },
      ],
      scheduledDate: d2,
      scheduledTime: '11:00',
      leadTechnicianId: 'u-lead-2',
      assignedTechnicianIds: ['u-lead-2', 'u-tech-2'],
      isFullTools: false,
      toolsRequired: [
        'دریل بتن‌کن و چکشی',
        'نردبان ۳ متری تلسکوپی',
        'تراز لیزری ۳۶۰ درجه و خطی',
        'ست پیچ و رولپلاک پروانه‌ای و حلزونی (کناف و گچ)',
      ],
      status: 'SCHEDULED',
      completionPhotos: [],
      qcStatus: 'NOT_STARTED',
      createdAt: '2026-10-20T08:00:00Z',
      updatedAt: '2026-10-20T08:00:00Z',
    },
    {
      id: 'p-5',
      code: 'PRJ-105',
      title: 'کلینیک پوست و مو تجریش',
      customerName: 'دکتر صبوری',
      customerPhone: '09125556677',
      address: 'میدان تجریش، خیابان فناخسرو، پلاک ۳۳، ساختمان پزشکان',
      shadePanels: 10,
      curtainPanels: 0,
      mechanismType: 'شید آنتی‌باکتریال با روکش قابل شستشو',
      approximateArea: 55,
      proposalImages: [],
      scheduledDate: d3,
      scheduledTime: '15:00',
      leadTechnicianId: 'u-lead-1',
      assignedTechnicianIds: ['u-lead-1', 'u-tech-3'],
      isFullTools: true,
      toolsRequired: DEFAULT_MASTER_TOOLS,
      status: 'SCHEDULED',
      completionPhotos: [],
      qcStatus: 'NOT_STARTED',
      createdAt: '2026-10-20T09:00:00Z',
      updatedAt: '2026-10-20T09:00:00Z',
    },
    {
      id: 'p-6',
      code: 'PRJ-106',
      title: 'واحد دوبلکس فرمانیه (مهندس حیدری) - برنامه‌ریزی ماهانه',
      customerName: 'مهندس حیدری',
      customerPhone: '09124443322',
      address: 'فرمانیه شرقی، خیابان عسگری، کوچه گلها، برج باغ آریا',
      shadePanels: 12,
      curtainPanels: 8,
      mechanismType: 'مجموعه کامل شید و والان اتوماتیک با ریموت ۱۵ کانال',
      approximateArea: 140,
      proposalImages: [],
      scheduledDate: d5,
      scheduledTime: '10:00',
      leadTechnicianId: 'u-lead-2',
      assignedTechnicianIds: ['u-lead-2', 'u-tech-1', 'u-tech-2'],
      isFullTools: true,
      toolsRequired: DEFAULT_MASTER_TOOLS,
      status: 'SCHEDULED',
      completionPhotos: [],
      qcStatus: 'NOT_STARTED',
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-20T10:00:00Z',
    },
  ];
}

export const INITIAL_TICKETS: Ticket[] = [
  {
    id: 't-1',
    projectId: 'p-1',
    projectCode: 'PRJ-101',
    projectTitle: 'پروژه پنت‌هاوس زعفرانیه',
    authorId: 'u-lead-1',
    authorName: 'رضا محمدی (سرپرست)',
    type: 'WALL_ISSUE',
    description: 'در لبه غربی کناف، زیرسازی قوطی آهن وجود ندارد و فقط گچ‌برگ است. برای نصب ۲ لت آخر شید موتوری نیاز به مهاربندی با براکت دیواری تقویت‌شده داریم.',
    photos: [],
    status: 'OPEN',
    createdAt: '1405/07/20 - 10:15',
  },
];

// Storage keys
const STORAGE_KEYS = {
  PROJECTS: 'talaie_projects_v1',
  USERS: 'talaie_users_v1',
  TICKETS: 'talaie_tickets_v1',
  SETTINGS: 'talaie_settings_v1',
  CURRENT_USER: 'talaie_current_user_v1',
};

export const StorageService = {
  getProjects(): Project[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (!raw) {
      const initial = getInitialProjects();
      this.saveProjects(initial);
      return initial;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return getInitialProjects();
    }
  },

  saveProjects(projects: Project[]) {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  },

  getUsers(): User[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      this.saveUsers(INITIAL_USERS);
      return INITIAL_USERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_USERS;
    }
  },

  saveUsers(users: User[]) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  getTickets(): Ticket[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (!raw) {
      this.saveTickets(INITIAL_TICKETS);
      return INITIAL_TICKETS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_TICKETS;
    }
  },

  saveTickets(tickets: Ticket[]) {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
  },

  getSettings(): SystemSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      this.saveSettings(INITIAL_SETTINGS);
      return INITIAL_SETTINGS;
    }
    try {
      return { ...INITIAL_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return INITIAL_SETTINGS;
    }
  },

  saveSettings(settings: SystemSettings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getCurrentUser(): User {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!raw) {
      const defaultUser = INITIAL_USERS[0]; // Admin by default
      this.setCurrentUser(defaultUser);
      return defaultUser;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_USERS[0];
    }
  },

  setCurrentUser(user: User) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  },

  // Export JSON backup for safe archiving
  exportBackup(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      projects: this.getProjects(),
      users: this.getUsers(),
      tickets: this.getTickets(),
      settings: this.getSettings(),
    };
    return JSON.stringify(backup, null, 2);
  },

  // Import JSON backup
  importBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.projects) this.saveProjects(data.projects);
      if (data.users) this.saveUsers(data.users);
      if (data.tickets) this.saveTickets(data.tickets);
      if (data.settings) this.saveSettings(data.settings);
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  },

  // Reset to initial demo state
  resetAll() {
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.TICKETS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  },
};
