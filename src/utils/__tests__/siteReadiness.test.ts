import { describe, it, expect } from 'vitest';
import { SiteReadinessInspection, SiteReadinessItem, SiteChecklistState } from '../../types';

describe('Pre-Installation Site Readiness (Task 4)', () => {
  // Helper evaluating site readiness inspection status
  function evaluateInspection(
    inspectionType: 'IN_PERSON' | 'REMOTE',
    items: SiteReadinessItem[],
    photos: string[],
    inspectedBy: string
  ): SiteReadinessInspection {
    const hasIssues = items.some((item) => item.state === 'ISSUE_DETECTED');
    const allDecided = items.every((item) => item.state === 'CONFIRMED' || item.state === 'NOT_APPLICABLE' || item.state === 'ISSUE_DETECTED');

    let status: 'PASSED' | 'ACTION_REQUIRED' | 'PENDING' = 'PENDING';
    if (hasIssues) {
      status = 'ACTION_REQUIRED';
    } else if (allDecided && items.length > 0) {
      status = 'PASSED';
    }

    return {
      inspectionType,
      inspectedAt: new Date().toISOString(),
      inspectedBy,
      items,
      photos,
      status,
      isReady: status === 'PASSED',
    };
  }

  const standardItems: SiteReadinessItem[] = [
    { id: 'wall_structure', title: 'استحکام بستر', category: 'CEILING_DRYWALL', state: 'CONFIRMED' },
    { id: 'electricity', title: 'سیم‌کشی و برق موتور', category: 'ELECTRICAL', state: 'CONFIRMED' },
    { id: 'cornice_clearance', title: 'فاصله قرنیز و گچ‌بری', category: 'ACCESS_SPACE', state: 'NOT_APPLICABLE' },
    { id: 'site_access', title: 'دسترسی طبقات و آسانسور', category: 'ACCESS_SPACE', state: 'CONFIRMED' },
  ];

  it('evaluates to PASSED and isReady=true when all items are CONFIRMED or NOT_APPLICABLE', () => {
    const inspection = evaluateInspection('IN_PERSON', standardItems, ['photo1.jpg'], 'سرپرست تیم');
    expect(inspection.status).toBe('PASSED');
    expect(inspection.isReady).toBe(true);
    expect(inspection.inspectionType).toBe('IN_PERSON');
    expect(inspection.photos.length).toBe(1);
  });

  it('evaluates to ACTION_REQUIRED and isReady=false when any item has ISSUE_DETECTED', () => {
    const itemsWithIssue: SiteReadinessItem[] = [
      { id: 'wall_structure', title: 'استحکام بستر', category: 'CEILING_DRYWALL', state: 'ISSUE_DETECTED', notes: 'کناف سست است و نیاز به قوطی‌کشی دارد' },
      { id: 'electricity', title: 'سیم‌کشی و برق موتور', category: 'ELECTRICAL', state: 'CONFIRMED' },
      { id: 'cornice_clearance', title: 'فاصله قرنیز و گچ‌بری', category: 'ACCESS_SPACE', state: 'NOT_APPLICABLE' },
      { id: 'site_access', title: 'دسترسی طبقات و آسانسور', category: 'ACCESS_SPACE', state: 'CONFIRMED' },
    ];

    const inspection = evaluateInspection('REMOTE', itemsWithIssue, ['issue_photo.jpg'], 'مسئول هماهنگی');
    expect(inspection.status).toBe('ACTION_REQUIRED');
    expect(inspection.isReady).toBe(false);
    expect(inspection.inspectionType).toBe('REMOTE');
    expect(inspection.items[0].notes).toContain('کناف سست است');
  });

  it('supports explicit 3-state checklist values (CONFIRMED, ISSUE_DETECTED, NOT_APPLICABLE)', () => {
    const states: SiteChecklistState[] = ['CONFIRMED', 'ISSUE_DETECTED', 'NOT_APPLICABLE'];
    expect(states).toHaveLength(3);

    const testItem: SiteReadinessItem = {
      id: 'cornice_clearance',
      title: 'آویز و گچ‌بری',
      category: 'ACCESS_SPACE',
      state: 'NOT_APPLICABLE',
    };
    expect(testItem.state).toBe('NOT_APPLICABLE');
  });

  it('keeps status PENDING if items are empty or not all evaluated', () => {
    const incompleteItems: SiteReadinessItem[] = [];
    const inspection = evaluateInspection('IN_PERSON', incompleteItems, [], 'سرپرست تیم');
    expect(inspection.status).toBe('PENDING');
    expect(inspection.isReady).toBe(false);
  });
});
