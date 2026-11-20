export type UserRole = 
  | 'CEO'                     // مدیرعامل (دسترسی انحصاری به شناسنامه جامع پروژه‌ها و پرینت)
  | 'QC_MANAGER'              // مدیر فنی و QC (کاربر اصلی با دسترسی کامل عملیاتی)
  | 'MEASUREMENT_LEAD'        // مسئول اندازه‌گیری دوم و تایید بستر فضا (1 نفر)
  | 'LEAD_TECHNICIAN'         // سرپرست اکیپ نصب
  | 'TECHNICIAN'              // تکنسین نصب
  | 'WAREHOUSE'               // مسئول انبار و پیگیری تامین (2 نفر)
  | 'SCHEDULING_COORDINATOR'  // هماهنگ‌کننده زمان‌بندی (سازگار با گذشته)
  | 'SALES_REP';              // کارشناس فروش (ثبت پروژه، رزرو ظرفیت لت و لیدربورد)

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
  teamId?: string; // شناسه اکیپ منتسب (در صورت عضویت در یکی از 4 اکیپ)
}

export type QCInspectionResult = 'PASS' | 'FAIL' | 'CONDITIONAL';

export type QCDefectSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export type QCDefectStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'VERIFIED';

export type QCDefectCategory =
  | 'LEVELING'      // تراز و شاقول نبودن ریل یا لت‌ها
  | 'FABRIC'        // چروک، نخ‌کشی یا عیوب دوخت و پرده
  | 'MOTOR_REMOTE'  // نقص موتور، تنظیم لیمیت یا کد ریموت
  | 'HARDWARE'      // شل بودن کرپی‌ها، پایه‌ها یا اتصالات
  | 'CLEANLINESS'   // نظافت ناکافی و عدم جمع‌آوری ضایعات
  | 'DAMAGE'        // آسیب به دیوار، قرنیز، سقف یا اقلام مشتری
  | 'OTHER';        // سایر موارد

export interface QCDefect {
  id: string;
  description: string;
  category: QCDefectCategory;
  severity: QCDefectSeverity;
  activityId?: string;
  activityTitle?: string;
  location?: string; // مثلاً پنجره سالن شمالی
  photos?: string[];
  assignedTeamId?: string;
  assignedTeamName?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  createdAt: string;
  createdByUserId: string;
  createdByUserName: string;
  status: QCDefectStatus;
  resolutionNotes?: string;
  resolutionPhotos?: string[];
  resolvedAt?: string;
  resolvedByUserId?: string;
  resolvedByUserName?: string;
  verificationNotes?: string;
  verifiedAt?: string;
  verifiedByUserId?: string;
  verifiedByUserName?: string;
}

export interface QCInspectionChecklistItem {
  id: string;
  category: 'LEVELING' | 'FABRIC' | 'MECHANICS' | 'CLEANLINESS' | 'DOCUMENTATION';
  title: string;
  passed: boolean;
  notes?: string;
}

export interface QCQualityScoreCriteria {
  levelingScore: number;     // 1 تا 5: تراز و شاقول بودن ریل و لت‌ها
  fabricFinishScore: number; // 1 تا 5: کیفیت اتوکشی، ایستایی و عدم چروک
  mechanicsScore: number;    // 1 تا 5: حرکت روان ریل، بی‌صدایی و کالیبراسیون موتور
  cleanlinessScore: number;  // 1 تا 5: نظافت، جمع‌آوری کارگاه و کرپی‌ها
  complianceScore: number;   // 1 تا 5: انطباق با طرح و استانداردهای گالری طلایی
}

export interface QCQualityScore {
  overallScore: number; // 1 تا 5 (میانگین وزنی محاسبه‌شده)
  criteria: QCQualityScoreCriteria;
  isProvisionalWeights: boolean; // پرچم نشان‌دهنده موقت بودن اوزان تا تصویب نهایی مدیریت
  calculatedAt: string;
}

export type CustomerAcceptanceStatus = 'ACCEPTED' | 'REJECTED' | 'UNAVAILABLE';

