import { describe, expect, it } from 'vitest';
import { daysBetween, holidayName, holidaysOfYear, upcomingHolidays } from './holidays';
import { garbageOn, hourlyIndex, nextAnniversary, wifiQrPayload } from './utils';

describe('holidays', () => {
  it('computes 2026 holidays including substitute and citizens holidays', () => {
    const map = Object.fromEntries(holidaysOfYear(2026).map((h) => [h.date, h.name]));
    expect(map['2026-01-01']).toBe('元日');
    expect(map['2026-01-12']).toBe('成人の日');
    expect(map['2026-03-20']).toBe('春分の日');
    expect(map['2026-05-06']).toBe('振替休日');
    expect(map['2026-07-20']).toBe('海の日');
    expect(map['2026-09-21']).toBe('敬老の日');
    expect(map['2026-09-22']).toBe('国民の休日');
    expect(map['2026-09-23']).toBe('秋分の日');
    expect(map['2026-10-12']).toBe('スポーツの日');
    expect(map['2026-11-23']).toBe('勤労感謝の日');
    expect(holidaysOfYear(2026)).toHaveLength(18);
  });

  it('computes 2027 holidays', () => {
    const map = Object.fromEntries(holidaysOfYear(2027).map((h) => [h.date, h.name]));
    expect(map['2027-03-21']).toBe('春分の日');
    expect(map['2027-03-22']).toBe('振替休日');
    expect(map['2027-09-23']).toBe('秋分の日');
  });

  it('finds the next holiday', () => {
    const next = upcomingHolidays(new Date(2026, 10, 22), 2);
    expect(next[0]).toEqual({ date: '2026-11-23', name: '勤労感謝の日' });
    expect(next[1].date).toBe('2027-01-01');
    expect(holidayName(new Date(2026, 10, 23))).toBe('勤労感謝の日');
    expect(daysBetween('2026-11-22', '2027-01-01')).toBe(40);
  });
});

describe('wifi qr', () => {
  it('escapes special characters', () => {
    expect(wifiQrPayload('My;Net', 'pa:ss"', 'WPA', false)).toBe('WIFI:T:WPA;S:My\\;Net;P:pa\\:ss\\";;');
    expect(wifiQrPayload('Open', 'ignored', 'nopass', true)).toBe('WIFI:T:nopass;S:Open;H:true;;');
  });
});

describe('garbage', () => {
  const rules = [
    { id: 'a', name: '燃える', icon: '', color: '', weekdays: [1, 4], nths: [] },
    { id: 'b', name: '缶', icon: '', color: '', weekdays: [5], nths: [2, 4] },
  ];
  it('matches weekly and nth-week rules', () => {
    expect(garbageOn(new Date(2026, 10, 23), rules).map((r) => r.id)).toEqual(['a']); // 月曜
    expect(garbageOn(new Date(2026, 10, 13), rules).map((r) => r.id)).toEqual(['b']); // 第2金曜
    expect(garbageOn(new Date(2026, 10, 6), rules)).toEqual([]); // 第1金曜
  });
});

describe('hourly quiz rotation', () => {
  it('changes every hour and covers all items in one cycle', () => {
    const base = Date.UTC(2026, 0, 1);
    const seen = new Set<number>();
    for (let h = 0; h < 100; h++) seen.add(hourlyIndex(base + h * 3600_000 - 9 * 3600_000 + 1000, 100).index);
    expect(seen.size).toBeGreaterThan(60);
    const a = hourlyIndex(base, 100);
    expect(a.nextChangeAt).toBeGreaterThan(base);
    expect(hourlyIndex(base + 1000, 100).index).toBe(a.index);
  });
});

describe('anniversaries (year input)', () => {
  it('treats blank or incomplete years as yearly events without age', () => {
    const today = new Date(2026, 10, 22);
    expect(nextAnniversary({ id: 'a', name: 'x', date: '0000-12-25', kind: 'birthday', icon: '' }, today)).toMatchObject({ date: '2026-12-25', years: null });
    expect(nextAnniversary({ id: 'b', name: 'x', date: '0020-12-25', kind: 'birthday', icon: '' }, today)).toMatchObject({ years: null });
    expect(nextAnniversary({ id: 'c', name: 'x', date: '2015-04-01', kind: 'anniversary', icon: '' }, today)).toMatchObject({ date: '2027-04-01', years: 12 });
  });
});

describe('anniversaries', () => {
  it('computes the next birthday and age', () => {
    const r = nextAnniversary({ id: 'x', name: '太郎', date: '2020-11-25', kind: 'birthday', icon: '' }, new Date(2026, 10, 22));
    expect(r).toMatchObject({ date: '2026-11-25', daysLeft: 3, years: 6 });
    const past = nextAnniversary({ id: 'y', name: '花子', date: '2019-01-05', kind: 'birthday', icon: '' }, new Date(2026, 10, 22));
    expect(past).toMatchObject({ date: '2027-01-05', years: 8 });
  });
});
