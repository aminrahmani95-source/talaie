import React from 'react';
import { Eye, LogOut } from 'lucide-react';
import type { User } from '../../types';
import { getDisplayName } from '../../utils/technicianName';
import { getUserRoleLabel } from '../../utils/roleLabels';

interface Props {
  viewedUser: User;
  impersonator: User | null;
  onExit: () => void;
}

/** نوار هشدار «حالت بازرسی» وقتی مدیر سامانه را از دید کاربر دیگری می‌بیند */
export const ImpersonationBanner: React.FC<Props> = ({ viewedUser, impersonator, onExit }) => {
  if (!impersonator) return null;
  return (
    <aside
      aria-label="حالت بازرسی هویت فعال است"
      className="sticky top-0 z-50 bg-brand text-on-brand px-3 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs font-bold"
    >
      <span className="flex items-center gap-2 min-w-0">
        <Eye className="w-4 h-4 shrink-0" />
        <span className="truncate">
          نمایش به‌عنوان <strong>{getDisplayName(viewedUser.name)}</strong> ({getUserRoleLabel(viewedUser.role)})
        </span>
      </span>
      <button
        type="button"
        onClick={onExit}
        className="px-3 py-1.5 bg-canvas hover:bg-raised text-brand-ink rounded-lg text-xs font-black transition flex items-center gap-1.5 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas"
      >
        <LogOut className="w-3.5 h-3.5" />
        بازگشت
      </button>
    </aside>
  );
};
