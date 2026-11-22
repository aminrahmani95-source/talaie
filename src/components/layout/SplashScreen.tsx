import React from 'react';
import { LOGO_GOLD } from '../../assets/logo';

/** صفحه انتظار هنگام بررسی نشست کاربر */
export const SplashScreen: React.FC = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-canvas text-brand-ink p-4" role="status">
    <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
      <div className="w-16 h-16 rounded-3xl bg-surface border-2 border-brand flex items-center justify-center p-3 shadow-2xl">
        <img src={LOGO_GOLD} alt="نشان گالری طلایی" className="w-full h-full object-contain animate-pulse" />
      </div>
      <div className="text-center">
        <div className="text-base font-black text-ink">گالری طلایی</div>
        <div className="text-xs text-ink-2 mt-1">در حال بررسی نشست کاربری…</div>
      </div>
    </div>
  </div>
);
