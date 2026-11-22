import React from 'react';

/** نوار یک‌خطی وضعیت آفلاین زیر هدر */
export const OfflineBanner: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;
  return (
    <div
      role="status"
      className="bg-amber-500/10 border-b border-amber-500/25 text-amber-300 text-xs py-1.5 px-4 text-center font-bold flex items-center justify-center gap-2"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
      <span>آفلاین هستید؛ تغییرات ذخیره و پس از اتصال ارسال می‌شوند.</span>
    </div>
  );
};
