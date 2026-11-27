import type { Project } from '../types';

export type PhotoGroupField = 'beforePhotos' | 'afterPhotos' | 'completionPhotos';

export const PHOTO_GROUP_LABEL: Record<PhotoGroupField, string> = {
  beforePhotos: 'قبل از نصب',
  afterPhotos: 'بعد از نصب',
  completionPhotos: 'اتمام کار',
};

/**
 * عکسی که در بخش اشتباه گذاشته شده، به بخش دیگر منتقل می‌شود.
 * خروجی: پچی که هر دو فهرست را با هم دارد (یک ذخیره، تا عکس نه گم شود نه دو بار بماند)؛
 * null اگر جابه‌جایی ممکن نباشد.
 */
export function movePhotoBetweenGroups(
  project: Pick<Project, PhotoGroupField>,
  from: PhotoGroupField,
  index: number,
  to: PhotoGroupField
): Partial<Record<PhotoGroupField, string[]>> | null {
  if (from === to) return null;
  const source = [...((project[from] as string[] | undefined) || [])];
  if (index < 0 || index >= source.length) return null;
  const [photo] = source.splice(index, 1);
  const target = [...((project[to] as string[] | undefined) || [])];
  if (!target.includes(photo)) target.push(photo);
  return { [from]: source, [to]: target };
}
