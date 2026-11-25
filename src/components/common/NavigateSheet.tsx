import React from 'react';
import { Copy, ExternalLink, MapPin, Navigation } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { triggerToast } from '../Toast';
import { toEnglishDigits } from '../../utils/jalali';

/**
 * Turns whatever the planner pasted into a link a phone can open.
 * - a full link (Neshan/Balad/Google share link) is used as-is
 * - "35.7, 51.4" coordinates become a map link
 * - anything else is not a link
 */
export function normalizeLocationLink(raw?: string): string | null {
  const v = toEnglishDigits((raw || '').trim());
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(www\.|nshn\.ir|balad\.ir|neshan\.org|maps\.app\.goo\.gl|goo\.gl)/i.test(v)) return `https://${v}`;
  const m = v.match(/^(-?\d{1,2}\.\d+)\s*[,،\s]\s*(-?\d{1,3}\.\d+)$/);
  if (m) return `https://www.google.com/maps/search/?api=1&query=${m[1]},${m[2]}`;
  return null;
}

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

interface Props {
  isOpen: boolean;
  onClose: () => void;
  address?: string;
  locationUrl?: string;
  title?: string;
}

/**
 * مسیریابی: لینک لوکیشن اگر هست مستقیم، وگرنه آدرس در برنامه‌ی نقشه‌ی گوشی.
 * (قبلاً بدون لینک به یک آدرس جستجوی ساختگی nshn.ir می‌رفت که باز نمی‌شد.)
 */
export const NavigateSheet: React.FC<Props> = ({ isOpen, onClose, address, locationUrl, title }) => {
  const link = normalizeLocationLink(locationUrl);
  const q = encodeURIComponent((address || '').trim());
  const ios = isIOS();

  const options: { label: string; hint: string; href: string }[] = [];
  if (link) options.push({ label: 'لینک لوکیشن پروژه', hint: 'همان لینکی که دفتر ثبت کرده (نشان / بلد / گوگل)', href: link });
  if (q) {
    if (ios) {
      options.push({ label: 'نقشه‌ی آیفون (Apple Maps)', hint: 'جستجوی آدرس', href: `https://maps.apple.com/?q=${q}` });
    } else {
      options.push({ label: 'نشان / بلد / برنامه‌ی نقشه', hint: 'گوشی برنامه‌ی نقشه را می‌پرسد', href: `geo:0,0?q=${q}` });
    }
    options.push({ label: 'گوگل‌مپ', hint: 'جستجوی آدرس', href: `https://www.google.com/maps/search/?api=1&query=${q}` });
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address || '');
      triggerToast('success', 'آدرس کپی شد؛ در نشان یا بلد بچسبانید.');
    } catch {
      triggerToast('warning', 'کپی نشد؛ آدرس را از کارت بخوانید.');
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="مسیریابی" subtitle={title} size="sm">
      <div className="space-y-3">
        {address && (
          <div className="text-sm text-ink bg-sunken border border-line rounded-lg p-3 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
            <span className="leading-6">{address}</span>
          </div>
        )}
        {!link && (
          <p className="text-[12px] text-amber-700 dark:text-amber-300">
            برای این پروژه لینک لوکیشن ثبت نشده؛ مسیریابی بر اساس متن آدرس است.
          </p>
        )}
        <div className="space-y-2">
          {options.map((o, i) => (
            <a
              key={o.href}
              href={o.href}
              target={o.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              onClick={() => setTimeout(onClose, 300)}
              className={`flex items-center justify-between gap-3 p-3 rounded-lg border min-h-[52px] transition ${
                i === 0 ? 'bg-brand text-on-brand border-brand font-black' : 'bg-raised border-line-strong text-ink hover:bg-hover font-bold'
              }`}
            >
              <span className="flex items-center gap-2 text-sm">
                <Navigation className="w-4 h-4 shrink-0" />
                <span>{o.label}</span>
              </span>
              <span className={`text-[11px] ${i === 0 ? 'opacity-80' : 'text-ink-3'} flex items-center gap-1`}>
                {o.hint}
                <ExternalLink className="w-3 h-3" />
              </span>
            </a>
          ))}
          {address && (
            <button
              type="button"
              onClick={copyAddress}
              className="w-full flex items-center gap-2 p-3 rounded-lg border border-line bg-canvas text-ink-2 hover:text-ink text-sm font-bold min-h-[48px] cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              کپی آدرس
            </button>
          )}
          {options.length === 0 && !address && (
            <p className="text-sm text-ink-2">نه آدرس و نه لینک لوکیشن برای این پروژه ثبت نشده است.</p>
          )}
        </div>
      </div>
    </Sheet>
  );
};
