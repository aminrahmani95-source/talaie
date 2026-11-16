import { Ticket, IssueCategory, SlaStatus } from '../types';

export const SLA_HOURS_LIMIT = 72;
export const SLA_MS_LIMIT = SLA_HOURS_LIMIT * 60 * 60 * 1000;

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  MEASUREMENT_ERROR: '1. مغایرت ابعاد یا خطای اندازه‌گیری اولیه',
  MEASUREMENT_RECORD_ERROR: '2. خطا در جابه‌جایی یا ثبت مشخصات اندازه‌گیری',
  PRODUCTION_DEFECT: '3. نقص، دوخت ناصحیح یا کسری تولید',
  WAREHOUSE_DELIVERY_ISSUE: '4. کسری یا اشتباه در تحویل و بسته‌بندی انبار',
  TRANSIT_DAMAGE: '5. آسیب حین بارگیری، حمل یا ترانزیت',
  SITE_NOT_READY: '6. عدم آمادگی بستر ساختمان، کناف یا برق',
  EQUIPMENT_DEFECT: '7. کسری، نقص یا خرابی تجهیزات، یراق و ابزار',
  OTHER: '8. سایر موارد عملیاتی',
};

export const SLA_STATUS_LABELS: Record<SlaStatus, { label: string; badgeCls: string; textColor: string }> = {
  OPEN_IN_SLA: {
    label: 'در جریان (زیر 72 ساعت)',
    badgeCls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  OPEN_OVERDUE: {
    label: 'بحرانی (عبور از 72 ساعت)',
    badgeCls: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40 animate-pulse',
    textColor: 'text-rose-600 dark:text-rose-400',
  },
  RESOLVED_IN_SLA: {
    label: 'حل در موعد مقرر',
    badgeCls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
  RESOLVED_OVERDUE: {
    label: 'حل با تاخیر',
    badgeCls: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
    textColor: 'text-purple-600 dark:text-purple-400',
  },
};

/**
 * Calculates deadline timestamp (exact ISO) based on creation time + 72 hours
 */
export function getSlaDeadline(createdAt: string): string {
  const createdMs = new Date(createdAt).getTime();
  return new Date(createdMs + SLA_MS_LIMIT).toISOString();
}

/**
 * Determines exact SLA state for any ticket:
 * 1. OPEN_IN_SLA: Still open, under 72h
 * 2. OPEN_OVERDUE: Still open, exceeded 72h
 * 3. RESOLVED_IN_SLA: Resolved within 72h from creation
 * 4. RESOLVED_OVERDUE: Resolved after 72h from creation
 */
export function getTicketSlaStatus(ticket: Ticket, nowMs: number = Date.now()): SlaStatus {
  const createdMs = new Date(ticket.createdAt).getTime();
  const deadlineMs = createdMs + SLA_MS_LIMIT;

  if (ticket.status === 'RESOLVED') {
    const resolvedMs = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : nowMs;
    return resolvedMs <= deadlineMs ? 'RESOLVED_IN_SLA' : 'RESOLVED_OVERDUE';
  }

  // Open ticket
  return nowMs <= deadlineMs ? 'OPEN_IN_SLA' : 'OPEN_OVERDUE';
}

/**
 * Remaining hours until 72h deadline (positive = remaining, negative = overdue)
 */
export function getRemainingSlaHours(ticket: Ticket, nowMs: number = Date.now()): number {
  const createdMs = new Date(ticket.createdAt).getTime();
  const deadlineMs = createdMs + SLA_MS_LIMIT;
  const compareMs = ticket.status === 'RESOLVED' && ticket.resolvedAt
    ? new Date(ticket.resolvedAt).getTime()
    : nowMs;

  const diffHours = (deadlineMs - compareMs) / (1000 * 60 * 60);
  return Number(diffHours.toFixed(1));
}

/**
 * Total elapsed hours between ticket creation and resolution (or current time)
 */
export function getElapsedHours(ticket: Ticket, nowMs: number = Date.now()): number {
  const createdMs = new Date(ticket.createdAt).getTime();
  const endMs = ticket.status === 'RESOLVED' && ticket.resolvedAt
    ? new Date(ticket.resolvedAt).getTime()
    : nowMs;

  return Math.max(0, Number(((endMs - createdMs) / (1000 * 60 * 60)).toFixed(1)));
}

export interface SlaMetricsSummary {
  totalTickets: number;
  openCount: number;
  openInSla: number;
  openOverdue: number;
  resolvedCount: number;
  resolvedInSla: number;
  resolvedOverdue: number;
  onTimeRate: number; // درصد رعایت مهلت استاندارد 72 ساعته
  averageResolutionHours: number; // میانگین زمان حل به ساعت
  breakdownByCategory: Record<string, { total: number; resolvedInSla: number; overdue: number }>;
  breakdownByTeam: Record<string, { teamName: string; total: number; overdue: number; onTimeRate: number }>;
}

/**
 * Computes enterprise SLA metrics according to Master Project Brief rules:
 * - Open overdue incidents must count as overdue in compliance calculation.
 * - Does not calculate compliance using resolved incidents only.
 * - Formula: (resolvedInSla) / (total accountable: resolvedInSla + resolvedOverdue + openOverdue) * 100
 */
export function computeSlaMetrics(tickets: Ticket[], nowMs: number = Date.now()): SlaMetricsSummary {
  let openInSla = 0;
  let openOverdue = 0;
  let resolvedInSla = 0;
  let resolvedOverdue = 0;

  let totalResolutionDurationHours = 0;
  let resolvedWithDurationCount = 0;

  const breakdownByCategory: Record<string, { total: number; resolvedInSla: number; overdue: number }> = {};
  const breakdownByTeam: Record<string, { teamName: string; total: number; overdue: number; onTimeRate: number }> = {};

  for (const t of tickets) {
    const sla = getTicketSlaStatus(t, nowMs);
    const categoryKey = t.category || t.type || 'OTHER';
    const teamId = t.assignedTeamId || 'UNASSIGNED';
    const teamName = t.assignedTeamName || (teamId === 'UNASSIGNED' ? 'تخصیص‌نیافته' : 'نامشخص');

    // Category breakdown
    if (!breakdownByCategory[categoryKey]) {
      breakdownByCategory[categoryKey] = { total: 0, resolvedInSla: 0, overdue: 0 };
    }
    breakdownByCategory[categoryKey].total += 1;

    // Team breakdown
    if (!breakdownByTeam[teamId]) {
      breakdownByTeam[teamId] = { teamName, total: 0, overdue: 0, onTimeRate: 100 };
    }
    breakdownByTeam[teamId].total += 1;

    if (sla === 'OPEN_IN_SLA') {
      openInSla += 1;
    } else if (sla === 'OPEN_OVERDUE') {
      openOverdue += 1;
      breakdownByCategory[categoryKey].overdue += 1;
      breakdownByTeam[teamId].overdue += 1;
    } else if (sla === 'RESOLVED_IN_SLA') {
      resolvedInSla += 1;
      breakdownByCategory[categoryKey].resolvedInSla += 1;
      const duration = getElapsedHours(t, nowMs);
      totalResolutionDurationHours += duration;
      resolvedWithDurationCount += 1;
    } else if (sla === 'RESOLVED_OVERDUE') {
      resolvedOverdue += 1;
      breakdownByCategory[categoryKey].overdue += 1;
      breakdownByTeam[teamId].overdue += 1;
      const duration = getElapsedHours(t, nowMs);
      totalResolutionDurationHours += duration;
      resolvedWithDurationCount += 1;
    }
  }

  // Accountable total for compliance: all tickets that reached resolution or are already overdue
  const accountableTotal = resolvedInSla + resolvedOverdue + openOverdue;
  const onTimeRate = accountableTotal > 0
    ? Math.round((resolvedInSla / accountableTotal) * 100)
    : 100;

  const averageResolutionHours = resolvedWithDurationCount > 0
    ? Number((totalResolutionDurationHours / resolvedWithDurationCount).toFixed(1))
    : 0;

  // Calculate each team's onTimeRate
  for (const teamId of Object.keys(breakdownByTeam)) {
    const item = breakdownByTeam[teamId];
    item.onTimeRate = item.total > 0
      ? Math.max(0, Math.round(((item.total - item.overdue) / item.total) * 100))
      : 100;
  }

  return {
    totalTickets: tickets.length,
    openCount: openInSla + openOverdue,
    openInSla,
    openOverdue,
    resolvedCount: resolvedInSla + resolvedOverdue,
    resolvedInSla,
    resolvedOverdue,
    onTimeRate,
    averageResolutionHours,
    breakdownByCategory,
    breakdownByTeam,
  };
}
