export type UserRole = 'QC_MANAGER' | 'LEAD_TECHNICIAN' | 'TECHNICIAN';

export interface User {
  id: string;
  name: string;
  phone: string;
  password?: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
}

export type ProjectStatus = 
  | 'SCHEDULED'   // برنامه‌ریزی شده
  | 'EN_ROUTE'     // در مسیر
  | 'IN_PROGRESS'  // در حال نصب
  | 'COMPLETED'    // نصب پایان یافته
  | 'CANCELLED';   // لغو شده

export type QCStatus = 
  | 'NOT_STARTED'  // هنوز نصب نشده
  | 'PENDING'      // در انتظار بررسی کیوسی
  | 'APPROVED'     // تایید کیفی شده
  | 'REJECTED';    // عدم تایید کیفی / نیاز به اصلاح

export interface ProposalImage {
  id: string;
  title: string;
  url: string; // Base64 or URL
  uploadedAt: string;
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
  leadTechnicianId?: string; // شناسه سرپرست اکیپ
  assignedTechnicianIds: string[]; // تمام اعضای اکیپ
  
  // چک‌لیست ابزار
  isFullTools: boolean; // آیا دکمه «فول ابزار» زده شده؟
  toolsRequired: string[]; // لیست نام ابزارهای لازم
  customToolsNotes?: string; // ابزار خاص اضافه
  
  // وضعیت اجرا سر پروژه
  status: ProjectStatus;
  startedAt?: string;
  completedAt?: string;
  completionNotes?: string; // گزارش نهایی سرپرست/تکنسین
  completionPhotos: string[]; // عکس‌های ارسالی بعد از نصب
  
  // رضایت و امضای مشتری
  customerSignature?: string;
  customerSatisfaction?: number; // 1 تا 5 ستاره
  
  // بخش ویژه نظارت و کیوسی
  qcStatus: QCStatus;
  qcScore?: number; // امتیاز کیفی 1 تا 5
  qcNotes?: string; // نظر تخصصی مسئول کیوسی
  qcReviewedAt?: string;
  qcReviewedBy?: string;
  
  createdAt: string;
  updatedAt: string;
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
  visibilityWindowDays: number; // تعداد روزهای قابل مشاهده برای تکنسین‌ها (پیش‌فرض ۴ روز)
  companyName: string;
  defaultTools: string[];
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}
