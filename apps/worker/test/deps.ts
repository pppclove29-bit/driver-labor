// 테스트용 Deps. 기본은 fixtures upstream, 고정 시각, 분당 제한 없음.
import { Control } from '../src/control.js';
import type { Deps } from '../src/deps.js';
import { fixtureUpstream } from '../src/providers/fixtures.js';
import { FakeKV } from './fakes.js';

/** 2026-09-18 10:00 KST */
export const NOW = Date.parse('2026-09-18T01:00:00Z');

export const SECRETS = {
  turnstileSecret: 'test-turnstile-secret',
  sessionSecret: 'test-session-secret',
} as const;

export function makeDeps(overrides: Partial<Deps> = {}, kv = new FakeKV()): Deps {
  return {
    control: new Control(kv.asKV(), () => NOW),
    secrets: SECRETS,
    upstream: fixtureUpstream,
    now: () => NOW,
    limiters: {},
    ...overrides,
  };
}
