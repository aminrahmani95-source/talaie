import { describe, it, expect } from 'vitest';
import { bookingToRow, rowToBooking, mergeServerBookings } from '../salesBookingSync';
import type { SalesProjectBooking } from '../../types';

const makeBooking = (id: string, overrides: Partial<SalesProjectBooking> = {}): SalesProjectBooking => ({
  id,
  customerName: `مشتری ${id}`,
  customerPhone: '09120000000',
  address: 'تهران',
  lathsCount: 12,
  isSmart: true,
  notes: '',
  requestedDate: '2026-12-01',
  jalaliDate: '1405/09/10',
  allocationMode: 'SPREAD_DAILY',
  allocatedTeams: ['TEAM_1'],
  allocatedDaysCount: 1,
  salesRepId: 'rep-1',
  salesRepName: 'کارشناس ۱',
  createdAt: '2026-11-20T10:00:00.000Z',
  ...overrides,
});

describe('Sales booking server sync', () => {
  it('round-trips a booking through the database row format without losing fields', () => {
    const booking = makeBooking('b1', {
      convertedToProjectId: 'p-1',
      scheduledInstallationDate: '2026-12-03',
      assignedInstallationTeamId: 'TEAM_2',
      daysDetails: [{ date: '2026-12-01', jalaliDate: '1405/09/10', teams: [{ teamId: 'TEAM_1', teamName: 'اکیپ ۱', laths: 12 }] }],
    });
    const row = bookingToRow(booking);
    expect(row.sales_rep_id).toBe('rep-1');
    expect(row.laths_count).toBe(12);
    expect(rowToBooking(row)).toEqual(booking);
  });

  it('prefers table columns over the JSON copy when they disagree', () => {
    const row = bookingToRow(makeBooking('b1'));
    row.laths_count = 30; // e.g. edited by an admin directly in the DB
    expect(rowToBooking(row).lathsCount).toBe(30);
  });

  it('server is the source of truth, except for local changes that are still pending upload', () => {
    const server = [makeBooking('a', { notes: 'server' }), makeBooking('b', { notes: 'server' })];
    const local = [makeBooking('a', { notes: 'local-unsent' }), makeBooking('b', { notes: 'stale-local' }), makeBooking('c')];
    const merged = mergeServerBookings(server, local, { upserts: ['a', 'c'], deletes: [] });
    const byId = Object.fromEntries(merged.map((m) => [m.id, m.notes]));
    expect(byId).toEqual({ a: 'local-unsent', b: 'server', c: '' });
  });

  it('drops bookings deleted locally but not yet deleted on the server', () => {
    const merged = mergeServerBookings([makeBooking('a'), makeBooking('b')], [], { upserts: [], deletes: ['a'] });
    expect(merged.map((m) => m.id)).toEqual(['b']);
  });

  it('drops local bookings that were removed on the server by another device', () => {
    const merged = mergeServerBookings([makeBooking('a')], [makeBooking('a'), makeBooking('gone')], { upserts: [], deletes: [] });
    expect(merged.map((m) => m.id)).toEqual(['a']);
  });
});