export interface CustomerAcceptanceRecord {
  status: CustomerAcceptanceStatus;
  representativeName?: string;
  representativeRole?: string; // مثلاً کارفرما، مهندس ناظر، سرپرست کارگاه
  representativePhone?: string;
  acceptedAt?: string;
  notes?: string;
  signature?: string; // Base64
  unavailabilityReason?: string;
  unavailabilityPhotos?: string[];
  customerSatisfaction?: number; // 1 تا 5 ستاره
}

export interface QCInspectionRecord {
  id: string;
  projectId: string;
  inspectionDate: string; // ISO
  inspectorUserId: string;
  inspectorUserName: string;
  inspectorRole: 'QC_MANAGER';
  result: QCInspectionResult;
  overallScore?: number; // 1 تا 5
  qualityScoreDetails?: QCQualityScore;
  checklist: QCInspectionChecklistItem[];
  defects: QCDefect[];
  notes?: string;
  photos?: string[];
  customerAcceptanceSnapshot?: CustomerAcceptanceRecord;
  createdAt: string;
}

// ساختار 4 اکیپ نصب (هر اکیپ: 1 سرپرست + 2 تکنسین = 12 نفر)
export interface InstallationTeam {
  id: string;
  name: string; // نام اکیپ (مثلاً «اکیپ نصب 1»)
  code: string; // کد اکیپ (مثلاً «TEAM_1»)
  supervisorId?: string; // شناسه سرپرست اکیپ
  supervisorName?: string;
  dailyCapacityHours?: number | null; // ظرفیت کاری روزانه اکیپ به ساعت (اختیاری)
  workingDays?: number[]; // روزهای کاری مجاز در هفته (0=یکشنبه تا 6=شنبه)
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  userName?: string;
  roleInTeam: 'LEAD' | 'TECHNICIAN';
  joinedAt: string;
}

export interface InstallationTeamWithMembers extends InstallationTeam {
  supervisor?: User;
  technicians: User[];
  totalMembers: number; // سقف 3 نفر
}

export type ProjectStatus = 
  | 'MEASUREMENT_PENDING' // در انتظار بازدید و اندازه‌گیری دوم (BPMN Step 1)
  | 'SCHEDULED'           // زمان‌بندی شده برای نصب (BPMN Step 2)
  | 'EN_ROUTE'            // در مسیر پروژه
  | 'IN_PROGRESS'         // در حال نصب سر پروژه
  | 'PAUSED'              // نیمه‌کاره — ادامه روز بعد
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
  leveled: boolean; // بررسی تراز لیزری 360 درجه و شاقول بودن قاب و پایه‌ها
  ironedPleated: boolean; // مرتب‌سازی چین‌ها و اتوکشی نهایی پرده
  cleaned: boolean; // نظافت کامل محیط و جمع‌آوری تمام ضایعات و گرد و خاک
  handoverChecklistNotes?: Record<string, string>; // توضیحات موارد تاییدنشده
}

// بازدید پیش از نصب و اندازه‌گیری دوم (BPMN Step: کارشناس فنی - جهت سازگاری گذشته)
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

// چک‌لیست و فرآیند مستقل آمادگی فیزیکی بستر نصب (مرحله 3 - تفکیک از اندازه‌گیری دوم)
export type SiteChecklistState = 'CONFIRMED' | 'ISSUE_DETECTED' | 'NOT_APPLICABLE';

export interface SiteReadinessItem {
  id: string;
  title: string;
  category: 'CEILING_DRYWALL' | 'ELECTRICAL' | 'ACCESS_SPACE' | 'CUSTOM';
  state?: SiteChecklistState;
  notes?: string;
}

export interface SiteReadinessInspection {
  inspectionType: 'IN_PERSON' | 'REMOTE'; // بازبینی حضوری در محل / از راه دور
  status: 'PASSED' | 'ACTION_REQUIRED' | 'PENDING';
  items: SiteReadinessItem[];
  inspectedBy: string;
  inspectedAt: string;
  photos: string[];
  generalNotes?: string;
  linkedTicketId?: string;
  isReady?: boolean;
}

