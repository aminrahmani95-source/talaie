import {
  Project,
  User,
  QCInspectionRecord,
  QCInspectionResult,
  QCInspectionChecklistItem,
  QCDefect,
  QCQualityScoreCriteria,
  QCQualityScore,
  CustomerAcceptanceRecord,
  CustomerAcceptanceStatus,
} from '../types';

/**
 * اوزان محاسباتی موقت امتیاز کیفی (Provisional Scoring Weights).
 * توجه: این ضرایب ساختار شفاف اولیه هستند و تصویب نهایی آنها منوط به تایید مدیریت ارشد است.
 */
export const PROVISIONAL_SCORING_WEIGHTS = {
  LEVELING: 0.25,     // 25٪ تراز و شاقول بودن
  FABRIC_FINISH: 0.25, // 25٪ کیفیت پارچه، عدم چروک و اتوکشی
  MECHANICS: 0.20,    // 20٪ حرکت مکانیکی، موتور و ریموت
  CLEANLINESS: 0.15,  // 15٪ نظافت کارگاه و حفاظت کف
  COMPLIANCE: 0.15,   // 15٪ انطباق با استاندارد و طرح مصوب
} as const;

/**
 * اقلام پیش‌فرض چک‌لیست استانداردهای بازرسی نهایی QC
 */
export const DEFAULT_QC_CHECKLIST_ITEMS: Omit<QCInspectionChecklistItem, 'passed' | 'notes'>[] = [
  {
    id: 'chk-leveling',
    category: 'LEVELING',
    title: 'تراز لیزری 360 درجه ریل، پایه‌ها و شاقول بودن کامل لت‌های پرده و شید',
  },
  {
    id: 'chk-fabric',
    category: 'FABRIC',
    title: 'ایستایی منظم، اتوکشی بی‌نقص و عدم وجود هرگونه چروک، نخ‌کشی یا لک روی پارچه',
  },
  {
    id: 'chk-mechanics',
    category: 'MECHANICS',
    title: 'حرکت کاملاً روان ریل، بی‌صدایی موتور سامفی و تنظیم دقیق لیمیت‌های بالا و پایین ریموت',
  },
  {
    id: 'chk-brackets',
    category: 'MECHANICS',
    title: 'مهاربندی محکم کرپی‌ها و پایه‌های سقف کاذب/دیوار و جمع‌آوری کرپی‌های موقت',
  },
  {
    id: 'chk-cleanliness',
    category: 'CLEANLINESS',
    title: 'نظافت کامل محیط کار، جاروب براده‌ها، پاک‌سازی قرنیز و جمع‌آوری کاور محافظ کف',
  },
  {
    id: 'chk-handover',
    category: 'DOCUMENTATION',
    title: 'ارائه بروشور نگهداری، آموزش کاربری ریموت به کارفرما و تکمیل صورت‌جلسه تحویل',
  },
];

/**
 * محاسبه نمره کیفیت داخلی بر اساس معیارهای پنج‌گانه با اوزان موقت شفاف
 */
