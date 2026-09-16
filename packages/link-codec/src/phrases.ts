// 결과 페이지가 가진 고정 문장.
// 링크는 사유를 코드로만 나르고, 문구는 받는 쪽이 만든다. 자유 텍스트를 링크로 옮기지 않는다.

import type { ReasonCode, ToneCode } from './schema.js';

const REASON_PHRASES: Record<ReasonCode, Record<ToneCode, string>> = {
  frontSeatSleep: {
    mild: '조수석에서 푹 쉬었어요',
    spicy: '조수석 숙면. 내비는 누가 봤죠?',
    business: '조수석 휴식',
  },
  backSeatSleep: {
    mild: '뒷자리에서 잘 주무셨어요',
    spicy: '뒷자리 숙면. 편안하셨나요',
    business: '뒷자리 휴식',
  },
  eatAlone: {
    mild: '간식을 혼자 드셨어요',
    spicy: '혼자 먹기. 운전자 입은 장식인가요',
    business: '단독 취식',
  },
  smellyFood: {
    mild: '냄새 강한 음식을 드셨어요',
    spicy: '차 안이 식당이 됐습니다',
    business: '강취식품 섭취',
  },
  litter: {
    mild: '부스러기를 남기셨어요',
    spicy: '뒷자리가 쓰레기통이 됐습니다',
    business: '차내 오염',
  },
  noisy: {
    mild: '조금 시끄러우셨어요',
    spicy: '통화·고성. 운전자 귀는 안녕하지 못합니다',
    business: '소음 발생',
  },
  backseatDriving: {
    mild: '길 안내를 많이 해주셨어요',
    spicy: '훈수. 그렇게 잘 아시면 운전대를',
    business: '주행 관여',
  },
  etc: { mild: '기타', spicy: '기타', business: '기타' },
  feedDriver: {
    mild: '운전자를 챙겨주셨어요',
    spicy: '운전자 먹여주기. 훌륭합니다',
    business: '운전자 지원',
  },
  buySnack: {
    mild: '휴게소에서 간식을 사주셨어요',
    spicy: '간식 결제. 이런 분이 또 있어야 합니다',
    business: '휴게소 간식 제공',
  },
  navigate: {
    mild: '길 안내를 도와주셨어요',
    spicy: '내비 담당. 조수석의 표본',
    business: '내비 지원',
  },
  offerSwap: {
    mild: '운전 교대를 제안하셨어요',
    spicy: '교대 제안. 마음만으로도 감형',
    business: '교대 제안',
  },
};

export function reasonPhrase(code: ReasonCode, tone: ToneCode): string {
  return REASON_PHRASES[code][tone];
}

/** 명분 문구. 비즈니스 말투는 표시하지 않는다. */
export function justification(tone: ToneCode): string | undefined {
  if (tone === 'mild') return '이 정산금은 운전자의 다음 기름값과 허리 건강에 쓰입니다.';
  if (tone === 'spicy') return '운전자는 오늘 사람이 아니라 내비였습니다.';
  return undefined;
}

/** 말투와 무관하게 늘 같은 안내. 금액 안내는 바꾸지 않는다. */
export const FIXED_NOTICE =
  '유가 시세, 최저시급, 함께 확인한 괘씸 기록으로 자동 계산했어요. ' +
  '금액은 링크를 만든 사람이 입력한 값 기준이니 송금 전에 확인하세요.';

export const PAY_NOTICE = '송금 앱에서 받는 사람이 맞는지 확인하세요.';

export const ERROR_MESSAGES = {
  corrupt: '링크가 잘렸거나 손상됐어요. 보낸 사람에게 링크를 다시 요청하세요.',
  'too-large': '링크가 잘렸거나 손상됐어요. 보낸 사람에게 링크를 다시 요청하세요.',
  'too-new': '새 버전 결과예요. 페이지를 새로고침하세요.',
  invalid: '링크가 잘렸거나 손상됐어요. 보낸 사람에게 링크를 다시 요청하세요.',
} as const;
