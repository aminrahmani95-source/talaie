import { useEffect, useState } from 'react';
import { localDateKey } from '../utils/jalali';

/**
 * کلید تاریخ امروز (YYYY-MM-DD محلی) که نیمه‌شب خودش عوض می‌شود.
 * قبلاً با useMemo(..., []) ثابت می‌ماند و صفحه‌ای که شب باز مانده بود، صبح «امروز» را دیروز نشان می‌داد.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => localDateKey());
  useEffect(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const t = setTimeout(() => setToday(localDateKey()), next.getTime() - now.getTime());
    // برگشت از پس‌زمینه (گوشی) هم تاریخ را تازه می‌کند
    const onVisible = () => {
      if (document.visibilityState === 'visible') setToday(localDateKey());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [today]);
  return today;
}