// گیت‌های پیش‌نیاز ورود رسمی پروژه به دپارتمان فنی و زمان‌بندی (مرحله 1)
export interface HandoverPrerequisite {
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  notes?: string;
  evidenceUrl?: string;
  shelfLocation?: string; // موقعیت چیدمان و قفسه در انبار مرکزی
}

export interface ProjectTechnicalHandover {
  isHandoverComplete: boolean;
  officialHandoverDate?: string;
  productionConfirmation?: HandoverPrerequisite; // اختیاری شده جهت سازگاری، تایید صرفاً بر عهده انبار است
  warehouseConfirmation: HandoverPrerequisite;
  unlockedAt?: string;
  isHistoricalMigration?: boolean;
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

// ارزیابی 360 درجه پرسنل توسط مسئولین فنی
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

// دسته‌بندی فعالیت‌ها و اقلام کار در طرح اولیه نصب (فاز P2.1)
export type PlanActivityCategory = 'SHADE' | 'CURTAIN' | 'MOTOR' | 'ACCESSORY' | 'CUSTOM';

// قلم فعالیت در طرح اولیه نصب (کاملاً تغییرناپذیر پس از قفل اولیه)
export interface PlanActivityItem {
  id: string; // شناسه یکتا و پایدار فعالیت (مثلاً act-shade-1)
  title: string; // عنوان فعالیت (مثلاً شید رول دستی، پرده تور و...)
  category?: PlanActivityCategory;
  plannedQuantity: number; // حجم/تعداد برنامه‌ریزی‌شده اولیه (تغییرناپذیر)
  unit: string; // واحد اندازه‌گیری (لت، متر، دستگاه، عدد)
  technicalDetails?: string; // توضیحات فنی یا نوع پارچه و مکانیسم
}

// ساختار طرح اولیه نصب (Original Installation Plan)
export interface InstallationPlan {
  activities: PlanActivityItem[];
  lockedAt?: string; // زمان قفل شدن بیس‌لاین
  notes?: string;
}

// بازنگری و اصلاحات استثنایی طرح (Plan Amendments - تغییرناپذیری بیس‌لاین)
export interface PlanAmendment {
  id: string;
  activityId: string;
  activityTitle: string;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  requestedByUserId: string;
  requestedByUserName: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedByUserId?: string;
  reviewedByUserName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  evidenceUrl?: string;
}

// پیشرفت ثبت‌شده برای یک فعالیت مشخص در یک گزارش کار
export interface DailyActivityProgress {
  activityId: string;
  activityTitle?: string;
  completedQuantity: number; // مقدار اجراشده در این روز کاری
  unit?: string;
}

// جزئیات اتمام استثنایی پروژه با کسری اقلام اجرایی
export interface ExceptionalCompletionDetails {
  hasIncompleteActivities: boolean;
  remainingActivities: {
    activityId: string;
    title: string;
    remainingQuantity: number;
    unit: string;
  }[];
  documentedReason: string;
  confirmedBySupervisor: string;
  confirmedAt: string;
}

// صورت‌جلسه و رکورد تحویل اقلام در انتقال رسمی پروژه بین اکیپ‌ها (فاز P2.2)
export interface HandoverInventoryItem {
  activityId: string;
  activityTitle: string;
  remainingQuantity: number;
  unit: string;
  notes?: string;
}

export interface TeamTransferRecord {
  id: string;
  fromTeamId: string;
  fromTeamName: string;
  toTeamId: string;
  toTeamName: string;
  transferredAt: string; // ISO timestamp
  transferredByUserId: string;
  transferredByUserName: string;
  reason: string;
  transferredWorkloadHours?: number;
  notes?: string;
  handoverInventory?: HandoverInventoryItem[];
  receivingLeadConfirmed?: boolean;
  receivingLeadConfirmedAt?: string;
  receivingLeadConfirmedBy?: string;
  // تفکیک رسمی رفع انسداد مدیریتی مدیر QC (P2.2 Hardening)
  isManagerOverride?: boolean;
  managerOverrideAt?: string;
  managerOverrideByUserId?: string;
  managerOverrideByUserName?: string;
  managerOverrideRole?: 'QC_MANAGER';
  managerOverrideReason?: string;
}

// ثبت جلسات کاری روزانه برای پروژه‌های چندروزه
export interface WorkSession {
  date: string; // YYYY-MM-DD
  startedAt: string; // ISO timestamp
  endedAt?: string; // ISO timestamp
  byUserId: string;
  byUserName: string;
}

// گزارش پیشرفت روزانه برای پروژه‌های چندروزه و تک‌روزه
export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // مثلاً 09:30
  endTime?: string; // مثلاً 17:00
  completedQuantity?: number; // حجم/تعداد لت نصب‌شده در این روز کاری (سازگار با نسخه قبل)
  remainingQuantity?: number; // حجم/تعداد لت باقی‌مانده (سازگار با نسخه قبل)
  quantityUnit?: string; // مثلاً «لت»، «متر»، «دستگاه»
  activityProgress?: DailyActivityProgress[]; // تفکیک پیشرفت فعالیت‌ها در فاز P2.1
  note?: string; // شرح گزارش کار امروز (اختیاری در عملیات عادی)
  obstacles?: string; // موانع، تاخیرات یا چالش‌های فیزیکی بستر
  equipmentIssues?: string; // کسری یا نقص ابزار و متریال
  photos: string[]; // تصاویر ارسالی از پیشرفت امروز (اختیاری در عملیات عادی)
  plannedContinuationDate?: string; // تاریخ پیشنهادی برای ادامه کار (YYYY-MM-DD)
  byUserId: string;
  byUserName: string;
  supervisorConfirmed?: boolean; // تایید سرپرست اکیپ
  supervisorConfirmedBy?: string;
  supervisorConfirmedAt?: string;
  createdAt: string; // ISO timestamp
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
  
