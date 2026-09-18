// 테스트용 `cloudflare:workers` 대역. Node에는 이 모듈이 없어서 DO 기반 클래스만 흉내 낸다.
export class DurableObject<Env = unknown> {
  protected ctx: DurableObjectState;
  protected env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
