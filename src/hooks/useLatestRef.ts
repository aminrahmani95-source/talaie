import { useEffect, useRef } from 'react';

/**
 * یک ref که همیشه آخرین مقدار را نگه می‌دارد.
 * برای هندلرهای async که بعد از await به آخرین state نیاز دارند (بدون stale closure).
 * ref مستقیماً قابل نوشتن است تا به‌روزرسانی‌های خوش‌بینانه بلافاصله دیده شوند.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