  // تصاویر پروپوزال واحد فروش و کارشناس ثبت‌کننده
  proposalImages: ProposalImage[];
  isForceMajeure?: boolean; // پروژه اضطراری و فوری فروش (🔥)
  priority?: 'NORMAL' | 'HIGH';
  preInstallPhotosConfirmed?: boolean;
  salesRepName?: string; // نام کارشناس فروش ثبت‌کننده
  specialTools?: string[]; // ابزارهای ویژه تخصیص‌یافته (فارسی‌بر، دریل سرکج، نردبان بلند)
  customerDisclaimerAgreed?: boolean; // تایید سلب مسئولیت حقوقی توسط کارفرما

  // صورت‌جلسه تحویل کارگاه به اکیپ بعدی در پروژه‌های متوقف/نیمه‌کاره
  interTeamHandover?: {
    fromTeamId: string;
    fromTeamName: string;
    reportedByUserId: string;
    reportedByUserName: string;
    stoppedAt: string;
    reason: string;
    completedWork: string;
    remainingWork: string;
    requiredParts?: string;
    photos: string[];
  };

  // اطلاعات اندازه‌گیری دوم و تایید بستر فضا
  secondMeasurementDetails?: {
    verifiedDimensions: string;
    siteReadinessNotes?: string;
    photos?: string[];
    isReadinessApproved: boolean;
    inspectedAt?: string;
    inspectorId?: string;
    inspectorName?: string;
  };

  // وضعیت آماده‌سازی و بسته‌بندی در انبار
  warehousePrep?: {
    isPackedAndReady: boolean;
    packedAt?: string;
    packedByUserId?: string;
    packedByUserName?: string;
    notes?: string;
  };

  // زیرساخت آماده برای مشخصات فنی آینده (بدون تحمیل به رابط کاربری فعلی)
  motorSide?: 'RIGHT' | 'LEFT';
  mountType?: 'INSIDE' | 'OUTSIDE';
  roomTag?: string;
  
  // زمان‌بندی
  scheduledDate: string; // YYYY-MM-DD (جلالی یا میلادی استاندارد)
  endDate?: string; // YYYY-MM-DD (برای پروژه‌های چندروزه: endDate > scheduledDate)
  scheduledTime: string; // مثلاً 09:30 یا 14:00
  
