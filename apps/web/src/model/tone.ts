// 영수증 말투. 말투는 제목·괘씸 사유·공유 본문·명분 문구만 바꾸고 금액은 바꾸지 않는다
// (spec-screens.md "영수증 말투").

import type { PenaltyKind } from '@dl/calc';

import type { Tone } from './trip.js';

export const TONES: { id: Tone; label: string }[] = [
  { id: 'mild', label: '순한맛' },
  { id: 'spicy', label: '매운맛' },
  { id: 'business', label: '비즈니스' },
];

type Phrase = (minutes: number, count: number) => string;

const REASONS: Record<PenaltyKind, Record<Tone, Phrase>> = {
  frontSeatSleep: {
    mild: () => '조수석에서 푹 쉬었어요',
    spicy: (m) => `조수석에서 ${String(m)}분 숙면. 내비는 누가 봤죠?`,
    business: (m) => `조수석 휴식 ${String(m)}분`,
  },
  backSeatSleep: {
    mild: () => '뒷자리에서 잘 주무셨어요',
    spicy: (m) => `뒷자리 ${String(m)}분 숙면. 편안하셨나요`,
    business: (m) => `뒷자리 휴식 ${String(m)}분`,
  },
  eatAlone: {
    mild: () => '간식을 혼자 드셨어요',
    spicy: (c) => `혼자 먹기 ${String(c)}회. 운전자 입은 장식인가요`,
    business: (_m, c) => `단독 취식 ${String(c)}회`,
  },
  smellyFood: {
    mild: () => '냄새 강한 음식을 드셨어요',
    spicy: () => '차 안이 식당이 됐습니다',
    business: (_m, c) => `강취식품 섭취 ${String(c)}회`,
  },
  litter: {
    mild: () => '부스러기를 남기셨어요',
    spicy: () => '뒷자리가 쓰레기통이 됐습니다',
    business: () => '차내 오염',
  },
  noisy: {
    mild: () => '조금 시끄러우셨어요',
    spicy: (_m, c) => `통화·고성 ${String(c)}회. 운전자 귀는 안녕하지 못합니다`,
    business: (_m, c) => `소음 발생 ${String(c)}회`,
  },
  backseatDriving: {
    mild: () => '길 안내를 많이 해주셨어요',
    spicy: (_m, c) => `훈수 ${String(c)}회. 그렇게 잘 아시면 운전대를`,
    business: (_m, c) => `주행 관여 ${String(c)}회`,
  },
  etc: {
    mild: () => '기타',
    spicy: () => '기타',
    business: () => '기타',
  },
  feedDriver: {
    mild: () => '운전자를 챙겨주셨어요',
    spicy: () => '운전자 먹여주기. 훌륭합니다',
    business: (_m, c) => `운전자 지원 ${String(c)}회`,
  },
  buySnack: {
    mild: () => '휴게소에서 간식을 사주셨어요',
    spicy: () => '간식 결제. 이런 분이 또 있어야 합니다',
    business: () => '휴게소 간식 제공',
  },
  navigate: {
    mild: () => '길 안내를 도와주셨어요',
    spicy: (m) => `내비 ${String(m)}분. 조수석의 표본`,
    business: (m) => `내비 지원 ${String(m)}분`,
  },
  offerSwap: {
    mild: () => '운전 교대를 제안하셨어요',
    spicy: () => '교대 제안. 마음만으로도 감형',
    business: () => '교대 제안',
  },
};

export function penaltyReason(
  kind: PenaltyKind,
  tone: Tone,
  minutes: number,
  count: number,
): string {
  return REASONS[kind][tone](minutes, count);
}

export function receiptTitle(tone: Tone): string {
  if (tone === 'spicy') return '운전 노동 청구서';
  if (tone === 'business') return '운전 정산 내역';
  return '운전 노동 정산 영수증';
}

/** 명분 문구. 비즈니스 말투는 표시하지 않는다. */
export function justification(tone: Tone): string | undefined {
  if (tone === 'mild') return '이 정산금은 운전자의 다음 기름값과 허리 건강에 쓰입니다.';
  if (tone === 'spicy') return '운전자는 오늘 사람이 아니라 내비였습니다.';
  return undefined;
}

/** 공유 본문. 괘씸자는 이름 없이 인원수만 넣는다 (spec-screens.md S10). */
export function shareText(tone: Tone, destination: string, penalizedCount: number): string {
  if (tone === 'spicy') {
    return penalizedCount > 0
      ? `괘씸자 ${String(penalizedCount)}명 감지됨 🚨 정산 도착`
      : '전원 무사고 통과 🚨 정산 도착';
  }
  if (tone === 'business') return `${destination} 이동 운전 정산 내역입니다`;
  return `${destination} 여행 운전 정산이 도착했어요`;
}
