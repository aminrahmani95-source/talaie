import { useCallback, useEffect, useState } from 'react';

const THEME_KEY = 'talaie_theme';

/**
 * تم برنامه (تیره/روشن).
 * تم تیره پیش‌فرض است؛ تم روشن فقط با انتخاب خود کاربر فعال و ذخیره می‌شود.
 * رنگ‌ها از توکن‌های index.css می‌آیند، پس هر دو تم یکپارچه هستند.
 */
export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) !== 'light';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDarkMode ? '#0D1117' : '#F3F4F6');
    try {
      localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
    } catch {
      // storage may be unavailable (private mode); theme still applies for this session
    }
  }, [isDarkMode]);

  const toggleTheme = useCallback(() => setIsDarkMode((prev) => !prev), []);

  return { isDarkMode, toggleTheme };
}
