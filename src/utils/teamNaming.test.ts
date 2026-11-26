import { describe, expect, it } from 'vitest';
import { defaultTeamName, nextTeamCode } from './teamNaming';

describe('teamNaming', () => {
  it('names TEAM_n teams with Latin digits', () => {
    expect(defaultTeamName('TEAM_3')).toBe('اکیپ نصب 3');
    expect(defaultTeamName('TEAM_12')).toBe('اکیپ نصب 12');
  });
  it('keeps unknown codes visible', () => {
    expect(defaultTeamName('NORTH')).toBe('اکیپ نصب (NORTH)');
    expect(defaultTeamName(undefined)).toBe('اکیپ نصب');
  });
  it('reuses the smallest free code', () => {
    expect(nextTeamCode([])).toBe('TEAM_1');
    expect(nextTeamCode([{ code: 'TEAM_1' }, { code: 'TEAM_2' }])).toBe('TEAM_3');
    expect(nextTeamCode([{ code: 'TEAM_1' }, { code: 'TEAM_3' }])).toBe('TEAM_2');
  });
});
