import { useEffect, useRef } from 'react';

/**
 * Open dialogs register here in the order they open. Escape only closes the
 * top one, so a dialog opened over another dialog (or over a Sheet) doesn't
 * close both at once.
 */
const stack: Array<{ current: () => void }> = [];
let listening = false;

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || stack.length === 0) return;
  e.preventDefault();
  stack[stack.length - 1].current();
}

/** بستن پنجره با کلید Escape (فقط وقتی active=true است) */
export function useEscapeKey(onEscape: () => void, active = true) {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const entry = handler;
    stack.push(entry);
    if (!listening && typeof window !== 'undefined') {
      window.addEventListener('keydown', onKeyDown);
      listening = true;
    }
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0 && listening) {
        window.removeEventListener('keydown', onKeyDown);
        listening = false;
      }
    };
  }, [active]);
}
