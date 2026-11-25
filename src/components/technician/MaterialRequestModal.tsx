import React, { useState } from 'react';
import { Project, User, MaterialCategory, MaterialRequestReason, MaterialUrgency, MaterialRequest } from '../../types';
import {
  Package,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
  Minus,
  Scissors,
  Settings2,
  Sliders,
  Cpu,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  createMaterialRequestPayload,
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_REASON_LABELS,
  MATERIAL_URGENCY_LABELS,
  COMMON_MATERIAL_SUGGESTIONS,
} from '../../utils/materialRequests';
import { toPersianDigits, toEnglishDigits } from '../../utils/jalali';
import { Sheet } from '../ui/Sheet';

interface Props {
  project: Project;
  currentUser: User;
  onClose: () => void;
  onSubmit: (request: MaterialRequest) => Promise<void> | void;
}

interface DraftItem {
  title: string;
  category: MaterialCategory;
  requestedQty: number;
  unit: string;
  notes?: string;
}

const CATEGORY_ICONS: Record<MaterialCategory, React.ComponentType<{ className?: string }>> = {
  FABRIC: Scissors,
  HARDWARE: Settings2,
  PROFILE_TRACK: Sliders,
  MOTOR: Cpu,
  ACCESSORY: Layers,
  OTHER: HelpCircle,
};

