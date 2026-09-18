// 핸들러가 쓰는 바깥 세계. index.ts가 Env로 만들고, 테스트는 대역으로 만든다.
import type { BudgetPort } from './budget/BudgetCounter.js';
import type { Control } from './control.js';
import type { Limiters } from './ratelimit.js';
import type { Upstream } from './upstream.js';

/** secret은 `wrangler secret put`으로만 넣는다 (CLAUDE.md 절대 규칙 7). */
export interface Secrets {
  readonly turnstileSecret: string;
  readonly sessionSecret: string;
}

export interface Deps {
  readonly secrets: Secrets;
  readonly upstream: Upstream;
  readonly now: () => number;
  readonly limiters: Limiters;
  readonly control: Control;
  readonly budget: BudgetPort;
}
