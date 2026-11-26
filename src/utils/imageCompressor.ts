/**
 * Lightweight client-side image compressor for mobile field uploads.
 * Reduces 5MB-15MB smartphone photos to ~70KB-140KB,
 * preventing LocalStorage quota exceptions and speeding up cloud sync.
 *
 * HEIC/HEIF (default camera format on iPhones and on many Samsung phones) cannot be
 * decoded by Chrome/Android. Before this fix such photos were uploaded raw: 2-3MB each,
 * no preview on the phone and no picture for QC on a computer. They are now converted to
 * JPEG first (the converter is loaded only when a HEIC photo is actually picked).
 */

/** Formats every browser can show in an <img>. Anything else must be re-encoded. */
const WEB_SAFE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

import { reportClientError, describeError } from './errorReporter';

export class ImageFormatError extends Error {}

function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = src;
  });
}

/** HEIC/HEIF by MIME, by extension, or by the `ftyp` brand in the file header (some pickers send an empty type). */
export async function looksLikeHeic(file: Blob & { name?: string }): Promise<boolean> {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif' || type === 'image/heic-sequence' || type === 'image/heif-sequence') {
    return true;
  }
  if (/\.(heic|heif)$/i.test(file.name || '')) return true;
  if (type && WEB_SAFE_TYPES.has(type)) return false;
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const ftyp = String.fromCharCode(...head.slice(4, 8));
    const brand = String.fromCharCode(...head.slice(8, 12));
    return ftyp === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand);
  } catch {
    return false;
  }
}

async function heicToJpegBlob(file: Blob): Promise<Blob> {
  const { heicTo } = await import('heic-to');
  return heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
}

/**
 * عکس را برای آپلود آماده می‌کند (تبدیل HEIC، کوچک کردن، JPEG). اگر نشد، خطا با مشخصات
 * فایل (نوع، حجم، پسوند) به‌طور خودکار برای مدیر گزارش می‌شود.
 */
export async function compressImageFile(
  file: File,
  maxWidthOrOptions: number | { maxWidth?: number; maxHeight?: number; quality?: number } = 1280,
  maxHeight = 1280,
  quality = 0.75
): Promise<string> {
  try {
    return await compressImageFileInner(file, maxWidthOrOptions, maxHeight, quality);
  } catch (err) {
    const d = describeError(err);
    reportClientError({
      context: 'PHOTO_PREPARE',
      message: d.message,
      details: {
        name: d.name,
        type: file?.type || '(empty)',
        kb: Math.round((file?.size || 0) / 1024),
        ext: ((file?.name || '').match(/\.([\w]+)$/) || [])[1] || '',
      },
    });
    throw err;
  }
}

async function compressImageFileInner(
  file: File,
  maxWidthOrOptions: number | { maxWidth?: number; maxHeight?: number; quality?: number },
  maxHeight: number,
  quality: number
): Promise<string> {
  let maxWidth = 1280;
  if (typeof maxWidthOrOptions === 'object') {
    maxWidth = maxWidthOrOptions.maxWidth ?? 1280;
    maxHeight = maxWidthOrOptions.maxHeight ?? 1280;
    quality = maxWidthOrOptions.quality ?? 0.75;
  } else {
    maxWidth = maxWidthOrOptions;
  }

  // SVG: keep as-is (vector, small, displayable)
  if (file.type === 'image/svg+xml') {
    return readAsDataURL(file);
  }

  let source: Blob = file;
  let img: HTMLImageElement | null = null;

  const isHeic = await looksLikeHeic(file);
  if (!isHeic) {
    try {
      img = await loadImage(await readAsDataURL(source));
    } catch {
      img = null;
    }
  }

  // Not decodable as-is (HEIC on Chrome/Android, or an unknown camera format): try converting.
  if (!img) {
    try {
      source = await heicToJpegBlob(file);
      img = await loadImage(await readAsDataURL(source));
    } catch {
      // Safari can show HEIC natively; use it when the converter is unavailable.
      if (isHeic) {
        try {
          img = await loadImage(await readAsDataURL(file));
          source = file;
        } catch {
          img = null;
        }
      }
    }
  }

  if (!img) {
    // Never upload something that cannot be shown: QC would only see "تصویر در دسترس نیست".
    const raw = await readAsDataURL(file);
    if (WEB_SAFE_TYPES.has((file.type || '').toLowerCase())) return raw;
    throw new ImageFormatError(
      'این عکس با فرمتی ذخیره شده که قابل خواندن نیست. لطفاً با دکمه «دوربین» عکس بگیرید یا عکس دیگری انتخاب کنید.'
    );
  }

  let { width, height } = img;
  if (width > maxWidth || height > maxHeight) {
    if (width / height > maxWidth / maxHeight) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    } else {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return readAsDataURL(source);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}
