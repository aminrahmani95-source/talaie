import React, { useState, useEffect } from 'react';
import { SupabaseSyncService } from '../../utils/supabase';
import { looksLikeHeic } from '../../utils/imageCompressor';

/**
 * عکس‌های HEIC قدیمی (قبل از تبدیل خودکار به JPEG آپلود شده‌اند) در کروم/اندروید باز نمی‌شوند.
 * وقتی <img> خطا داد، فایل را می‌گیریم و اگر HEIC بود همین‌جا به JPEG تبدیل و نمایش می‌دهیم.
 */
const heicCache = new Map<string, Promise<string | null>>();
function convertHeicUrl(url: string): Promise<string | null> {
  let job = heicCache.get(url);
  if (!job) {
    job = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!(await looksLikeHeic(blob))) return null;
        const { heicTo } = await import('heic-to');
        const jpeg = await heicTo({ blob, type: 'image/jpeg', quality: 0.85 });
        return URL.createObjectURL(jpeg);
      } catch {
        return null;
      }
    })();
    heicCache.set(url, job);
  }
  return job;
}

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallback?: React.ReactNode;
}

export const CloudImage: React.FC<Props> = ({
  src,
  alt = '',
  className = '',
  fallback,
  ...rest
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(() => {
    if (!src) return undefined;
    const trimmed = src.trim();
    if (
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) && !trimmed.includes('talaie-photos'))
    ) {
      return trimmed;
    }
    return undefined;
  });

  const [hasError, setHasError] = useState(false);
  const [triedHeic, setTriedHeic] = useState(false);

  useEffect(() => {
    setHasError(false);
    setTriedHeic(false);
    if (!src || src.trim() === '') {
      setResolvedSrc(undefined);
      return;
    }

    const trimmed = src.trim();
    if (
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) && !trimmed.includes('talaie-photos'))
    ) {
      setResolvedSrc(trimmed);
      return;
    }

    let isMounted = true;
    SupabaseSyncService.getSignedPhotoUrl(trimmed)
      .then((url) => {
        if (isMounted) {
          if (url) {
            setResolvedSrc(url);
          } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            setResolvedSrc(trimmed);
          } else {
            setHasError(true);
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            setResolvedSrc(trimmed);
          } else {
            setHasError(true);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [src]);

  if (!src || src.trim() === '' || hasError) {
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className={`bg-stone-100 text-stone-400 text-[11px] flex items-center justify-center rounded p-1 text-center ${className}`}
      >
        <span>تصویر در دسترس نیست</span>
      </div>
    );
  }

  if (!resolvedSrc) {
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className={`bg-stone-200 animate-pulse rounded flex items-center justify-center text-stone-500 text-[11px] ${className}`}
      >
        <span>در حال بارگذاری تصویر...</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (triedHeic || resolvedSrc.startsWith('blob:') || resolvedSrc.startsWith('data:image/jpeg') || resolvedSrc.startsWith('data:image/png')) {
          setHasError(true);
          return;
        }
        setTriedHeic(true);
        const failed = resolvedSrc;
        convertHeicUrl(failed).then((converted) => {
          if (converted) setResolvedSrc(converted);
          else setHasError(true);
        });
      }}
      {...rest}
    />
  );
};
