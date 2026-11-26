import type { Project, SalesProjectBooking } from '../types';
import { toPersianDigits } from './jalali';

/** سه محصول گالری: شید، ریل، پرده */
export interface ProductCounts {
  shade: number;
  rail: number;
  curtain: number;
}

export const totalProductUnits = (c: Partial<ProductCounts>) =>
  (c.shade || 0) + (c.rail || 0) + (c.curtain || 0);

/**
 * وزن هر محصول در ظرفیت روزانه‌ی اکیپ (واحد = یک لت شید).
 * - شید و پرده: هر لت یک واحد (هر دو نصب پایه + آویز + تنظیم دارند).
 * - ریل: نیم واحد. نصب ریل فقط سوراخ‌کاری، پایه و تراز است (بدون پارچه، موتور یا تنظیم)،
 *   و معمولاً روی همان پنجره‌ای است که پرده‌اش هم شمرده شده؛ اگر کامل حساب شود ظرفیت
 *   دوبار کم می‌شود و تقویم فروش بی‌دلیل پر نشان می‌دهد.
 * برای تغییر، فقط همین عددها را عوض کنید.
 */
export const CAPACITY_WEIGHTS: ProductCounts = { shade: 1, rail: 0.5, curtain: 1 };

/** ظرفیت لازم به «لت» (عدد صحیح، رو به بالا) */
export const capacityUnits = (c: Partial<ProductCounts>) =>
  Math.ceil(
    (c.shade || 0) * CAPACITY_WEIGHTS.shade +
      (c.rail || 0) * CAPACITY_WEIGHTS.rail +
      (c.curtain || 0) * CAPACITY_WEIGHTS.curtain
  );

/** خلاصه‌ی خوانا مثل «10 شید • 2 ریل • 4 پرده» (صفرها نمایش داده نمی‌شوند) */
export function formatProductCounts(c: Partial<ProductCounts>): string {
  const parts: string[] = [];
  if (c.shade) parts.push(`${toPersianDigits(c.shade)} شید`);
  if (c.rail) parts.push(`${toPersianDigits(c.rail)} ریل`);
  if (c.curtain) parts.push(`${toPersianDigits(c.curtain)} پرده`);
  return parts.join(' • ');
}

export const projectProductCounts = (
  p: Pick<Project, 'shadePanels' | 'curtainPanels' | 'railCount'>
): ProductCounts => ({
  shade: p.shadePanels || 0,
  rail: p.railCount || 0,
  curtain: p.curtainPanels || 0,
});

/** رزروهای قدیمی فقط «تعداد لت» داشتند؛ آن را شید حساب می‌کنیم */
export const bookingProductCounts = (b: SalesProjectBooking): ProductCounts =>
  b.shadeCount !== undefined || b.railCount !== undefined || b.curtainCount !== undefined
    ? { shade: b.shadeCount || 0, rail: b.railCount || 0, curtain: b.curtainCount || 0 }
    : { shade: b.lathsCount || 0, rail: 0, curtain: 0 };
