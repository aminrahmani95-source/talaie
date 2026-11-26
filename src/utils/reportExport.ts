/** خروجی مشترک گزارش‌ها: CSV فارسی برای اکسل و چاپ / PDF بدون پنجره‌ی جدید */

const csvCell = (v: unknown) => {
  const str = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

/** CSV با BOM تا اکسل حروف فارسی را درست نشان دهد */
export function buildCsv(header: string[], rows: unknown[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function downloadCsv(fileBaseName: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBaseName.replace(/[\\/:*?"<>|\s]+/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface PrintSection {
  title?: string;
  /** خطوط خلاصه (متن ساده) */
  lines?: string[];
  table?: { headers: string[]; rows: string[][] };
}

/**
 * چاپ در iframe پنهان (در اپ نصب‌شده روی گوشی هم کار می‌کند، برخلاف window.open).
 * در پنجره‌ی چاپ می‌توان «ذخیره به PDF» را انتخاب کرد. اگر نشد false برمی‌گرداند.
 */
export function printHtmlReport(title: string, subtitle: string, sections: PrintSection[]): boolean {
  const body = sections
    .map((s) => {
      const parts: string[] = [];
      if (s.title) parts.push(`<h2>${escapeHtml(s.title)}</h2>`);
      if (s.lines?.length) parts.push(`<ul>${s.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`);
      if (s.table) {
        const head = s.table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
        const rows = s.table.rows.length
          ? s.table.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${s.table.headers.length}">موردی نیست</td></tr>`;
        parts.push(`<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`);
      }
      return parts.join('');
    })
    .join('');
  const html = `<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Vazirmatn,Tahoma,sans-serif;margin:16px;color:#111;font-size:11px}
    h1{font-size:16px;margin:0 0 4px} h2{font-size:13px;margin:14px 0 6px} p{margin:0 0 10px;color:#555}
    ul{margin:0 0 10px;padding-right:18px} li{margin:2px 0}
    table{width:100%;border-collapse:collapse;margin-bottom:8px} th,td{border:1px solid #bbb;padding:4px 6px;text-align:right;vertical-align:top}
    th{background:#eee} tr{page-break-inside:avoid}
  </style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p>${body}</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 2000);
    }
  }, 300);
  return true;
}
