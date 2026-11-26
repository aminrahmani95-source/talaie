import type { InstallationTeam } from '../types';

// ارقام برنامه لاتین است (تصمیم سپهر)
const toPersianDigits = (n: number) => String(n);

/** «اکیپ نصب 3» for TEAM_3; anything else keeps its code visible. */
export function defaultTeamName(code?: string | null): string {
  const m = /^TEAM_(\d+)$/.exec(String(code || '').trim());
  if (m) return `اکیپ نصب ${toPersianDigits(Number(m[1]))}`;
  return code ? `اکیپ نصب (${code})` : 'اکیپ نصب';
}

/** Smallest free TEAM_n code, so a deleted team's number is reused. */
export function nextTeamCode(teams: Pick<InstallationTeam, 'code'>[]): string {
  const used = new Set(teams.map((t) => String(t.code || '').trim()));
  let n = 1;
  while (used.has(`TEAM_${n}`)) n++;
  return `TEAM_${n}`;
}
