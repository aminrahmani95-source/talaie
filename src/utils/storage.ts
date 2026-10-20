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
  companyName: 'گالری طلایی | طراحی، پرده و شید',
  defaultTools: DEFAULT_MASTER_TOOLS,
};

// Generates high quality mock SVG sales proposal in Talaei Gallery brand colors (#C1A056, #212121)
function generateMockProposalSvg(code: string, title: string, details: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850" viewBox="0 0 600 850" style="background:#FAF7F2;font-family:sans-serif;direction:rtl;">
    <rect width="600" height="850" fill="#FCFAF7" stroke="#E8E4DC" stroke-width="2"/>
    <rect x="0" y="0" width="600" height="100" fill="#212121"/>
    
    <!-- Gold accent line -->
    <rect x="0" y="96" width="600" height="4" fill="#C1A056"/>
    
    <text x="560" y="46" fill="#C1A056" font-size="22" font-weight="bold" text-anchor="end">گالری طلایی | TALAEI GALLERY</text>
    <text x="560" y="75" fill="#E8E4DC" font-size="14" text-anchor="end">برگه سفارش، نقشه فنی و پروپوزال واحد فروش</text>
    <text x="40" y="58" fill="#C1A056" font-size="16" font-weight="bold" text-anchor="start">کد سفارش: ${code}</text>
    
    <rect x="30" y="125" width="540" height="105" rx="10" fill="#FAF7F2" stroke="#E8E4DC" stroke-width="1.5"/>
    <text x="545" y="155" fill="#C1A056" font-size="14" font-weight="bold" text-anchor="end">اطلاعات پروژه / کارفرما:</text>
    <text x="545" y="185" fill="#212121" font-size="16" font-weight="bold" text-anchor="end">نام کارفرما: ${title}</text>
    <text x="545" y="212" fill="#71717A" font-size="13" text-anchor="end">مهندسی فروش: سرکار خانم کاظمی | سیستم اجرای پرده و شید دکوراتیو</text>
    
    <rect x="30" y="250" width="540" height="230" rx="10" fill="#FFFFFF" stroke="#E8E4DC" stroke-width="1.5"/>
    <rect x="30" y="250" width="540" height="38" rx="10" fill="#212121"/>
    <text x="545" y="275" fill="#C1A056" font-size="13" font-weight="bold" text-anchor="end">ردیف | نوع پرده / شید | ابعاد (عرض × ارتفاع) | مکانیزم / موتور | نحوه جمع‌شو</text>
    
    <line x1="30" y1="288" x2="570" y2="288" stroke="#E8E4DC"/>
    <text x="545" y="322" fill="#212121" font-size="13" text-anchor="end">۱. شید رول بلک‌اوت پذیرایی (۲۸۰ × ۳۱۰ cm) - موتور سامفی رادیویی - چپ‌جمع‌شو</text>
    <text x="545" y="358" fill="#212121" font-size="13" text-anchor="end">۲. حریر کالیفرنیا پلیسه دوبل (۵۲۰ × ۳۱۰ cm) - ریل برقی بی‌صدا طلایی - وسط‌بازشو</text>
    <text x="545" y="394" fill="#212121" font-size="13" text-anchor="end">۳. زبرا دو مکانیزم اتاق خواب (۱۸۰ × ۲۴۰ cm) - زنجیر استیل طلایی - راست</text>
    <text x="545" y="430" fill="#212121" font-size="13" text-anchor="end">۴. والان دکور مخمل ژاکارد لوکس (۱۲۰ × ۳۱۰ cm) - پایه مخفی - طرفین</text>
    <text x="545" y="465" fill="#D5733A" font-size="12" font-weight="bold" text-anchor="end">نکته حیاتی: سقف کناف دارای قوطی‌کشی آهنی پشت لبه نورمخفی است.</text>

    <rect x="30" y="500" width="540" height="145" rx="10" fill="#FDFBF7" stroke="#C1A056" stroke-width="1.5"/>
    <text x="545" y="530" fill="#C1A056" font-size="14" font-weight="bold" text-anchor="end">یادداشت‌های اختصاصی مهندسی فروش طلایی:</text>
    <text x="545" y="560" fill="#4B5563" font-size="13" text-anchor="end">• ${details}</text>
    <text x="545" y="590" fill="#4B5563" font-size="13" text-anchor="end">• تراز دقیق لبه پایینی شیدها با خط افق قرنیز الزامی است.</text>
    <text x="545" y="620" fill="#4B5563" font-size="13" text-anchor="end">• کارفرما بر اتوکشی بدون چروک والان بسیار حساس است؛ اتوبخار ایستاده الزامی است.</text>

    <rect x="30" y="665" width="250" height="90" rx="10" fill="#FFFFFF" stroke="#E8E4DC"/>
    <text x="260" y="695" fill="#71717A" font-size="12" text-anchor="end">مهر و امضای مهندسی فروش</text>
    <circle cx="150" cy="718" r="22" fill="#FAF7F2" stroke="#C1A056" stroke-width="2"/>
    <text x="150" y="723" fill="#C1A056" font-size="11" font-weight="bold" text-anchor="middle">تایید طراحی</text>

    <rect x="320" y="665" width="250" height="90" rx="10" fill="#FFFFFF" stroke="#E8E4DC"/>
    <text x="550" y="695" fill="#71717A" font-size="12" text-anchor="end">تاییدیه کنترل کیفیت (QC)</text>
    <circle cx="440" cy="718" r="22" fill="#FAF7F2" stroke="#194840" stroke-width="2"/>
    <text x="440" y="723" fill="#194840" font-size="11" font-weight="bold" text-anchor="middle">QC APPROVED</text>

    <text x="300" y="810" fill="#A1A1AA" font-size="12" text-anchor="middle">گالری طلایی (talaei.ir) - سامانه یکپارچه مدیریت فنی و کیوسی نصب</text>
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
      mechanismType: 'شید موتوری هوشمند سامفی + پرده برقی ریل بی‌صدا طلایی',
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
  PROJECTS: 'talaie_projects_v2',
  USERS: 'talaie_users_v2',
  TICKETS: 'talaie_tickets_v2',
  SETTINGS: 'talaie_settings_v2',
  CURRENT_USER: 'talaie_current_user_v2',
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
      version: '2.0',
      brand: 'گالری طلایی',
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
