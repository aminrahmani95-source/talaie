import { Project, User, Ticket, SystemSettings } from '../types';
import { getUpcomingDays } from './jalali';

export const DEFAULT_MASTER_TOOLS = [
  'دریل بتن‌کن و چکشی',
  'نردبان 3 متری تلسکوپی',
  'نردبان 5 متری دوطرفه استاندارد',
  'تراز لیزری 360 درجه و خطی',
  'جعبه ابزار دستی (آچار، پیچ‌گوشتی، انبردست، سیم‌چین)',
  'ست پیچ و رولپلاک پروانه‌ای و حلزونی (کناف و گچ)',
  'ترانس برق و تستر فاز / مولتی‌متر',
  'دستگاه تست‌باکس و راه‌انداز موتور شید',
  'ریموت کنترل خام چندکاناله (جهت ست کردن کد)',
  'پایه‌های سقفی و دیواری یدک شید و پرده',
  'ریل‌کش فلزی و روان‌کننده سیلیکونی ریل',
  'اتو بخار پرده ایستاده (جهت فرم‌دهی نهایی)',
  'متر 5 متری لیزری و نواری',
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
    name: 'رضا محمدی (سرپرست اکیپ 1)',
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
    name: 'مهدی احمدی (سرپرست اکیپ 2)',
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
  visibilityWindowDays: 4, // پیش‌فرض 4 روز قابل مشاهده برای تکنسین‌ها
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
    <text x="545" y="322" fill="#212121" font-size="13" text-anchor="end">1. شید رول بلک‌اوت پذیرایی (280 × 310 cm) - موتور سامفی رادیویی - چپ‌جمع‌شو</text>
    <text x="545" y="358" fill="#212121" font-size="13" text-anchor="end">2. حریر کالیفرنیا پلیسه دوبل (520 × 310 cm) - ریل برقی بی‌صدا طلایی - وسط‌بازشو</text>
    <text x="545" y="394" fill="#212121" font-size="13" text-anchor="end">3. زبرا دو مکانیزم اتاق خواب (180 × 240 cm) - زنجیر استیل طلایی - راست</text>
    <text x="545" y="430" fill="#212121" font-size="13" text-anchor="end">4. والان دکور مخمل ژاکارد لوکس (120 × 310 cm) - پایه مخفی - طرفین</text>
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

function generateMockSitePhoto(title: string, type: 'BEFORE' | 'AFTER'): string {
  const isBefore = type === 'BEFORE';
  const bgColor = isBefore ? '#ECE8E1' : '#212121';
  const textColor = isBefore ? '#6B7280' : '#C1A056';
  const bannerBg = isBefore ? '#D97706' : '#10B981';
  const label = isBefore ? 'عکس قبل از نصب (پنجره و قاب خام)' : 'عکس بعد از اتمام نصب (پرده و شید لوکس)';
  const desc = isBefore
    ? 'بررسی زیرسازی کناف، عدم وجود قوطی فلزی و لوله‌کشی توکار'
    : 'پرده‌ها و شیدهای برقی نصب‌شده با تراز شاقولی و اتوکشی نهایی';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450" style="background:${bgColor};font-family:sans-serif;direction:rtl;">
    <rect width="600" height="450" fill="${bgColor}"/>
    <rect x="80" y="60" width="440" height="300" rx="8" fill="${isBefore ? '#F3F0EA' : '#151515'}" stroke="${isBefore ? '#C5BEB3' : '#C1A056'}" stroke-width="${isBefore ? '3' : '4'}"/>
    ${isBefore ? `
      <line x1="80" y1="210" x2="520" y2="210" stroke="#C5BEB3" stroke-width="2"/>
      <line x1="300" y1="60" x2="300" y2="360" stroke="#C5BEB3" stroke-width="2"/>
      <circle cx="300" cy="210" r="16" fill="none" stroke="#D97706" stroke-width="2" stroke-dasharray="4"/>
      <text x="300" y="215" fill="#D97706" font-size="11" font-weight="bold" text-anchor="middle">محل اتصال پایه</text>
    ` : `
      <rect x="100" y="80" width="180" height="260" fill="#2E2E2E" stroke="#C1A056" stroke-width="1.5"/>
      <rect x="320" y="80" width="180" height="260" fill="#2E2E2E" stroke="#C1A056" stroke-width="1.5"/>
      <path d="M100 80 Q145 100 190 80 Q235 100 280 80 L280 340 Q235 320 190 340 Q145 320 100 340 Z" fill="#C1A056" fill-opacity="0.35"/>
      <path d="M320 80 Q365 100 410 80 Q455 100 500 80 L500 340 Q455 320 410 340 Q365 320 320 340 Z" fill="#C1A056" fill-opacity="0.35"/>
      <line x1="80" y1="76" x2="520" y2="76" stroke="#C1A056" stroke-width="6"/>
      <circle cx="510" cy="76" r="6" fill="#10B981"/>
    `}
    <rect x="0" y="0" width="600" height="42" fill="${bannerBg}"/>
    <text x="300" y="27" fill="#FFFFFF" font-size="15" font-weight="bold" text-anchor="middle">${label}</text>
    <rect x="0" y="390" width="600" height="60" fill="#000000" fill-opacity="0.75"/>
    <text x="560" y="415" fill="${textColor}" font-size="13" font-weight="bold" text-anchor="end">${title}</text>
    <text x="560" y="435" fill="#E5E7EB" font-size="11" text-anchor="end">${desc}</text>
    <text x="40" y="425" fill="#C1A056" font-size="11" font-weight="bold" text-anchor="start">TALAEI QC VERIFIED</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function generateMockSignatureSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="150" viewBox="0 0 400 150">
    <path d="M50 90 Q 90 20, 140 70 T 220 80 Q 250 40, 290 85 T 350 75 Q 310 130, 200 120 T 90 105" 
          fill="none" stroke="#C1A056" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M120 75 Q 160 50, 180 90" fill="none" stroke="#C1A056" stroke-width="3" stroke-linecap="round"/>
    <circle cx="170" cy="40" r="3" fill="#C1A056"/>
    <circle cx="185" cy="42" r="3" fill="#C1A056"/>
    <path d="M250 80 L 320 110" fill="none" stroke="#C1A056" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export function getInitialProjects(): Project[] {
  const days = getUpcomingDays(15);
  const d0 = days[0]?.dateKey || '2026-10-20'; // امروز
  const d1 = days[1]?.dateKey || '2026-10-21'; // فردا
  const d2 = days[2]?.dateKey || '2026-10-22'; // پس‌فردا
  const d3 = days[3]?.dateKey || '2026-10-23'; // روز 4
  const d5 = days[5]?.dateKey || '2026-10-25'; // هفته آینده

  return [
    {
      id: 'p-1',
      code: 'PRJ-101',
      title: 'پروژه پنت‌هاوس زعفرانیه (مهندس سهرابی)',
      customerName: 'مهندس نوید سهرابی',
      customerPhone: '09129876543',
      address: 'زعفرانیه، خیابان آصف، کوچه بهار، پلاک 12، زنگ 9',
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
          url: generateMockProposalSvg('PRJ-101', 'پنت‌هاوس زعفرانیه - سهرابی', 'شید بلک‌اوت پشت پنجره قدی بالکن با ریموت 4 کانال ست شود'),
          uploadedAt: '1405/07/20',
        },
      ],
      scheduledDate: d0,
      scheduledTime: '09:30',
      leadTechnicianId: 'u-lead-1',
      assignedTechnicianIds: ['u-lead-1', 'u-tech-1'],
      isFullTools: true,
      toolsRequired: DEFAULT_MASTER_TOOLS,
      customToolsNotes: 'رولپلاک فلزی مخصوص بتن مسلح به همراه 4 عدد پایه ال کمکی اضافه شود',
      status: 'COMPLETED',
      completionNotes: 'نصب پرده‌های برقی و شیدهای هوشمند با تراز لیزری 360 درجه انجام شد. ریموت 4 کاناله سامفی ست شد و به جناب مهندس سهرابی تحویل گردید.',
      beforePhotos: [
        generateMockSitePhoto('زعفرانیه - وضعیت دیوار و کناف قبل از نصب', 'BEFORE'),
        generateMockSitePhoto('زعفرانیه - بررسی قوطی فلزی و اتصالات اولیه', 'BEFORE'),
      ],
      afterPhotos: [
        generateMockSitePhoto('زعفرانیه - نمای پرده حریر و شید هوشمند نهایی', 'AFTER'),
        generateMockSitePhoto('زعفرانیه - تست جمع‌شو و عملکرد موتور سامفی', 'AFTER'),
      ],
      completionPhotos: [
        generateMockSitePhoto('زعفرانیه - نمای پرده حریر و شید هوشمند نهایی', 'AFTER'),
      ],
      handoverChecklist: {
        remoteTested: true,
        leveled: true,
        ironedPleated: true,
        cleaned: true,
      },
      customerSignature: generateMockSignatureSvg(),
      customerSatisfaction: 5,
      startedAt: '2026-10-20T09:30:00Z',
      completedAt: '2026-10-20T12:05:00Z',
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
      address: 'سعادت‌آباد، بلوار شهرداری، برج میلینیوم، طبقه 14',
      locationUrl: 'https://balad.ir/maps',
      shadePanels: 14,
      curtainPanels: 0,
      mechanismType: 'شید اسکرین 3 درصد سان‌اسکرین با گیربکس صنعتی',
      approximateArea: 110,
      specialNotes: 'نصب فقط تا قبل از ساعت اداری (تا 12 ظهر) باید تمام شود.',
      proposalImages: [
        {
          id: 'img-2',
          title: 'نقشه لت‌های اداری برج میلینیوم',
          url: generateMockProposalSvg('PRJ-102', 'هلدینگ پارس - سعادت‌آباد', '14 عدد شید با گیربکس زنجیر استیل مقاوم، پایه دوبل در ستون‌های میانی'),
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
        'نردبان 5 متری دوطرفه استاندارد',
        'تراز لیزری 360 درجه و خطی',
        'جعبه ابزار دستی (آچار، پیچ‌گوشتی، انبردست، سیم‌چین)',
        'ست پیچ و رولپلاک پروانه‌ای و حلزونی (کناف و گچ)',
        'متر 5 متری لیزری و نواری',
      ],
      status: 'IN_PROGRESS',
      startedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      beforePhotos: [
        generateMockSitePhoto('برج میلینیوم - پنجره‌های اداری قبل از نصب شید', 'BEFORE'),
      ],
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
      specialNotes: 'ارتفاع سقف دوبلکس 4 متر و نیم است؛ حتماً نردبان 5 متری لازم است.',
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
      address: 'نیاوران، خ بوکان، کوچه مرجان، پلاک 4',
      shadePanels: 3,
      curtainPanels: 2,
      mechanismType: 'شید رول ساده + توری شید',
      approximateArea: 32,
      proposalImages: [
        {
          id: 'img-4',
          title: 'پروپوزال فروش نیاوران',
          url: generateMockProposalSvg('PRJ-104', 'آپارتمان نیاوران - مظفری', 'نصب سریع 3 لت شید با پایه سقفی استاندارد'),
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
        'نردبان 3 متری تلسکوپی',
        'تراز لیزری 360 درجه و خطی',
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
      address: 'میدان تجریش، خیابان فناخسرو، پلاک 33، ساختمان پزشکان',
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
      mechanismType: 'مجموعه کامل شید و والان اتوماتیک با ریموت 15 کانال',
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
    description: 'در لبه غربی کناف، زیرسازی قوطی آهن وجود ندارد و فقط گچ‌برگ است. برای نصب 2 لت آخر شید موتوری نیاز به مهاربندی با براکت دیواری تقویت‌شده داریم.',
    photos: [],
    status: 'OPEN',
    createdAt: '1405/07/20 - 10:15',
  },
];

// Storage keys
const STORAGE_KEYS = {
  PROJECTS: 'talaie_projects_v5',
  USERS: 'talaie_users_v5',
  TICKETS: 'talaie_tickets_v5',
  SETTINGS: 'talaie_settings_v5',
  CURRENT_USER: 'talaie_current_user_v5',
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
