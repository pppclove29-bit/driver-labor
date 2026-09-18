// ⑥ 일일 예산 카운터 (Durable Object). 돈과 직결되는 상한을 정확히 센다.
//
// - 인스턴스 하나("global")가 모든 요청을 받는다. DO는 한 번에 한 요청만 처리하므로
//   확인과 증가가 원자적이다.
// - 전체 카운터는 날짜별 키 하나(day:YYYY-MM-DD)에 모아, 예약 1번에 저장 쓰기 1번만 한다
//   (DO 무료 한도: 하루 행 쓰기 10만).
// - 세션별 카운터는 메모리에만 둔다. DO가 내려가면 사라지지만 돈과 직결되는 상한은
//   영속 저장한 전체 카운터가 막는다. 세션 ID는 2시간 뒤 무효, 날짜가 바뀌면 전부 지운다.
// - 좌표·검색어·IP는 이 객체에 들어오지 않는다.
import { DurableObject } from 'cloudflare:workers';
import type { ProviderMode } from '../control.js';
import { kstDay, kstHour } from '../time.js';
import {
  type Counter,
  DAILY_LIMITS,
  HOURLY_LIMITS,
  type Kind,
  type Provider,
  SESSION_DAILY_LIMITS,
} from './limits.js';

export type AlertKey = Counter | 'attack';

interface DayState {
  day: string;
  counts: Record<Counter, number>;
  /** 현재 시각(KST 시)의 호출 수. 시가 바뀌면 0부터. */
  hour: { h: number; route: number; places: number };
  /** 세션 하루 한도에 닿은 세션 수. */
  sessionsCapped: number;
  /** 오늘 보낸 알림 단계(50·80·95). */
  alerted: Partial<Record<AlertKey, number>>;
}

export interface ReserveRequest {
  kind: Kind;
  sessionId: string;
  /** 외부 호출 건수. 구간 N개짜리 경로는 N. */
  units: number;
  mode: ProviderMode;
  /** 제공자 장애로 다른 제공자에 다시 예약. 세션 한도는 다시 세지 않는다. */
  retry?: boolean;
  /** Rate Limiting 바인딩을 못 쓸 때만 DO가 세는 세션 분당 한도. */
  perMinute?: number;
}

export type ReserveResult =
  { ok: true; provider: Provider } | { ok: false; reason: 'budget' | 'session_daily' | 'rate' };

export interface UsageStats {
  day: string;
  counts: Record<Counter, number>;
  limits: Record<Counter, number>;
  sessionsCapped: number;
  alerted: Partial<Record<AlertKey, number>>;
}

const emptyDay = (day: string, h: number): DayState => ({
  day,
  counts: { kakao_route: 0, kakao_places: 0, tmap_route: 0, tmap_places: 0, opinet: 0 },
  hour: { h, route: 0, places: 0 },
  sessionsCapped: 0,
  alerted: {},
});

export class BudgetCounter extends DurableObject {
  private state: DayState | null = null;
  private readonly sessionUse = new Map<string, number>();
  private readonly sessionCapped = new Set<string>();
  private readonly minuteUse = new Map<string, { minute: number; count: number }>();

  /** 오늘 상태를 읽는다. 날짜가 바뀌었으면 지난 날짜 기록을 지운다. */
  private async load(now: number): Promise<DayState> {
    const day = kstDay(now);
    const h = kstHour(now);
    if (this.state?.day !== day) {
      const stored = await this.ctx.storage.get<DayState>(`day:${day}`);
      const old = await this.ctx.storage.list({ prefix: 'day:' });
      for (const key of old.keys()) {
        if (key !== `day:${day}`) await this.ctx.storage.delete(key);
      }
      if (this.state && this.state.day !== day) {
        this.sessionUse.clear();
        this.sessionCapped.clear();
        this.minuteUse.clear();
      }
      this.state = stored ?? emptyDay(day, h);
    }
    if (this.state.hour.h !== h) this.state.hour = { h, route: 0, places: 0 };
    return this.state;
  }

  private save(state: DayState): Promise<void> {
    return this.ctx.storage.put(`day:${state.day}`, state);
  }

  async reserve(req: ReserveRequest): Promise<ReserveResult> {
    const now = Date.now();
    const state = await this.load(now);
    const { kind, units } = req;
    const sessionKey = `${kind}:${req.sessionId}`;

    if (!req.retry) {
      if (req.perMinute !== undefined) {
        const minute = Math.floor(now / 60_000);
        const m = this.minuteUse.get(sessionKey);
        const count = m && m.minute === minute ? m.count : 0;
        if (count + 1 > req.perMinute) return { ok: false, reason: 'rate' };
        this.minuteUse.set(sessionKey, { minute, count: count + 1 });
      }
      const used = this.sessionUse.get(sessionKey) ?? 0;
      if (used + units > SESSION_DAILY_LIMITS[kind]) {
        if (!this.sessionCapped.has(sessionKey)) {
          this.sessionCapped.add(sessionKey);
          state.sessionsCapped += 1;
          await this.save(state);
        }
        return { ok: false, reason: 'session_daily' };
      }
    }

    if (state.hour[kind] + units > HOURLY_LIMITS[kind]) return { ok: false, reason: 'budget' };

    const candidates: Provider[] = req.mode === 'auto' ? ['kakao', 'tmap'] : [req.mode];
    const provider = candidates.find(
      (p) => state.counts[`${p}_${kind}`] + units <= DAILY_LIMITS[`${p}_${kind}`],
    );
    if (!provider) return { ok: false, reason: 'budget' };

    state.counts[`${provider}_${kind}`] += units;
    state.hour[kind] += units;
    if (!req.retry) {
      this.sessionUse.set(sessionKey, (this.sessionUse.get(sessionKey) ?? 0) + units);
    }
    await this.save(state);
    return { ok: true, provider };
  }

  /** 오피넷 호출 1건 예약 (Cron 유가 갱신). */
  async reserveOpinet(): Promise<boolean> {
    const state = await this.load(Date.now());
    if (state.counts.opinet + 1 > DAILY_LIMITS.opinet) return false;
    state.counts.opinet += 1;
    await this.save(state);
    return true;
  }

  async stats(): Promise<UsageStats> {
    const state = await this.load(Date.now());
    return {
      day: state.day,
      counts: { ...state.counts },
      limits: { ...DAILY_LIMITS },
      sessionsCapped: state.sessionsCapped,
      alerted: { ...state.alerted },
    };
  }

  async markAlerted(key: AlertKey, level: number): Promise<void> {
    const state = await this.load(Date.now());
    state.alerted[key] = level;
    await this.save(state);
  }
}

/** 핸들러가 쓰는 예산 인터페이스. 운영은 DO 스텁, 테스트는 인스턴스를 직접 넣는다. */
export type BudgetPort = Pick<BudgetCounter, 'reserve' | 'reserveOpinet' | 'stats' | 'markAlerted'>;
