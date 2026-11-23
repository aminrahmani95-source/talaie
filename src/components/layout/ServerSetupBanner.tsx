import React from 'react';
import { ServerCrash } from 'lucide-react';

/**
 * Shown to the QC manager / CEO when the server lacks migrations this app version needs.
 * Without them people, teams and sales bookings cannot be saved on the server, and every
 * device ends up with its own different list.
 */
export const ServerSetupBanner: React.FC<{ missing: string[] }> = ({ missing }) => {
  if (missing.length === 0) return null;
  return (
    <div role="alert" className="mb-4 rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 text-sm space-y-2">
      <p className="font-black text-rose-700 dark:text-rose-300 flex items-center gap-2">
        <ServerCrash className="w-5 h-5 shrink-0" />
        سرور به‌روز نیست؛ بعضی اطلاعات بین دستگاه‌ها همگام نمی‌شود
      </p>
      <p className="text-xs text-ink-2 leading-relaxed">
        در Supabase وارد <strong>SQL Editor</strong> شوید و این فایل‌ها از پوشه‌ی <code dir="ltr">supabase/migrations</code> را
        به‌ترتیب اجرا کنید (Run). اجرای دوباره ضرری ندارد:
      </p>
      <ul className="text-xs font-mono text-ink space-y-0.5" dir="ltr">
        {missing.map((f) => (
          <li key={f}>• {f}</li>
        ))}
      </ul>
    </div>
  );
};
