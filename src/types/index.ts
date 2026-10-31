export type UserRole = 'QC_MANAGER' | 'LEAD_TECHNICIAN' | 'TECHNICIAN';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
}

export type ProjectStatus = 
  | 'MEASUREMENT_PENDING' // در انتظار بازدید و اندازه‌گیری دوم (BPMN Step 1)
  | 'SCHEDULED'           // زمان‌بندی شده برای نصب (BPMN Step 2)
  | 'EN_ROUTE'            // در مسیر پروژه
  | 'IN_PROGRESS'         // در حال نصب سر پروژه
  | 'STUCK'               // استاک / متوقف شده (گیت‌وی رفع استاک زیر 72 ساعت)
  | 'COMPLETED'           // نصب پایان یافته و در انتظار بررسی QC
  | 'CANCELLED';          // لغو شده

export type QCStatus = 
  | 'NOT_STARTED'  // هنوز نصب نشده
  | 'PENDING'      // در انتظار بررسی QC
  | 'APPROVED'     // تایید کیفی شده (QC Approved)
  | 'REJECTED';    // عدم تایید کیفی / نیاز به اصلاح

export interface ProposalImage {
  id: string;
  title: string;
  url: string; // Base64 or URL
  uploadedAt: string;
}

// چک‌لیست استانداردهای طلایی تحویل و نصب (White-Glove Service)
export interface HandoverChecklist {
  floorProtectiveClothUsed: boolean; // پهن کردن آستری محافظ کف زیر ابزار جهت جلوگیری از خط و خش روی پارکت/سنگ
  cradleBracketsSecured: boolean; // مهاربندی کرپی‌های شید و عودت کرپی‌های خالی به وانت
  remoteTested: boolean; // تست حرکت روان ریل، موتور سامفی و ریموت کنترل برقی
  leveled: boolean; // بررسی تراز لیزری ۳۶۰ درجه و شاقول بودن قاب و پایه‌ها
  ironedPleated: boolean; // مرتب‌سازی چین‌ها و اتوکشی نهایی پرده
  cleaned: boolean; // نظافت کامل محیط و جمع‌آوری تمام ضایعات و گرد و خاک
  handoverChecklistNotes?: Record<string, string>; // توضیحات موارد تاییدنشده
}

// بازدید پیش از نصب و اندازه‌گیری دوم (BPMN Step: کارشناس فنی)
export interface PreInstallationInspection {
  drywallStructureOk: boolean; // قوطی‌کشی کناف و مهاربندی سقف کاذب بررسی شد
  electricalWiringOk: boolean; // کابل‌کشی و تغذیه برق موتورهای برقی آماده است
  spaceAccessible: boolean; // فضا تخلیه و دسترسی به درگاه‌ها آزاد است
  measurementsMatched: boolean; // ابعاد اندازه‌گیری دوم با پیش‌فاکتور تطبیق دارد
  status: 'APPROVED' | 'SPACE_NOT_READY';
  inspectedBy?: string;
  inspectedAt?: string;
  notes?: string;
}

// رخداد استاک (پروژه‌های گیر کرده نیازمند اقدام فوری زیر 72 ساعت طبق KPI دفتر)
export type StuckCategory = 
  | 'FABRIC_SHORTAGE'             // کسری پارچه
  | 'FABRIC_DEFECT'               // پارگی یا عیب در بافت پارچه
  | 'HARDWARE_SHORTAGE'           // کسری یراق، پایه یا براکت دیواری
  | 'MEASUREMENT_MISMATCH'        // مغایرت ابعاد پنجره با پرده دوخته‌شده
  | 'DRYWALL_SUBSTRUCTURE_ISSUE'  // عدم زیرسازی کناف یا سستی دیوار
  | 'POWER_FAILURE'               // قطعی یا عدم سیم‌کشی برق موتور
  | 'OTHER';

export type FmeaRootCause = 
  | 'SALES_ORDER_ERROR'    // اشتباه در سفارش‌گذاری فروش
  | 'SUPPLIER_DEFECT'      // خطای تامین‌کننده یراق یا موتور
  | 'SEWING_WORKSHOP_ERROR'// اشتباه در کارگاه دوخت و خیاطی
  | 'LOGISTICS_DAMAGE'     // آسیب حین بارگیری یا حمل با ناوگان
  | 'SITE_PREP_ERROR';     // عدم آمادگی بستر ساختمان مشتری

export interface StuckIncident {
  id: string;
  stuckAt: string; // ISO date timestamp
  category: StuckCategory;
  description: string;
  reportedBy: string;
  photos: string[];
  rootCause?: FmeaRootCause; // ثبت کد خطای FMEA
  resolutionStatus: 'OPEN' | 'RESOLVING' | 'RESOLVED';
  resolvedAt?: string;
  resolutionNote?: string;
  resolvedBy?: string;
  targetMaxHours: number; // 72 hours KPI
  previousStatus?: ProjectStatus; // وضعیت قبلی پروژه پیش از ورود به استاک
}

