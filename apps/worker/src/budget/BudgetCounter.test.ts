import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeCtx, FakeStorage } from '../../test/fakes.js';
import { BudgetCounter, type ReserveRequest } from './BudgetCounter.js';

/** 2026-09-18 00:00 KST */
const DAY_START = Date.parse('2026-09-17T15:00:00Z');
const HOUR = 3_600_000;

let storage: FakeStorage;
let budget: BudgetCounter;
let n = 0;

const req = (over: Partial<ReserveRequest> = {}): ReserveRequest => ({
  kind: 'route',
  sessionId: `s${n++}`,
  units: 1,
  mode: 'auto',
  ...over,
});

/** 시간당·세션 한도를 피해 가며 count건 예약한다. 매 시간 경로 1,000건·장소 7,000건씩. */
async function fill(kind: 'route' | 'places', count: number, startHour = 0) {
  let hour = startHour;
  let left = count;
  while (left > 0) {
    vi.setSystemTime(DAY_START + hour * HOUR);
    const batch = Math.min(left, kind === 'route' ? 1_000 : 7_000);
    for (let i = 0; i < batch; i++) {
      const r = await budget.reserve(req({ kind }));
      if (!r.ok) throw new Error(`예약 실패 ${JSON.stringify(r)}`);
    }
    left -= batch;
    hour += 1;
  }
  return hour;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(DAY_START + 10 * HOUR);
  storage = new FakeStorage();
  budget = new BudgetCounter(fakeCtx(storage), {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('⑥ 일일 예산 (Durable Object)', () => {
  it('카카오 경로 9,000번째까지 카카오, 9,001번째는 TMAP, TMAP 900 뒤에는 거절', async () => {
    const nextHour = await fill('route', 9_000);
    vi.setSystemTime(DAY_START + nextHour * HOUR);
    expect(await budget.reserve(req())).toEqual({ ok: true, provider: 'tmap' });
    for (let i = 1; i < 900; i++) {
      expect((await budget.reserve(req())).ok).toBe(true);
    }
    expect(await budget.reserve(req())).toEqual({ ok: false, reason: 'budget' });
    const stats = await budget.stats();
    expect(stats.counts.kakao_route).toBe(9_000);
    expect(stats.counts.tmap_route).toBe(900);
  });

  it('장소는 카카오 50,000 / TMAP 18,000', async () => {
    const nextHour = await fill('places', 50_000);
    vi.setSystemTime(DAY_START + nextHour * HOUR);
    expect(await budget.reserve(req({ kind: 'places' }))).toEqual({ ok: true, provider: 'tmap' });
  });

  it('구간 N개 요청은 N건. 남은 건수보다 크면 다음 제공자로', async () => {
    await fill('route', 8_998);
    vi.setSystemTime(DAY_START + 20 * HOUR);
    expect(await budget.reserve(req({ units: 3 }))).toEqual({ ok: true, provider: 'tmap' });
    expect(await budget.reserve(req({ units: 2 }))).toEqual({ ok: true, provider: 'kakao' });
  });

  it('시간당 경로 1,500건, 다음 시에는 다시 열린다', async () => {
    for (let i = 0; i < 1_500; i++) expect((await budget.reserve(req())).ok).toBe(true);
    expect(await budget.reserve(req())).toEqual({ ok: false, reason: 'budget' });
    vi.setSystemTime(DAY_START + 11 * HOUR);
    expect((await budget.reserve(req())).ok).toBe(true);
  });

  it('세션 하루 경로 40·장소 300. 한도에 닿은 세션 수를 센다', async () => {
    for (let i = 0; i < 40; i++) {
      expect((await budget.reserve(req({ sessionId: 'a' }))).ok).toBe(true);
    }
    expect(await budget.reserve(req({ sessionId: 'a' }))).toEqual({
      ok: false,
      reason: 'session_daily',
    });
    expect(await budget.reserve(req({ sessionId: 'a' }))).toEqual({
      ok: false,
      reason: 'session_daily',
    });
    for (let i = 0; i < 300; i++) {
      expect((await budget.reserve(req({ sessionId: 'a', kind: 'places' }))).ok).toBe(true);
    }
    expect((await budget.reserve(req({ sessionId: 'a', kind: 'places' }))).ok).toBe(false);
    expect((await budget.stats()).sessionsCapped).toBe(2);
  });

  it('장애 재예약(retry)은 세션 한도를 다시 세지 않는다', async () => {
    for (let i = 0; i < 40; i++) await budget.reserve(req({ sessionId: 'b' }));
    expect(await budget.reserve(req({ sessionId: 'b', mode: 'tmap', retry: true }))).toEqual({
      ok: true,
      provider: 'tmap',
    });
  });

  it('provider 고정: tmap이면 카카오 여유가 있어도 TMAP, kakao면 소진 시 거절', async () => {
    expect(await budget.reserve(req({ mode: 'tmap' }))).toEqual({ ok: true, provider: 'tmap' });
    await fill('route', 9_000, 11);
    vi.setSystemTime(DAY_START + 22 * HOUR);
    expect(await budget.reserve(req({ mode: 'kakao' }))).toEqual({ ok: false, reason: 'budget' });
  });

  it('바인딩이 없을 때 DO가 세션 분당 한도를 센다', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await budget.reserve(req({ sessionId: 'c', perMinute: 5 }))).ok).toBe(true);
    }
    expect(await budget.reserve(req({ sessionId: 'c', perMinute: 5 }))).toEqual({
      ok: false,
      reason: 'rate',
    });
    vi.setSystemTime(DAY_START + 10 * HOUR + 60_000);
    expect((await budget.reserve(req({ sessionId: 'c', perMinute: 5 }))).ok).toBe(true);
  });

  it('KST 자정에 초기화되고 지난 날짜 기록은 지운다', async () => {
    for (let i = 0; i < 40; i++) await budget.reserve(req({ sessionId: 'd' }));
    expect(storage.data.has('day:2026-09-18')).toBe(true);
    vi.setSystemTime(DAY_START + 24 * HOUR);
    expect(await budget.reserve(req({ sessionId: 'd' }))).toEqual({ ok: true, provider: 'kakao' });
    expect(storage.data.has('day:2026-09-18')).toBe(false);
    expect((await budget.stats()).counts.kakao_route).toBe(1);
  });

  it('DO가 다시 떠도 전체 카운터는 저장소에서 이어진다', async () => {
    for (let i = 0; i < 10; i++) await budget.reserve(req());
    const revived = new BudgetCounter(fakeCtx(storage), {});
    expect((await revived.stats()).counts.kakao_route).toBe(10);
  });

  it('예약 1번에 저장 쓰기 1번', async () => {
    const before = storage.puts;
    for (let i = 0; i < 100; i++) await budget.reserve(req());
    expect(storage.puts - before).toBe(100);
  });

  it('오피넷 하루 50건', async () => {
    for (let i = 0; i < 50; i++) expect(await budget.reserveOpinet()).toBe(true);
    expect(await budget.reserveOpinet()).toBe(false);
  });
});
