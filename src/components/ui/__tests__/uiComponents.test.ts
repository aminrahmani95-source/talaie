import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Avatar } from '../Avatar';
import { StatusPill } from '../StatusPill';
import { SegmentedControl } from '../SegmentedControl';
import { Button } from '../Button';

describe('Shared UI Components', () => {
  describe('Avatar', () => {
    it('extracts correct Persian initials from single and multi-word names', () => {
      const html1 = renderToString(createElement(Avatar, { name: 'امین رحمانی' }));
      expect(html1).toContain('ار');

      const html2 = renderToString(createElement(Avatar, { name: 'فرخ نقدعلیان (سرپرست اکیپ)' }));
      expect(html2).toContain('فن');

      const html3 = renderToString(createElement(Avatar, { name: 'محسن' }));
      expect(html3).toContain('م');
    });

    it('handles empty name with fallback', () => {
      const html = renderToString(createElement(Avatar, { name: '' }));
      expect(html).toContain('؟');
    });
  });

  describe('StatusPill', () => {
    it('renders correct labels for project statuses', () => {
      const scheduled = renderToString(createElement(StatusPill, { status: 'SCHEDULED' }));
      expect(scheduled).toContain('برنامه‌ریزی‌شده');

      const enRoute = renderToString(createElement(StatusPill, { status: 'EN_ROUTE' }));
      expect(enRoute).toContain('در مسیر');

      const inProgress = renderToString(createElement(StatusPill, { status: 'IN_PROGRESS' }));
      expect(inProgress).toContain('در حال نصب');

      const stuck = renderToString(createElement(StatusPill, { status: 'STUCK' }));
      expect(stuck).toContain('متوقف');

      const completed = renderToString(createElement(StatusPill, { status: 'COMPLETED' }));
      expect(completed).toContain('اتمام نصب');
    });

    it('renders correct labels for QC statuses', () => {
      const pending = renderToString(createElement(StatusPill, { qcStatus: 'PENDING' }));
      expect(pending).toContain('در انتظار QC');

      const approved = renderToString(createElement(StatusPill, { qcStatus: 'APPROVED' }));
      expect(approved).toContain('تایید QC');

      const rejected = renderToString(createElement(StatusPill, { qcStatus: 'REJECTED' }));
      expect(rejected).toContain('نیاز به اصلاح');
    });
  });

  describe('SegmentedControl', () => {
    it('renders options and indicates aria-selected on active option', () => {
      const options = [
        { value: 'ALL', label: 'همه', count: 5 },
        { value: 'OPEN', label: 'باز', count: 2 },
      ];
      const html = renderToString(
        createElement(SegmentedControl, {
          options,
          value: 'OPEN',
          onChange: () => {},
        })
      );
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('همه');
      expect(html).toContain('باز');
      expect(html).toContain('5');
      expect(html).toContain('2');
    });
  });

  describe('Button', () => {
    it('renders button with children and minimum touch target size class', () => {
      const html = renderToString(
        createElement(Button, { variant: 'primary', size: 'md' }, 'تایید و ادامه')
      );
      expect(html).toContain('تایید و ادامه');
      expect(html).toContain('min-h-[44px]');
    });
  });
});
