import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import type { Project } from '../types';
import { buildProjectReport, summarizeReport } from './projectsReport';
import { buildProjectsWorkbook, buildWarehouseWorkbook } from './xlsxReports';
import { buildWarehouseHistory, summarizeHistory } from './warehouseHistory';
import { buildWarehousePatch } from './warehouseStatus';

const p = (over: Partial<Project>): Project =>
  ({
    id: Math.random().toString(36).slice(2),
    code: 'PRJ-1',
    title: 'ولنجک',
    status: 'SCHEDULED',
    qcStatus: 'NOT_STARTED',
    shadePanels: 10,
    railCount: 2,
    curtainPanels: 0,
    assignedTeamId: 'T1',
    assignedTeamName: 'اکیپ 1',
    address: 'پلاک ۱۲',
    ...over,
  }) as Project;

describe('excel reports', () => {
  it('builds a multi-sheet RTL projects workbook with formulas and Latin digits', async () => {
    const projects = [
      p({ code: 'PRJ-1', status: 'COMPLETED', scheduledDate: '2026-11-22', completedAt: '2026-11-22T14:00:00', qcStatus: 'APPROVED', qcScore: 5 }),
      p({ code: 'PRJ-2', status: 'STUCK', scheduledDate: '2026-11-23', stuckIncidents: [{ id: 's', stuckAt: '2026-11-23T08:00:00', category: 'FABRIC_SHORTAGE', description: 'کم', resolutionStatus: 'OPEN', targetMaxHours: 72 } as any] }),
      p({ code: 'PRJ-3', scheduledDate: '2026-11-26', assignedTeamId: 'T2', assignedTeamName: 'اکیپ 2' }),
    ];
    const rows = buildProjectReport(projects, { from: '2026-11-22', to: '2026-11-28' });
    const wb = buildProjectsWorkbook(ExcelJS, { title: 'گزارش هفتگی', rangeLabel: '7 روز', from: '2026-11-22', to: '2026-11-28', rows, summary: summarizeReport(rows) });
    expect(wb.worksheets.map((w) => w.name)).toEqual(['خلاصه', 'اکیپ‌ها', 'پروژه‌ها', 'توقف‌ها', 'روزبه‌روز', 'هفته‌به‌هفته']);
    expect(wb.worksheets[2].views[0].rightToLeft).toBe(true);

    const buf = await wb.xlsx.writeBuffer();
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buf as ArrayBuffer);
    const list = back.getWorksheet('پروژه‌ها')!;
    expect(list.getCell('A2').value).toBe('PRJ-3');
    expect(String(list.getCell('E2').value)).toBe('پلاک 12');
    const totals = list.getRow(5);
    expect((totals.getCell(12).value as any).formula).toBe('SUM(L2:L4)');
    const days = back.getWorksheet('روزبه‌روز')!;
    expect(days.rowCount).toBe(1 + 7 + 1);
    const stuck = back.getWorksheet('توقف‌ها')!;
    expect(stuck.getCell('F2').value).toBe('کسری پارچه');
  });

  it('builds the warehouse workbook with material item lines', async () => {
    let pr = p({ technicalHandover: { isHandoverComplete: false, warehouseConfirmation: { confirmed: false } } });
    pr = { ...pr, ...buildWarehousePatch(pr, { kind: 'RECEIPT' }, { id: 'w', name: 'انبار' }, 'انبار', '2026-11-24T08:00:00.000Z') } as Project;
    pr = { ...pr, ...buildWarehousePatch(pr, { kind: 'HAND_OVER', via: 'WAREHOUSE', toName: 'سجاد' }, { id: 'w', name: 'انبار' }, 'انبار', '2026-11-25T08:00:00.000Z') } as Project;
    const req = {
      id: 'm', projectId: pr.id, projectCode: 'PRJ-1', projectTitle: 'ولنجک', items: [{ id: 'i', title: 'براکت', requestedQty: 4, unit: 'عدد' }],
      dispatches: [{ id: 'd', dispatchedAt: '2026-11-25T10:00:00.000Z', courierInfo: 'اسنپ', items: [{ itemId: 'i', dispatchedQty: 4 }], receivedAtSiteConfirmed: true }],
    } as any;
    const events = buildWarehouseHistory([pr], [req], []);
    const wb = buildWarehouseWorkbook(ExcelJS, { title: 'انبار', rangeLabel: 'همه', events, summary: summarizeHistory(events) });
    expect(wb.worksheets.map((w) => w.name)).toEqual(['خلاصه', 'رویدادها', 'اقلام متریال', 'تحویل به اکیپ‌ها']);
    const items = wb.getWorksheet('اقلام متریال')!;
    expect(items.getCell('E2').value).toBe('براکت');
    expect(items.getCell('F2').value).toBe(4);
    const teams = wb.getWorksheet('تحویل به اکیپ‌ها')!;
    expect(teams.getCell('A2').value).toBe('اکیپ 1');
    await wb.xlsx.writeBuffer();
  });
});