  // اکیپ نصب
  assignedTeamId?: string; // شناسه یکی از 4 اکیپ نصب
  assignedTeamName?: string; // نام اکیپ منتسب
  leadTechnicianId?: string; // شناسه سرپرست اکیپ نصب
  assignedTechnicianIds: string[]; // تمام اعضای اکیپ
  
  // بار کاری و اسناد فنی
  estimatedWorkload?: number; // حجم برآورد شده کار (تعداد لت یا واحد)
  requiredDurationHours?: number; // تخمین کل ساعات اجرای نصب
  secondMeasurementDoc?: string; // تصویر یا سند قطعی اندازه‌گیری دوم
  
  // گیت ورود رسمی پروژه به واحد فنی (مرحله 1)
  technicalHandover?: ProjectTechnicalHandover;

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
  
  // بازدید بستر و پیش از نصب
  preInspection?: PreInstallationInspection; // سازگار با گذشته
  siteReadiness?: SiteReadinessInspection; // فرآیند مستقل 3 حالته مرحله 3
  
  // چک‌لیست استانداردهای طلایی تحویل
  handoverChecklist?: HandoverChecklist;
  handoverChecklistNotes?: Record<string, string>;
  
  // پرونده‌های استاک سر پروژه (در صورت توقف زیر 72 ساعت)
  stuckIncident?: StuckIncident; // سابقه تکی سازگار با گذشته
  stuckIncidents?: StuckIncident[]; // آرایه کامل حوادث استاک پروژه
  
  // رضایت، امضا و نظرسنجی کارفرما / نماینده پروژه
  handoverSigneeType?: HandoverSigneeType; // نوع تحویل‌گیرنده: مسکونی، نماینده کارگاه یا غایب
  representativeName?: string; // نام نماینده کارگاه / مهندس ناظر
  representativeRole?: string; // سمت نماینده (مثلاً مهندس ناظر، سرپرست کارگاه)
  representativePhone?: string; // شماره تماس نماینده
  unavailabilityReason?: string; // در صورت عدم حضور کارفرما: شرح دلیل و شرایط عدم امکان امضا
  unavailabilityPhotos?: string[]; // مدارک تصویری اتمام کار و ترک ایمن محل
  customerSignature?: string;
  customerSatisfaction?: number; // 1 تا 5 ستاره (اختیاری)
  customerSurvey?: CustomerSurvey;
  
  // اقدام اصلاحی صادر شده توسط QC
  qcCorrectiveAction?: {
    required: boolean;
    issue: string;
    assignedTeamId?: string;
    deadline?: string;
    completed?: boolean;
    completedAt?: string;
  };
  
  // مدیریت تغییرات زمان‌بندی (P1 Task 2E)
  scheduleChangeRequests?: ScheduleChangeRequest[];
  pendingScheduleChange?: ScheduleChangeRequest;
  
  // ارزیابی پرسنل توسط مسئولین فنی
  evaluations?: PersonnelEvaluation[];
  
  // بخش ویژه نظارت و QC
  qcStatus: QCStatus;
  qcScore?: number; // امتیاز کیفی 1 تا 5
  qcNotes?: string; // نظر تخصصی مسئول QC
  qcReviewedAt?: string;
  qcReviewedBy?: string;
  
  // جلسات کاری و لاگ‌های روزانه برای پروژه‌های چندروزه
  workSessions?: WorkSession[];
  dailyLogs?: DailyLog[];

  // طرح اولیه نصب و بازنگری‌های استثنایی (فاز P2.1)
  originalPlan?: InstallationPlan;
  planAmendments?: PlanAmendment[];

  // ثبت اتمام استثنایی با کسری اقلام اجرایی
  isExceptionalCompletion?: boolean;
  exceptionalCompletionDetails?: ExceptionalCompletionDetails;

  // سابقه انتقال رسمی پروژه بین اکیپ‌ها و صورت‌جلسه تحویل (فاز P2.2)
  teamTransfers?: TeamTransferRecord[];

