import React, { useState, useEffect } from 'react';
import { SupabaseSyncService } from '../../utils/supabase';

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

  useEffect(() => {
    setHasError(false);
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
    SupabaseSyncService.getSignedPhotoUrl(trimmed).then((url) => {
      if (isMounted) {
        if (url) {
          setResolvedSrc(url);
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
        className={`bg-stone-100 text-stone-400 text-[10px] flex items-center justify-center rounded p-1 text-center ${className}`}
      >
        <span>تصویر در دسترس نیست</span>
      </div>
    );
  }

  if (!resolvedSrc) {
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className={`bg-stone-200 animate-pulse rounded flex items-center justify-center text-stone-500 text-[10px] ${className}`}
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
      onError={() => setHasError(true)}
      {...rest}
    />
  );
};
