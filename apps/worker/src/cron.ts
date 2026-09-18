// Cron (매시 정각, 트리거 1개). 무료 계정당 5개 한도를 아끼려고 두 일을 함께 한다.
//   - 사용률 알림: 카운터별 50·80·95%를 처음 넘으면 디스코드 웹훅. 같은 날 같은 단계는 1번.
//     세션 하루 한도에 닿은 세션이 10개를 넘으면 공격 의심 알림.
//   - 유가 갱신: KST 0·6·12·18시에 오피넷 시·도 평균가 → KV. 실패하면 기존 값 유지.
// 알림 본문에는 카운터 이름과 숫자만 넣는다. 세션 ID·IP·좌표·검색어는 없다.
import type { AlertKey, BudgetPort } from './budget/BudgetCounter.js';
import type { Counter } from './budget/limits.js';
import { FUEL_KEY, type FuelTable } from './fuel.js';
import { fetchOpinetAvg } from './providers/opinet.js';
import { kstHour } from './time.js';
import type { Upstream } from './upstream.js';

export const FUEL_REFRESH_HOURS = [0, 6, 12, 18];
export const ALERT_LEVELS = [50, 80, 95];
export const ATTACK_SESSIONS = 10;

const LABEL: Record<Counter, string> = {
  kakao_route: '카카오 경로',
  kakao_places: '카카오 장소',
  tmap_route: 'TMAP 경로',
  tmap_places: 'TMAP POI',
  opinet: '오피넷',
};

export interface CronDeps {
  readonly upstream: Upstream;
  readonly kv: KVNamespace;
  readonly budget: BudgetPort;
  readonly opinetKey: string;
  /** 디스코드 웹훅 URL (secret). 없으면 알림을 보내지 않는다. */
  readonly alertWebhookUrl: string;
}

export async function refreshFuel(deps: CronDeps, scheduledMs: number): Promise<void> {
  if (!(await deps.budget.reserveOpinet())) {
    console.error('budget_exhausted', 'opinet');
    return;
  }
  try {
    const prices = await fetchOpinetAvg(deps.upstream, deps.opinetKey);
    const table: FuelTable = { updatedAt: new Date(scheduledMs).toISOString(), prices };
    await deps.kv.put(FUEL_KEY, JSON.stringify(table));
  } catch {
    console.error('upstream_unavailable', 'opinet');
  }
}

export async function checkUsage(deps: CronDeps): Promise<void> {
  const stats = await deps.budget.stats();
  const lines: string[] = [];
  const marks: [AlertKey, number][] = [];
  for (const counter of Object.keys(LABEL) as Counter[]) {
    const count = stats.counts[counter];
    const limit = stats.limits[counter];
    const pct = (count / limit) * 100;
    const level = ALERT_LEVELS.filter((l) => pct >= l).pop();
    if (level !== undefined && level > (stats.alerted[counter] ?? 0)) {
      lines.push(
        `${LABEL[counter]} ${count.toLocaleString('en-US')}/${limit.toLocaleString('en-US')} (${Math.floor(pct)}%)`,
      );
      marks.push([counter, level]);
    }
  }
  if (stats.sessionsCapped > ATTACK_SESSIONS && !stats.alerted.attack) {
    lines.push(`공격 의심: 세션 하루 한도에 닿은 세션 ${stats.sessionsCapped}개`);
    marks.push(['attack', 1]);
  }
  if (lines.length === 0 || !deps.alertWebhookUrl) return;

  const content = [`[운전 노동 정산기] 사용량 알림 ${stats.day}`, ...lines].join('\n');
  try {
    const res = await deps.upstream(
      new Request(deps.alertWebhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content }),
      }),
    );
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    console.error('webhook_failed');
    return;
  }
  for (const [key, level] of marks) await deps.budget.markAlerted(key, level);
}

export async function runCron(deps: CronDeps, scheduledMs: number): Promise<void> {
  if (FUEL_REFRESH_HOURS.includes(kstHour(scheduledMs))) await refreshFuel(deps, scheduledMs);
  await checkUsage(deps);
}
