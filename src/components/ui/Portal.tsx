import React from 'react';
import { createPortal } from 'react-dom';

/**
 * پنجره‌های تمام‌صفحه را به انتهای <body> می‌برد. داخل <main> (که container-query دارد) یا زیر یک
 * Sheet، لایه‌ی fixed یا در کادر والد گیر می‌کرد یا پشت Sheet می‌ماند (مثل «رد بازرسی» در QC).
 */
export const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? <>{children}</> : createPortal(children, document.body);
