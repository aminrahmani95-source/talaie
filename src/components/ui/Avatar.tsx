import React from 'react';
import { UserRole } from '../../types';

export interface AvatarProps {
  name: string;
  id?: string;
  role?: UserRole;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// Accessible, distinct color palette for user avatars
const AVATAR_PALETTE = [
  'bg-[#7A6126] text-white',
  'bg-[#1E3A8A] text-white',
  'bg-[#065F46] text-white',
  'bg-[#991B1B] text-white',
  'bg-[#6B21A8] text-white',
  'bg-[#0E7490] text-white',
  'bg-[#854D0E] text-white',
  'bg-[#374151] text-white',
];

function getAvatarInitials(fullName: string): string {
  if (!fullName) return '';
  // Clean role suffixes like (مسئول QC) or (سرپرست اکیپ)
  const clean = fullName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 1);
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).slice(0, 2);
}

function getAvatarColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  id = '',
  role,
  size = 'md',
  className = '',
}) => {
  const initials = getAvatarInitials(name) || '؟';
  const colorClass = getAvatarColor(id || name);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px] rounded-lg',
    sm: 'w-8 h-8 text-xs rounded-xl',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-12 h-12 text-base rounded-2xl',
    xl: 'w-14 h-14 text-lg rounded-2xl',
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center font-bold tracking-tight select-none shadow-2xs shrink-0 ${sizeClasses} ${colorClass} ${className}`}
      title={name}
      aria-label={name}
    >
      <span>{initials}</span>

      {/* Role indicator ring or dot */}
      {role === 'QC_MANAGER' && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#C1A056] border-2 border-white dark:border-[#121212] rounded-full"
          title="مسئول QC"
        />
      )}
      {role === 'LEAD_TECHNICIAN' && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500 border-2 border-white dark:border-[#121212] rounded-full"
          title="سرپرست اکیپ"
        />
      )}
    </div>
  );
};