  // بازرسی نهایی کنترل کیفیت، مدیریت عدم انطباق‌ها و تحویل رسمی (فاز P3)
  qcInspections?: QCInspectionRecord[];
  qcDefects?: QCDefect[];
  customerAcceptance?: CustomerAcceptanceRecord;

  createdAt: string;
  updatedAt: string;
  __fromCache?: boolean; // علامت‌گذاری موقت برای پروژه‌های خوانده‌شده از کش محلی
}

export type HandoverSigneeType =
  | 'RESIDENTIAL_CUSTOMER'        // کارفرمای خانگی / شخص مشتری
  | 'CONSTRUCTION_REPRESENTATIVE'  // نماینده کارگاه / مهندس ناظر / سرپرست پروژه
  | 'UNAVAILABLE_EXEMPT';         // عدم حضور کارفرما / مستندسازی دلیل با شواهد

export type IssueCategory =
  | 'MEASUREMENT_ERROR'          // 1. مغایرت یا خطای اندازه‌گیری اولیه
  | 'MEASUREMENT_RECORD_ERROR'   // 2. خطا در جابه‌جایی یا ثبت مشخصات اندازه‌گیری
  | 'PRODUCTION_DEFECT'          // 3. نقص، دوخت ناصحیح یا کسری تولید
  | 'WAREHOUSE_DELIVERY_ISSUE'   // 4. کسری یا اشتباه در تحویل و بسته‌بندی انبار
  | 'TRANSIT_DAMAGE'             // 5. آسیب حین بارگیری، حمل یا ترانزیت
  | 'SITE_NOT_READY'             // 6. عدم آمادگی بستر ساختمان، کناف یا برق
  | 'EQUIPMENT_DEFECT'           // 7. کسری، نقص یا خرابی تجهیزات، یراق و ابزار
  | 'OTHER';                     // 8. سایر موارد عملیاتی

export type SlaStatus =
  | 'OPEN_IN_SLA'        // باز — در محدوده 72 ساعت استاندارد
  | 'OPEN_OVERDUE'       // باز — عبور از 72 ساعت و دارای تاخیر بحرانی
  | 'RESOLVED_IN_SLA'    // حل‌شده — در موعد مقرر زیر 72 ساعت
  | 'RESOLVED_OVERDUE';  // حل‌شده — با تاخیر پس از 72 ساعت

export interface TicketActionLog {
  id: string;
  timestamp: string;
  action: string;
  byUserId: string;
  byUserName: string;
  note?: string;
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
  category?: IssueCategory; // دسته‌بندی 8 گانه عملیاتی P1
  description: string;
  photos: string[];
  status: TicketStatus;
  
  // انتساب به اکیپ و مسئول پیگیری
  assignedTeamId?: string;
  assignedTeamName?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  assignedRole?: string;
  assignedDepartment?: string;
  referralNote?: string;
  referredAt?: string;
  referredByUserName?: string;
  
  // انسداد عملیات (Blocking behavior)
  isBlocking?: boolean; // آیا باعث توقف کار نصب شده؟
  blockingReason?: string; // شرح علت توقف
  
  // مهلت و تاریخچه SLA
  resolutionDeadline?: string; // ضرب‌الاجل 72 ساعته
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
  verifiedByUserId?: string;
  verifiedByUserName?: string;
  verifiedAt?: string;
  actionHistory?: TicketActionLog[];
}

