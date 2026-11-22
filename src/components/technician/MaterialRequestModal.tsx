import React, { useState } from 'react';
import { Project, User, MaterialCategory, MaterialRequestReason, MaterialUrgency, MaterialRequest } from '../../types';
import {
  Package,
  X,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
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
import { toPersianDigits } from '../../utils/jalali';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  project: Project;
  currentUser: User;
  onClose: () => void;
  onSubmit: (request: MaterialRequest) => void;
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
  useEscapeKey(onClose);
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>('HARDWARE');
  const [selectedReason, setSelectedReason] = useState<MaterialRequestReason>('SHORTAGE');
  const [selectedUrgency, setSelectedUrgency] = useState<MaterialUrgency>('URGENT');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([
    {
      title: '',
      category: 'HARDWARE',
      requestedQty: 1,
      unit: 'عدد',
    },
  ]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Quick suggestion click
  const handleAddSuggestion = (sug: { title: string; category: MaterialCategory; unit: string }) => {
    // If the first item is empty, replace it; otherwise append
    setItems((prev) => {
      if (prev.length === 1 && !prev[0].title.trim()) {
        return [{ title: sug.title, category: sug.category, requestedQty: 1, unit: sug.unit }];
      }
      return [...prev, { title: sug.title, category: sug.category, requestedQty: 1, unit: sug.unit }];
    });
    setSelectedCategory(sug.category);
  };

  const handleUpdateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validItems = items.filter((it) => it.title.trim().length > 0);
    if (validItems.length === 0) {
      setErrorMessage('لطفاً حداقل عنوان یک قلم متریال درخواستی را وارد کنید.');
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
        items: validItems,
        notes: notes.trim() || undefined,
      });

      onSubmit(payload);
    } catch (err: any) {
      setErrorMessage(err.message || 'خطا در ثبت درخواست متریال.');
      setSubmitting(false);
    }
  };

  const filteredSuggestions = COMMON_MATERIAL_SUGGESTIONS.filter(
    (s) => s.category === selectedCategory
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-surface w-full max-w-2xl rounded-lg shadow-2xl border border-line overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-canvas text-ink p-4 sm:p-5 flex items-center justify-between border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-raised border border-brand/30 flex items-center justify-center text-brand-ink">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 id="material-modal-title" className="text-base sm:text-lg font-bold text-ink">
                درخواست کسری و تامین متریال
              </h2>
              <p className="text-xs text-ink-2 font-medium">
                {project.title} ({project.code}) — {project.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-raised text-ink-2 hover:text-ink transition flex items-center justify-center cursor-pointer"
            aria-label="بستن پنجره"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 max-h-[calc(85vh-8rem)] overflow-y-auto">
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-md text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-2">
              دسته‌بندی اصلی متریال:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(MATERIAL_CATEGORY_LABELS) as MaterialCategory[]).map((cat) => {
                const Icon = CATEGORY_ICONS[cat];
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat);
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-md border text-xs font-semibold transition text-right cursor-pointer min-h-[44px] ${
                      isSelected
                        ? 'border-brand bg-raised text-brand-soft ring-1 ring-brand/40'
                        : 'border-line bg-sunken text-ink-2 hover:bg-raised hover:text-ink'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{MATERIAL_CATEGORY_LABELS[cat]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Suggestions Pills (Zero typing!) */}
          {filteredSuggestions.length > 0 && (
            <div className="bg-sunken p-3 rounded-md border border-line">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-brand-ink" />
                <span>اقلام پرکاربرد (یک‌کلیک برای افزودن):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {filteredSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddSuggestion(sug)}
                    className="text-xs bg-raised hover:bg-hover hover:border-brand border border-line-strong px-2.5 py-1.5 rounded-md text-ink transition cursor-pointer flex items-center gap-1 min-h-[36px]"
                  >
                    <Plus className="w-3 h-3 text-brand-ink" />
                    <span>{sug.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Items List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-ink">
                اقلام مورد نیاز جهت ارسال به کارگاه:
              </label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs font-semibold text-brand-ink hover:underline flex items-center gap-1 cursor-pointer py-1 px-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن ردیف جدید</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-sunken rounded-md border border-line"
                >
                  <span className="text-xs font-bold text-brand-ink self-center shrink-0 w-6 text-center tabular-nums">
                    {toPersianDigits(idx + 1)}.
                  </span>

                  <input
                    type="text"
                    placeholder="عنوان دقیق قطعه یا متریال..."
                    value={item.title}
                    onChange={(e) => handleUpdateItem(idx, { title: e.target.value })}
                    className="flex-1 text-xs p-2 rounded-md bg-canvas border border-line text-ink focus:border-brand min-h-[40px]"
                    required
                  />

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 w-24">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.1"
                        step="any"
                        value={item.requestedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleUpdateItem(idx, { requestedQty: isNaN(val) ? 0 : val });
                        }}
                        className="w-14 text-xs p-2 rounded-md bg-canvas border border-line text-ink text-center font-bold tabular-nums focus:border-brand min-h-[40px]"
                        required
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => handleUpdateItem(idx, { unit: e.target.value })}
                        className="text-xs p-2 rounded-md bg-canvas border border-line text-ink focus:border-brand min-h-[40px]"
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

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="text-rose-400 hover:text-rose-300 p-2 rounded-md hover:bg-rose-500/10 transition cursor-pointer min-w-[36px] min-h-[40px] flex items-center justify-center"
                        title="حذف این ردیف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Reason & Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                علت نیاز به متریال:
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value as MaterialRequestReason)}
                className="w-full text-xs p-2.5 rounded-md bg-canvas border border-line text-ink font-medium focus:border-brand min-h-[44px]"
              >
                {(Object.keys(MATERIAL_REASON_LABELS) as MaterialRequestReason[]).map((r) => (
                  <option key={r} value={r}>
                    {MATERIAL_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                اولویت و فوریت تحویل:
              </label>
              <select
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value as MaterialUrgency)}
                className="w-full text-xs p-2.5 rounded-md bg-canvas border border-line text-ink font-medium focus:border-brand min-h-[44px]"
              >
                {(Object.keys(MATERIAL_URGENCY_LABELS) as MaterialUrgency[]).map((u) => (
                  <option key={u} value={u}>
                    {MATERIAL_URGENCY_LABELS[u].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Notes */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              توضیحات تکمیلی سر کارگاه (اختیاری):
            </label>
            <textarea
              rows={2}
              placeholder="مثال: جهت پنجره دوم سالن، به دلیل بتن بودن سقف نیاز به پایه‌های دوبل داریم..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-md bg-canvas border border-line text-ink focus:border-brand resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-md border border-line bg-raised text-ink-2 hover:text-ink text-xs font-semibold hover:bg-hover transition min-h-[44px] cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-md bg-brand text-on-brand hover:bg-brand-hover text-xs font-bold transition min-h-[44px] flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Package className="w-4 h-4" />
              <span>{submitting ? 'در حال ثبت...' : 'ارسال درخواست به انبار و دفتر'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
