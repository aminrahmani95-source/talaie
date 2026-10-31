import { describe, it, expect } from 'vitest';
import { getDisplayName } from '../../components/admin/TechniciansManager';

describe('Technician name helpers', () => {
  it('strips role suffix in parentheses for display and storage', () => {
    expect(getDisplayName('امین رحمانی (مسئول QC)')).toBe('امین رحمانی');
    expect(getDisplayName('فرخ نقدعلیان (سرپرست اکیپ)')).toBe('فرخ نقدعلیان');
    expect(getDisplayName('محسن رضایی (تکنسین نصب)')).toBe('محسن رضایی');
    expect(getDisplayName('علی کریمی')).toBe('علی کریمی');
    expect(getDisplayName('')).toBe('');
    expect(getDisplayName(undefined)).toBe('');
  });
});