export interface ScheduleChangeRequest {
  id: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  customerName?: string;
  durationHours?: number;
  previousScheduledDate: string;
  proposedScheduledDate: string;
  previousEndDate?: string;
  proposedEndDate?: string;
  previousTeamId?: string;
  proposedTeamId?: string;
  previousTeamName?: string;
  proposedTeamName?: string;
  reason: string;
  requestedByUserId: string;
  requestedByUserName: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedByUserId?: string;
  reviewedByUserName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface TeamOperationalStatus {
  team: InstallationTeam;
  supervisor?: User;
  technicians: User[];
  currentMission?: {
    projectId: string;
    projectCode: string;
    projectTitle: string;
    status: ProjectStatus;
    isMultiDay: boolean;
    durationHours: number;
    customerName: string;
  };
  currentWorkloadHours: number;
  maxCapacityHours: number | null; // در صورت عدم تنظیم سقف ظرفیت، null است
  remainingCapacityHours: number | null; // در صورت عدم تنظیم سقف ظرفیت، null است
  isCapacityConfigured: boolean;
  capacitySource: 'TEAM' | 'SYSTEM' | 'UNCONFIGURED';
  status: 'AVAILABLE' | 'ON_MISSION' | 'OVERLOADED' | 'STANDBY' | 'UNCONFIGURED';
}

export interface SystemSettings {
  visibilityWindowDays: number; // تعداد روزهای قابل مشاهده برای تکنسین‌ها (پیش‌فرض 4 روز)
  companyName: string;
  defaultTools: string[];
  defaultTeamDailyCapacityHours?: number | null; // ظرفیت کاری پیش‌فرض روزانه اکیپ‌ها به ساعت (تعیین توسط مدیر QC)
  workingDaysPerWeek?: number[]; // روزهای کاری مجاز هفته (پیش‌فرض: [0, 1, 2, 3, 4, 6] بدون جمعه)
}

export interface ProjectAuditRecord {
  id: string;
  project_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  changed_by?: string;
  changed_by_name?: string;
  changed_at: string;
  old_data?: Partial<Project> | null;
  new_data?: Partial<Project> | null;
  reason?: string | null;
}

// ==============================================================================
// گردش کار مستقل درخواست متریال و پیگیری کسری سر کارگاه (فاز P2.3)
// تفکیک قطعی از تیکت‌های خرابی/کیفی (QC Tickets)
// ==============================================================================

export type MaterialCategory =
  | 'FABRIC'          // پارچه و تور
  | 'HARDWARE'        // یراق‌آلات، پایه‌ها، براکت و گیربکس
  | 'PROFILE_TRACK'   // ریل، قاب و پروفیل
  | 'MOTOR'           // موتور برقی و ملحقات هوشمند
  | 'ACCESSORY'       // ملحقات، اکسسوری، سرب و وزنه
  | 'OTHER';          // سایر اقلام مصرفی و ابزار

export type MaterialRequestReason =
  | 'SHORTAGE'                  // کسری متراژ یا تعداد از ابتدا
  | 'DEFECT_DAMAGE'             // آسیب‌دیدگی یا نقص فنی قطعه سر کارگاه
  | 'INCORRECT_SPEC'            // مغایرت با ابعاد یا مشخصات فنی
  | 'ADDITIONAL_CLIENT_REQUEST';// درخواست اضافه توسط کارفرما سر کارگاه

export type MaterialRequestStatus =
  | 'SUBMITTED'             // ثبت اولیه توسط تکنسین در محل پروژه
  | 'IN_PROCUREMENT'        // در حال تامین و آماده‌سازی در انبار/کارگاه
  | 'PARTIALLY_DISPATCHED'  // ارسال بخشی از اقلام به محل پروژه
  | 'DISPATCHED'            // ارسال تمام اقلام درخواستی
  | 'DELIVERED_CONFIRMED'   // تایید قطعی تحویل در محل کارگاه توسط سرپرست/تکنسین
  | 'REJECTED'              // رد شده توسط دفتر/مدیریت با ذکر دلیل
  | 'CANCELLED';            // لغو شده با حفظ کامل سوابق و تاریخچه

export type MaterialUrgency = 'NORMAL' | 'URGENT' | 'CRITICAL_BLOCKING';

export interface MaterialRequestItem {
  id: string;
  title: string;
  category: MaterialCategory;
  requestedQty: number;
  unit: string; // عدد، متر، جفت، طاقه، بسته، شاخه
  notes?: string;
}

export interface MaterialDispatchItem {
  itemId: string;
  title?: string;
  dispatchedQty: number;
  unit?: string;
  serialOrBatch?: string;
}

export interface MaterialDispatchRecord {
  id: string;
  dispatchedAt: string; // ISO timestamp
  dispatchedByUserId: string;
  dispatchedByUserName: string;
  courierInfo: string; // اطلاعات پیک، نام راننده، کد اسنپ‌باکس یا پلاک وانت
  trackingCode?: string;
  notes?: string;
  items: MaterialDispatchItem[];
  receivedAtSiteConfirmed: boolean;
  receivedAtSiteConfirmedAt?: string;
  receivedAtSiteConfirmedByUserId?: string;
  receivedAtSiteConfirmedByUserName?: string;
  isManagementOverride?: boolean; // آیا با تایید استثنایی مدیریت ثبت شده است؟
  overrideReason?: string; // علت ثبت تایید تحویل توسط مدیریت
}

export interface MaterialActionLog {
  id: string;
  timestamp: string;
  serverRecordedAt?: string;
  action: string;
  byUserId: string;
  byUserName: string;
  note?: string;
}

export interface MaterialRequest {
  id: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;