export const MaterialRequestModal: React.FC<Props> = ({
  project,
  currentUser,
  onClose,
  onSubmit,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>('HARDWARE');
  const [selectedReason, setSelectedReason] = useState<MaterialRequestReason>('SHORTAGE');
  // «عادی» پیش‌فرض است تا «فوری» و «بحرانی» برای انبار معنی داشته باشند.
  const [selectedUrgency, setSelectedUrgency] = useState<MaterialUrgency>('NORMAL');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([
    {
      title: '',
      category: 'HARDWARE',
      requestedQty: 1,
      unit: 'عدد',
    },
  ]);
  const [qtyDrafts, setQtyDrafts] = useState<Record<number, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isDirty =
    notes.trim().length > 0 || items.some((it) => it.title.trim().length > 0) || items.length > 1;

  const requestClose = () => {
    if (submitting) return;
    if (isDirty && !window.confirm('درخواست ارسال نشده است. بدون ارسال بسته شود؟')) return;
    onClose();
  };

  // Quick suggestion click: اگر همان قلم قبلاً اضافه شده، فقط تعدادش یکی زیاد می‌شود
  const handleAddSuggestion = (sug: { title: string; category: MaterialCategory; unit: string }) => {
    setItems((prev) => {
      const existing = prev.findIndex((it) => it.title.trim() === sug.title);
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = { ...copy[existing], requestedQty: (copy[existing].requestedQty || 0) + 1 };
        return copy;
      }
      if (prev.length === 1 && !prev[0].title.trim()) {
        return [{ title: sug.title, category: sug.category, requestedQty: 1, unit: sug.unit }];
      }
      return [...prev, { title: sug.title, category: sug.category, requestedQty: 1, unit: sug.unit }];
    });
    setQtyDrafts({});
  };

  const handleUpdateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const stepQty = (index: number, delta: number) => {
    const current = items[index]?.requestedQty || 0;
    const next = Math.max(1, Math.round((current + delta) * 100) / 100);
    handleUpdateItem(index, { requestedQty: next });
    setQtyDrafts((d) => {
      const copy = { ...d };
      delete copy[index];
      return copy;
    });
  };

  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        title: '',
        category: selectedCategory,
        requestedQty: 1,
        unit: 'عدد',
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setQtyDrafts({});
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setErrorMessage(null);

    const validItems = items.filter((it) => it.title.trim().length > 0);
    if (validItems.length === 0) {
      setErrorMessage('حداقل نام یک قلم را بنویسید یا از اقلام پرکاربرد انتخاب کنید.');
      return;
    }
    if (validItems.some((it) => !(it.requestedQty > 0))) {
      setErrorMessage('تعداد هر قلم باید بیشتر از صفر باشد.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = createMaterialRequestPayload({
        project,
        user: currentUser,
        category: selectedCategory,
        reason: selectedReason,
        urgency: selectedUrgency,
        items: validItems.map((it) => ({ ...it, title: it.title.trim() })),
        notes: notes.trim() || undefined,
      });

      await onSubmit(payload);
    } catch (err: any) {
      setErrorMessage(err?.message || 'خطا در ثبت درخواست متریال.');
      setSubmitting(false);
    }
  };

  const filteredSuggestions = COMMON_MATERIAL_SUGGESTIONS.filter(
    (s) => s.category === selectedCategory
  );

  const subtitle = [project.code, project.title, project.customerName && project.customerName !== project.title ? project.customerName : '']
    .filter(Boolean)
    .join(' • ');

  const urgencyStyles: Record<MaterialUrgency, string> = {
    NORMAL: 'border-brand bg-raised text-ink',
    URGENT: 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200',
    CRITICAL_BLOCKING: 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-200',
  };
  const urgencyShort: Record<MaterialUrgency, string> = {
    NORMAL: 'عادی',
    URGENT: 'فوری',
    CRITICAL_BLOCKING: 'کار متوقف است',
  };

  const validCount = items.filter((it) => it.title.trim()).length;

  return (
    <Sheet
      isOpen
      onClose={requestClose}
      title="درخواست متریال / کسری"
      subtitle={subtitle}
      size="lg"
      footer={
        <div className="space-y-2">
          {errorMessage && (
            <div role="alert" className="text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-md border border-line bg-raised text-ink-2 hover:text-ink text-sm font-semibold hover:bg-hover transition min-h-[44px] cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              form="material-request-form"
              disabled={submitting}
              className="flex-[2] px-4 py-2.5 rounded-md bg-brand text-on-brand hover:bg-brand-hover text-sm font-bold transition min-h-[44px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Package className="w-4 h-4" />
              <span>
                {submitting
                  ? 'در حال ثبت...'
                  : validCount > 1
                    ? `ارسال ${toPersianDigits(validCount)} قلم به انبار`
                    : 'ارسال به انبار'}
              </span>
            </button>
          </div>
        </div>
      }
    >
      <form id="material-request-form" onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Category Selector */}
        <div>
          <span className="block text-xs font-bold text-ink mb-2">۱. چه نوع قطعه‌ای لازم دارید؟</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(MATERIAL_CATEGORY_LABELS) as MaterialCategory[]).map((cat) => {
              const Icon = CATEGORY_ICONS[cat];
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-md border text-[12px] font-semibold transition text-center cursor-pointer min-h-[56px] ${
                    isSelected
                      ? 'border-brand bg-raised text-brand-ink ring-1 ring-brand/40'
                      : 'border-line bg-sunken text-ink-2 hover:bg-raised hover:text-ink'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="leading-tight">{MATERIAL_CATEGORY_LABELS[cat]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Suggestions Pills */}
        {filteredSuggestions.length > 0 && (
          <div className="bg-sunken p-3 rounded-md border border-line">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-brand-ink" />
              <span>پرکاربردها — با هر بار زدن یکی اضافه می‌شود</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filteredSuggestions.map((sug, idx) => {
                const added = items.find((it) => it.title.trim() === sug.title);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddSuggestion(sug)}
                    className={`text-xs border px-2.5 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1 min-h-[36px] ${
                      added
                        ? 'bg-brand/15 border-brand text-ink font-bold'
                        : 'bg-raised hover:bg-hover border-line-strong text-ink'
                    }`}
                  >
                    <Plus className="w-3 h-3 text-brand-ink" />
                    <span>{sug.title}</span>
                    {added && (
                      <span className="bg-brand text-black rounded-full px-1.5 text-[11px] font-black tabular-nums">
                        {toPersianDigits(added.requestedQty)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Items List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-ink">۲. اقلام درخواستی</span>
            <button
              type="button"
              onClick={handleAddItemRow}
              className="text-xs font-semibold text-brand-ink hover:underline flex items-center gap-1 cursor-pointer py-1.5 px-2 min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ردیف جدید</span>
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="p-2.5 bg-sunken rounded-md border border-line space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-ink shrink-0 w-5 text-center tabular-nums">
                    {toPersianDigits(idx + 1)}
                  </span>
                  <input
                    type="text"
                    aria-label={`نام قلم ${idx + 1}`}
                    placeholder="نام قطعه یا متریال (مثلاً پایه سقفی)"
                    value={item.title}
                    onChange={(e) => handleUpdateItem(idx, { title: e.target.value })}
                    className="flex-1 min-w-0 text-sm p-2 rounded-md bg-canvas border border-line text-ink focus:border-brand min-h-[42px]"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(idx)}
                      className="text-rose-500 hover:text-rose-400 p-2 rounded-md hover:bg-rose-500/10 transition cursor-pointer min-w-[40px] min-h-[42px] flex items-center justify-center shrink-0"
                      aria-label="حذف این ردیف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 pr-7">
                  <div className="flex items-center rounded-md border border-line bg-canvas overflow-hidden">
                    <button
                      type="button"
                      onClick={() => stepQty(idx, 1)}
                      className="w-10 h-10 flex items-center justify-center text-ink hover:bg-raised cursor-pointer"
                      aria-label="افزایش تعداد"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`تعداد قلم ${idx + 1}`}
                      value={qtyDrafts[idx] ?? String(item.requestedQty || '')}
                      onChange={(e) => {
                        const raw = toEnglishDigits(e.target.value).replace(/[٫,]/g, '.').replace(/[^\d.]/g, '');
                        setQtyDrafts((d) => ({ ...d, [idx]: raw }));
                        const val = parseFloat(raw);
                        handleUpdateItem(idx, { requestedQty: isNaN(val) ? 0 : val });
                      }}
                      className="w-14 h-10 text-sm bg-transparent text-ink text-center font-bold tabular-nums border-x border-line"
                    />
                    <button
                      type="button"
                      onClick={() => stepQty(idx, -1)}
                      className="w-10 h-10 flex items-center justify-center text-ink hover:bg-raised cursor-pointer"
                      aria-label="کاهش تعداد"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                  <select
                    aria-label={`واحد قلم ${idx + 1}`}
                    value={item.unit}
                    onChange={(e) => handleUpdateItem(idx, { unit: e.target.value })}
                    className="text-sm px-2 rounded-md bg-canvas border border-line text-ink focus:border-brand h-10"
                  >
                    <option value="عدد">عدد</option>
                    <option value="متر">متر</option>
                    <option value="شاخه">شاخه</option>
                    <option value="دستگاه">دستگاه</option>
                    <option value="جفت">جفت</option>
                    <option value="بسته">بسته</option>
                    <option value="طاقه">طاقه</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Urgency */}
        <div>
          <span className="block text-xs font-bold text-ink mb-2">۳. چقدر فوری است؟</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(MATERIAL_URGENCY_LABELS) as MaterialUrgency[]).map((u) => {
              const isSelected = selectedUrgency === u;
              return (
                <button
                  key={u}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedUrgency(u)}
                  className={`min-h-[44px] rounded-md border text-xs font-bold transition cursor-pointer px-1 ${
                    isSelected ? urgencyStyles[u] : 'border-line bg-sunken text-ink-2 hover:text-ink'
                  }`}
                >
                  {urgencyShort[u]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Reason */}
        <div>
          <span className="block text-xs font-bold text-ink mb-2">۴. علت</span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MATERIAL_REASON_LABELS) as MaterialRequestReason[]).map((r) => {
              const isSelected = selectedReason === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedReason(r)}
                  className={`text-xs px-3 py-2 rounded-full border font-semibold transition cursor-pointer min-h-[36px] ${
                    isSelected
                      ? 'border-brand bg-raised text-ink ring-1 ring-brand/40'
                      : 'border-line bg-sunken text-ink-2 hover:text-ink'
                  }`}
                >
                  {MATERIAL_REASON_LABELS[r]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Notes */}
        <div>
          <label htmlFor="material-notes" className="block text-xs font-bold text-ink mb-1.5">
            توضیح برای انبار (اختیاری)
          </label>
          <textarea
            id="material-notes"
            rows={2}
            placeholder="مثلاً: برای پنجره دوم سالن؛ سقف بتنی است و پایه دوبل لازم است."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-sm p-2.5 rounded-md bg-canvas border border-line text-ink focus:border-brand resize-none"
          />
        </div>
      </form>
    </Sheet>
  );
};