export function calculateQualityScore(criteria: QCQualityScoreCriteria): QCQualityScore {
  const clamp = (val: number) => Math.min(5, Math.max(1, Number(val) || 1));

  const lev = clamp(criteria.levelingScore);
  const fab = clamp(criteria.fabricFinishScore);
  const mec = clamp(criteria.mechanicsScore);
  const cln = clamp(criteria.cleanlinessScore);
  const cmp = clamp(criteria.complianceScore);

  const rawScore =
    lev * PROVISIONAL_SCORING_WEIGHTS.LEVELING +
    fab * PROVISIONAL_SCORING_WEIGHTS.FABRIC_FINISH +
    mec * PROVISIONAL_SCORING_WEIGHTS.MECHANICS +
    cln * PROVISIONAL_SCORING_WEIGHTS.CLEANLINESS +
    cmp * PROVISIONAL_SCORING_WEIGHTS.COMPLIANCE;

  const overallScore = Math.round(rawScore * 10) / 10;

  return {
    overallScore,
    criteria: {
      levelingScore: lev,
      fabricFinishScore: fab,
      mechanicsScore: mec,
      cleanlinessScore: cln,
      complianceScore: cmp,
    },
    isProvisionalWeights: true,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * بررسی وجود عیوب بحرانی (CRITICAL) حل‌نشده در پروژه یا پچ ارسالی.
 * یک عیب زمانی حل‌نشده تلقی می‌شود که در وضعیت OPEN، ASSIGNED یا IN_PROGRESS باشد.
 */
export function hasUnresolvedCriticalDefects(
  project: Partial<Project>,
  patchDefects?: QCDefect[]
): boolean {
  const defectsMap = new Map<string, QCDefect>();

  // بارگذاری عیوب موجود در پروژه
  if (Array.isArray(project.qcDefects)) {
    for (const d of project.qcDefects) {
      if (d && d.id) {
        defectsMap.set(d.id, d);
      }
    }
  }

  // ادغام عیوب ارسالی در پچ جاری
  if (Array.isArray(patchDefects)) {
    for (const d of patchDefects) {
      if (d && d.id) {
        defectsMap.set(d.id, d);
      }
    }
  }

  for (const defect of defectsMap.values()) {
    if (defect.severity === 'CRITICAL') {
      const isResolvedOrVerified =
        defect.status === 'RESOLVED' || defect.status === 'VERIFIED';
      if (!isResolvedOrVerified) {
        return true;
      }
    }
  }

  return false;
}

/**
 * بررسی انطباق پروژه با وضعیت «در انتظار بررسی کنترل کیفیت (QC)»
 * شرط یکپارچه و واحد در سراسر سامانه (میز کار، اعلان‌ها، میز کیفی و شناسنامه):
 * 1. پروژه نباید لغو شده باشد (status !== 'CANCELLED')
 * 2. نباید قبلاً تایید یا رد قطعی شده باشد (qcStatus !== 'APPROVED' && qcStatus !== 'REJECTED')
 * 3. وضعیت عملیاتی آن اتمام‌یافته باشد یا پرچم کیفی آن در انتظار بررسی باشد (status === 'COMPLETED' || qcStatus === 'PENDING')
 */
export function isAwaitingQc(p: Partial<Project> | null | undefined): boolean {
  if (!p || p.status === 'CANCELLED') return false;
  if (p.qcStatus === 'APPROVED' || p.qcStatus === 'REJECTED') return false;
  return p.status === 'COMPLETED' || p.qcStatus === 'PENDING';
}

/**
 * چه کسی QC را تأیید یا رد می‌کند: مدیر QC، و هماهنگ‌کننده‌ی جدا برای پروژه‌های اکیپ‌های خودش
 * (محدوده‌ی پروژه‌ها جای دیگر بررسی می‌شود: utils/coordinatorScope و سرور، مایگریشن ۰۲۸).
 */
export function isQcReviewerRole(role?: string): boolean {
  return role === 'QC_MANAGER' || role === 'SCHEDULING_COORDINATOR';
}

/**
 * ارزیابی صلاحیت مدیر و امکان‌پذیری تایید نهایی QC پروژه
 */
export function canApproveFinalQC(
  user: User,
  project: Project,
  patchDefects?: QCDefect[]
): { allowed: boolean; reason?: string } {
  if (!isQcReviewerRole(user.role)) {
    return {
      allowed: false,
      reason: 'تأیید نهایی کنترل کیفی (QC) منحصراً در صلاحیت مدیر ارشد QC است.',
    };
  }

  if (project.status === 'CANCELLED') {
    return {
      allowed: false,
      reason: 'پروژه لغو شده قابل ارزیابی یا تأیید نهایی کنترل کیفی نیست.',
    };
  }

  if (hasUnresolvedCriticalDefects(project, patchDefects)) {
    return {
      allowed: false,
      reason:
        'پروژه دارای عدم‌انطباق یا نقص بحرانی (CRITICAL) رفع‌نشده است. تا زمان ثبت رفع نقص و تایید اصلاح، صدور تایید نهایی ممکن نیست.',
    };
  }

  return { allowed: true };
}

export interface CreateQCInspectionParams {
  project: Project;
  user: User;
  result: QCInspectionResult;
  checklist: QCInspectionChecklistItem[];
  defects?: QCDefect[];
  qualityScoreDetails?: QCQualityScore;
  overallScore?: number;
  notes?: string;
  photos?: string[];
  reworkScheduledDate?: string;
}

/**
 * تولید پچ ثبت بازرسی رسمی کنترل کیفیت با حفظ کامل تاریخچه بازرسی‌های قبلی
 */
export function createQCInspectionPayload(params: CreateQCInspectionParams): {
  patch: Partial<Project>;
  inspectionRecord: QCInspectionRecord;
} {
  const {
    project,
    user,
    result,
    checklist,
    defects = [],
    qualityScoreDetails,
    overallScore,
    notes,
    photos = [],
    reworkScheduledDate,
  } = params;

  if (!isQcReviewerRole(user.role)) {
    throw new Error('دسترسی غیرمجاز: ثبت رسمی بازرسی کنترل کیفی منحصراً در صلاحیت مدیر ارشد QC است.');
  }

  if (result === 'PASS' && hasUnresolvedCriticalDefects(project, defects)) {
    throw new Error(
      'صدور تایید نهایی امکان‌پذیر نیست: پروژه دارای عدم انطباق یا نقص بحرانی (CRITICAL) حل‌نشده است.'
    );
  }

  const nowIso = new Date().toISOString();
  const inspectionId = `qci-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // ادغام عیوب جدید با سوابق عیوب قبلی پروژه با حفظ یکتایی
  const existingDefects = project.qcDefects || [];
  const existingDefectIds = new Set(existingDefects.map((d) => d.id));
  const newDefects = defects.filter((d) => !existingDefectIds.has(d.id));
  const updatedDefects = [
    ...existingDefects.map((d) => {
      const updated = defects.find((item) => item.id === d.id);
      return updated || d;
    }),
    ...newDefects,
  ];

  // محاسبه نمره نهایی
  const finalScore =
    overallScore !== undefined
      ? overallScore
      : qualityScoreDetails?.overallScore !== undefined
      ? qualityScoreDetails.overallScore
      : project.qcScore || (result === 'PASS' ? 5 : 2);

  const inspectionRecord: QCInspectionRecord = {
    id: inspectionId,
    projectId: project.id,
    inspectionDate: nowIso,
    inspectorUserId: user.id,
    inspectorUserName: user.name,
    inspectorRole: user.role === 'SCHEDULING_COORDINATOR' ? 'SCHEDULING_COORDINATOR' : 'QC_MANAGER',
    result,
    overallScore: finalScore,
    qualityScoreDetails,
    checklist,
    defects,
    notes: notes?.trim() || undefined,
    photos,
    customerAcceptanceSnapshot: project.customerAcceptance,
    createdAt: nowIso,
  };

  const existingInspections = project.qcInspections || [];
  const nextInspections = [...existingInspections, inspectionRecord];

  const patch: Partial<Project> = {
    qcInspections: nextInspections,
    qcDefects: updatedDefects,
    qcScore: finalScore,
    qcReviewedAt: nowIso,
    qcReviewedBy: user.name,
    updatedAt: nowIso,
  };

  if (result === 'PASS') {
    patch.qcStatus = 'APPROVED';
    patch.status = 'COMPLETED';
    patch.qcNotes = notes?.trim() || 'نصب با رعایت کامل استانداردهای طلایی تایید شد.';
    if (project.qcCorrectiveAction) {
      patch.qcCorrectiveAction = {
        ...project.qcCorrectiveAction,
        completed: true,
        completedAt: nowIso,
      };
    }
  } else {
    // FAIL یا CONDITIONAL
    patch.qcStatus = 'REJECTED';
    patch.status = 'IN_PROGRESS'; // بازگشت به کارگاه جهت اصلاح
    patch.reworkStartedAt = nowIso;
    patch.qcNotes = notes?.trim() || 'عدم انطباق با استاندارد و لزوم اجرای اصلاحیه کارگاهی.';
    patch.qcCorrectiveAction = {
      required: true,
      issue: notes?.trim() || 'رفع عدم‌انطباق‌های ثبت‌شده در برگه بازرسی QC',
      assignedTeamId: project.assignedTeamId,
      deadline: reworkScheduledDate || project.scheduledDate,
      completed: false,
    };
    if (reworkScheduledDate) {
      patch.scheduledDate = reworkScheduledDate;
    }
  }

  return { patch, inspectionRecord };
}

export interface ResolveDefectParams {
  project: Project;
  defectId: string;
  user: User;
  resolutionNotes: string;
  resolutionPhotos?: string[];
}

/**
 * ثبت رفع نقص کیفی توسط تکنسین یا سرپرست اکیپ
 */
export function createDefectResolutionPayload(params: ResolveDefectParams): Partial<Project> {
  const { project, defectId, user, resolutionNotes, resolutionPhotos = [] } = params;

  if (!resolutionNotes || !resolutionNotes.trim()) {
    throw new Error('ثبت گزارش مستند از نحوه رفع نقص الزامی است.');
  }

  const defects = project.qcDefects || [];
  const target = defects.find((d) => d.id === defectId);
  if (!target) {
    throw new Error('نقص کیفی مورد نظر در پروژه یافت نشد.');
  }

  if (target.status === 'VERIFIED') {
    throw new Error('این نقص قبلاً توسط مدیر QC تایید نهایی شده و قابل تغییر نیست.');
  }

  const nowIso = new Date().toISOString();
  const updatedDefect: QCDefect = {
    ...target,
    status: 'RESOLVED',
    resolutionNotes: resolutionNotes.trim(),
    resolutionPhotos,
    resolvedAt: nowIso,
    resolvedByUserId: user.id,
    resolvedByUserName: user.name,
  };

  const nextDefects = defects.map((d) => (d.id === defectId ? updatedDefect : d));

  return {
    qcDefects: nextDefects,
    updatedAt: nowIso,
  };
}

export interface VerifyDefectParams {
  project: Project;
  defectId: string;
  user: User;
  verificationNotes?: string;
}

/**
 * تایید راستی‌آزمایی رفع نقص توسط مدیر ارشد QC
 */
export function createDefectVerificationPayload(params: VerifyDefectParams): Partial<Project> {
  const { project, defectId, user, verificationNotes } = params;

  if (!isQcReviewerRole(user.role)) {
    throw new Error('دسترسی غیرمجاز: تایید راستی‌آزمایی رفع نقص منحصراً در صلاحیت مدیر ارشد QC است.');
  }

  const defects = project.qcDefects || [];
  const target = defects.find((d) => d.id === defectId);
  if (!target) {
    throw new Error('نقص کیفی مورد نظر در پروژه یافت نشد.');
  }

  const nowIso = new Date().toISOString();
  const updatedDefect: QCDefect = {
    ...target,
    status: 'VERIFIED',
    verificationNotes: verificationNotes?.trim() || 'رفع نقص توسط مدیر QC تایید شد.',
    verifiedAt: nowIso,
    verifiedByUserId: user.id,
    verifiedByUserName: user.name,
  };

  const nextDefects = defects.map((d) => (d.id === defectId ? updatedDefect : d));

  return {
    qcDefects: nextDefects,
    updatedAt: nowIso,
  };
}

export interface CustomerAcceptanceParams {
  project: Project;
  status: CustomerAcceptanceStatus;
  representativeName?: string;
  representativeRole?: string;
  representativePhone?: string;
  signature?: string;
  notes?: string;
  unavailabilityReason?: string;
  unavailabilityPhotos?: string[];
  customerSatisfaction?: number;
}

/**
 * ثبت صورت‌جلسه رضایت یا وضعیت حضور کارفرما / نماینده کارگاه
 * توجه صریح: رضایت مشتری جایگزین تایید کنترل کیفیت نیست و مستقلاً نگهداری می‌شود.
 */
export function createCustomerAcceptancePayload(params: CustomerAcceptanceParams): Partial<Project> {
  const {
    project,
    status,
    representativeName,
    representativeRole,
    representativePhone,
    signature,
    notes,
    unavailabilityReason,
    unavailabilityPhotos = [],
    customerSatisfaction,
  } = params;

  if (status === 'UNAVAILABLE' && (!unavailabilityReason || !unavailabilityReason.trim())) {
    throw new Error('در صورت عدم حضور کارفرما، ثبت دلیل مستند عدم امکان اخذ امضا الزامی است.');
  }

  const nowIso = new Date().toISOString();

  const record: CustomerAcceptanceRecord = {
    status,
    representativeName: representativeName?.trim() || project.customerName,
    representativeRole: representativeRole?.trim() || undefined,
    representativePhone: representativePhone?.trim() || project.customerPhone,
    acceptedAt: nowIso,
    notes: notes?.trim() || undefined,
    signature: signature || undefined,
    unavailabilityReason: unavailabilityReason?.trim() || undefined,
    unavailabilityPhotos,
    customerSatisfaction: customerSatisfaction || undefined,
  };

  const patch: Partial<Project> = {
    customerAcceptance: record,
    // حفظ سازگاری با فیلدهای ریشه موجود
    customerSignature: signature || project.customerSignature,
    customerSatisfaction: customerSatisfaction || project.customerSatisfaction,
    representativeRole: representativeRole?.trim() || project.representativeRole,
    representativePhone: representativePhone?.trim() || project.representativePhone,
    unavailabilityReason: unavailabilityReason?.trim() || project.unavailabilityReason,
    unavailabilityPhotos: unavailabilityPhotos.length > 0 ? unavailabilityPhotos : project.unavailabilityPhotos,
    updatedAt: nowIso,
  };

  return patch;
}

/**
 * مدارک تحویل لازم برای تایید نهایی QC:
 * حداقل یک عکس بعد از نصب + امضای مشتری (یا ثبت مستند علت عدم حضور/امضا).
 * پروژه‌های منتقل‌شده از قبل از سامانه (isHistoricalMigration) از این شرط معاف‌اند.
 */
export function getHandoverEvidence(project: Project): { hasPhotos: boolean; hasAcceptance: boolean; exempt: boolean } {
  const photos = [...(project.afterPhotos || []), ...(project.completionPhotos || [])].filter(Boolean);
  const acceptance = project.customerAcceptance;
  const hasAcceptance = Boolean(
    project.customerSignature ||
      acceptance?.signature ||
      (project.unavailabilityReason && project.unavailabilityReason.trim()) ||
      (acceptance?.unavailabilityReason && acceptance.unavailabilityReason.trim())
  );
  return { hasPhotos: photos.length > 0, hasAcceptance, exempt: Boolean((project as any).isHistoricalMigration) };
}
