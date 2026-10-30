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
    if (
      src.startsWith('data:') ||
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('blob:')
    ) {
      return src;
    }
    return undefined;
  });

  useEffect(() => {
    if (!src) {
      setResolvedSrc(undefined);
      return;
    }

    if (
      src.startsWith('data:') ||
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('blob:')
    ) {
      setResolvedSrc(src);
      return;
    }

    let isMounted = true;
    SupabaseSyncService.getSignedPhotoUrl(src).then((url) => {
      if (isMounted) {
        setResolvedSrc(url);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [src]);

  if (!src || src.trim() === '') {
    if (fallback) return <>{fallback}</>;
    return null;
  }

  if (!resolvedSrc) {
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className={`bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-lg flex items-center justify-center text-zinc-400 text-[10px] ${className}`}
      >
        <span>در حال بارگذاری...</span>
      </div>
    );
  }

  return <img src={resolvedSrc} alt={alt} className={className} {...rest} />;
};