// ارزیابی ۳۶۰ درجه پرسنل توسط مسئولین فنی
export interface PersonnelEvaluation {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  technicalScore: number; // 1-5
  behavioralScore: number; // 1-5
  cleanlinessScore: number; // 1-5 (رعایت آستری، اتوکشی و نظافت)
  criticalIncidentNote?: string; // فرم ثبت وقایع حساس CIT برای پاداش یا تذکر
  evaluatedBy: string;
  evaluatedAt: string;
}

// نظرسنجی و رضایت کارفرما (NPS & CSAT)
export interface CustomerSurvey {
  csatScore: number; // 1 to 5 stars
  npsScore: number; // 0 to 10 (Net Promoter Score)
  comment?: string;
  signature?: string;
  surveyedAt: string;
}

export interface Project {
  id: string;
  code: string; // کد رهگیری یا شماره سفارش (مثلاً PRJ-104)
  title: string; // نام پروژه یا مشتری
  customerName: string;
  customerPhone: string;
  address: string;
  locationUrl?: string; // لینک نشان یا بلد یا گوگل‌مپ
  
  // مشخصات فنی
  shadePanels: number; // تعداد لت شید
  curtainPanels: number; // تعداد لت پرده
  mechanismType?: string; // دستی، موتور سامفی، زنجیری و...
  approximateArea?: number; // متراژ تقریبی به متر مربع
  specialNotes?: string; // توضیحات ویژه سفارش فروش
  
  // تصاویر پروپوزال واحد فروش
  proposalImages: ProposalImage[];
  
  // زمان‌بندی
  scheduledDate: string; // YYYY-MM-DD (جلالی یا میلادی استاندارد)
  scheduledTime: string; // مثلاً 09:30 یا 14:00
  
  // اکیپ نصب
  leadTechnicianId?: string; // شناسه سرپرست اکیپ نصب
  assignedTechnicianIds: string[]; // تمام اعضای اکیپ
  
  // چک‌لیست ابزار
  isFullTools: boolean; // آیا دکمه «فول ابزار» زده شده؟
  toolsRequired: string[]; // لیست نام ابزارهای لازم
  customToolsNotes?: string; // ابزار خاص اضافه
  
  // وضعیت چرخه عمر پروژه (BPMN Lifecycle)
  status: ProjectStatus;
  startedAt?: string;
  reworkStartedAt?: string; // تاریخ و ساعت شروع اصلاح پس از رد QC
  completedAt?: string;
  completionNotes?: string; // گزارش نهایی سرپرست/تکنسین
  completionPhotos: string[]; // عکس‌های ارسالی بعد از نصب
  
  // عکس‌های قبل و بعد از نصب (Before & After)
  beforePhotos?: string[]; // عکس‌های وضعیت پنجره و کناف قبل از شروع
  afterPhotos?: string[]; // عکس‌های نهایی پرده و شید بعد از اتمام نصب
  
  // بازدید پیش از نصب و اندازه‌گیری دوم
  preInspection?: PreInstallationInspection;
  
  // چک‌لیست استانداردهای طلایی تحویل
  handoverChecklist?: HandoverChecklist;
  handoverChecklistNotes?: Record<string, string>;
  
  // پرونده‌های استاک سر پروژه (در صورت توقف زیر 72 ساعت)
  stuckIncident?: StuckIncident; // سابقه تکی سازگار با گذشته
  stuckIncidents?: StuckIncident[]; // آرایه کامل حوادث استاک پروژه
  
  // رضایت، امضا و نظرسنجی کارفرما
  customerSignature?: string;
  customerSatisfaction?: number; // 1 تا 5 ستاره
  customerSurvey?: CustomerSurvey;
  
  // ارزیابی پرسنل توسط مسئولین فنی
  evaluations?: PersonnelEvaluation[];
  
  // بخش ویژه نظارت و QC
  qcStatus: QCStatus;
  qcScore?: number; // امتیاز کیفی 1 تا 5
  qcNotes?: string; // نظر تخصصی مسئول QC
  qcReviewedAt?: string;
  qcReviewedBy?: string;
  
  createdAt: string;
  updatedAt: string;
  __fromCache?: boolean; // علامت‌گذاری موقت برای پروژه‌های خوانده‌شده از کش محلی
}

export type TicketType = 
  | 'DEFICIENCY_FABRIC'    // کسری یا خرابی پارچه
  | 'DAMAGED_HARDWARE'    // خرابی یراق‌آلات یا موتور
  | 'WALL_ISSUE'          // مشکل زیرسازی و دیوار
  | 'MEASUREMENT_MISMATCH'// مغایرت ابعاد
  | 'CUSTOMER_ABSENT'     // عدم حضور مشتری
  | 'OTHER';              // سایر

export type TicketStatus = 'OPEN' | 'RESOLVED';

export interface Ticket {
  id: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  authorId: string;
  authorName: string;
  type: TicketType;
  description: string;
  photos: string[];
  status: TicketStatus;
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface SystemSettings {
  visibilityWindowDays: number; // تعداد روزهای قابل مشاهده برای تکنسین‌ها (پیش‌فرض 4 روز)
  companyName: string;
  defaultTools: string[];
}
