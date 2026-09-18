// 날짜 경계는 한국 시간 자정이다 (decisions.md). 카카오 무료량도 한국 날짜 기준으로 본다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** `YYYY-MM-DD` (KST) */
export const kstDay = (ms: number): string =>
  new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);

/** 0~23 (KST) */
export const kstHour = (ms: number): number => new Date(ms + KST_OFFSET_MS).getUTCHours();
