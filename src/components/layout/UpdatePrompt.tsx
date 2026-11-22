import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { SW_UPDATE_EVENT, applyServiceWorkerUpdate } from '../../app/registerServiceWorker';

/** نوار شناور «نسخه جدید آماده است» */
export const UpdatePrompt: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener(SW_UPDATE_EVENT, show);
    return () => window.removeEventListener(SW_UPDATE_EVENT, show);
  }, []);

  if (!visible) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-20 lg:bottom-6 lg:inset-x-auto lg:left-6 z-50 flex items-center gap-3 p-3 pr-4 rounded-xl bg-surface border border-brand/50 shadow-2xl max-w-md"
    >
      <span className="text-sm font-bold text-ink flex-1">نسخه جدید برنامه آماده است.</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="px-2.5 py-2 text-xs font-bold text-ink-2 hover:text-ink cursor-pointer"
      >
        بعداً
      </button>
      <button
        type="button"
        onClick={applyServiceWorkerUpdate}
        className="px-3.5 py-2 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-xs font-black flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        به‌روزرسانی
      </button>
    </div>
  );
};
