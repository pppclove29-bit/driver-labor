// 표기 규칙: 천 단위 쉼표 + "원" (CLAUDE.md 코딩 규칙, spec-screens.md 공통 UI 규칙).

export function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/** 부호를 붙인 금액. 받을 돈은 +, 보낼 돈은 −. */
export function signedWon(amount: number): string {
  if (amount === 0) return '0원';
  return `${amount > 0 ? '+' : '−'}${Math.abs(amount).toLocaleString('ko-KR')}원`;
}

export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${String(m)}분`;
  if (m === 0) return `${String(h)}시간`;
  return `${String(h)}시간 ${String(m)}분`;
}

export function km(meters: number): string {
  return `${(meters / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`;
}

export function clock(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function day(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1)}월 ${String(d.getDate())}일`;
}