  assignedTeamId?: string; // شناسه اکیپ در زمان ثبت درخواست
  assignedTeamName?: string; // نام اکیپ در زمان ثبت درخواست

  requestedByUserId: string;
  requestedByUserName: string;
  requestedAt: string; // ISO timestamp

  category: MaterialCategory;
  reason: MaterialRequestReason;
  urgency: MaterialUrgency;
  notes?: string;

  items: MaterialRequestItem[];
  dispatches: MaterialDispatchRecord[];

  status: MaterialRequestStatus;

  assignedFollowUpUserId?: string;
  assignedFollowUpUserName?: string;

  history: MaterialActionLog[];
  createdAt: string;
  updatedAt: string;
}

// ================= SALES & CAPACITY TYPES =================

export type SalesAllocationMode = 'SPREAD_DAILY' | 'CONSECUTIVE_DAYS';

export interface SalesProjectBooking {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  lathsCount: number; // تعداد لت‌ها
  isSmart: boolean; // هوشمند/موتوردار یا مکانیکی/دستی
  notes: string;
  requestedDate: string; // YYYY-MM-DD
  jalaliDate: string; // تاریخ شمسی مانند ۱۴۰۵/۰۹/۱۵
  allocationMode: SalesAllocationMode;
  allocatedTeams: string[]; // شناسه اکیپ‌ها مثلاً ['TEAM_1', 'TEAM_2']
  allocatedDaysCount: number; // تعداد روزهای تخصیص
  salesRepId: string;
  salesRepName: string;
  createdAt: string;
}

export interface TeamDayAllocation {
  teamId: string;
  teamName: string;
  bookedLaths: number;
  maxLaths: number; // معمولاً ۱۵ لت برای هر اکیپ در روز
}

export interface DailyLathCapacity {
  date: string; // YYYY-MM-DD
  jalaliDate: string;
  dayName: string; // شنبه، یکشنبه، ...
  maxLaths: number; // ۶۰ لت (۴ اکیپ × ۱۵)
  bookedLaths: number;
  remainingLaths: number;
  teams: TeamDayAllocation[];
  bookingsCount: number;
}

export interface BookingOption {
  mode: SalesAllocationMode;
  title: string;
  description: string;
  isAvailable: boolean;
  requiredDays: number;
  allocatedTeams: string[];
  daysDetails: {
    date: string;
    jalaliDate: string;
    teams: { teamId: string; teamName: string; laths: number }[];
  }[];
}

export interface SalesRepProfile {
  id: string;
  name: string;
  phone: string;
  avatarIcon: string; // کاریکاتور یا آواتار وکتوری
  caricatureTag: string; // لقب فان مثل «شکارچی لت»، «فرمانده شید»
  rankBadge: 'GOLD' | 'SILVER' | 'BRONZE' | 'STANDARD';
  monthlyProjectsCount: number; // رتبه‌بندی بر اساس تعداد پروژه‌ها
  monthlyLathsCount: number;
  activeBookingDays: number;
  winStreak: number;
}
