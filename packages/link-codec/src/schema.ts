// 결과 링크에 담기는 값과 그 한계.
// 자유 입력은 이름뿐이다. 괘씸 사유는 코드로만 보내고 문구는 결과 페이지가 가진다.
// 계좌번호는 담을 자리가 없다 (CLAUDE.md 절대 규칙 4).

export const LIMITS = {
  /** 링크 데이터(base64url) 최대 바이트. */
  encodedBytes: 4096,
  /** 압축 해제 상한. 압축 폭탄은 여기서 끊는다. */
  inflatedBytes: 32768,
  members: 10,
  segments: 10,
  nameChars: 10,
  placeChars: 20,
  amountWon: 5_000_000,
} as const;

/** 괘씸·감면 항목 코드. 문구는 결과 페이지의 고정 문장으로 바꾼다. */
export const REASON_CODES = [
  'frontSeatSleep',
  'backSeatSleep',
  'eatAlone',
  'smellyFood',
  'litter',
  'noisy',
  'backseatDriving',
  'etc',
  'feedDriver',
  'buySnack',
  'navigate',
  'offerSwap',
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export const TONE_CODES = ['mild', 'spicy', 'business'] as const;
export type ToneCode = (typeof TONE_CODES)[number];

/** 사람별 금액. 멤버 배열의 순서와 같다. */
export interface LinkPerson {
  /** 이름 */
  n: string;
  /** 공통비 */
  c: number;
  /** 노동비(수고비). 운전자는 음수(받는 금액). */
  l: number;
  /** 낸 돈 */
  p: number;
  /** 차액. 양수면 받을 돈, 음수면 보낼 돈. */
  b: number;
  /** 괘씸·감면 항목 코드 */
  r: ReasonCode[];
}

/** 구간 요약. 길이가 넘치면 빼고 사람별 합계만 남긴다. */
export interface LinkSegment {
  /** 탑승 인원 */
  n: number;
  /** 거리(미터) */
  d: number;
  /** 운전 시간(분) */
  t: number;
  /** 유류비 */
  f: number;
  /** 통행료 */
  o: number;
  /** 노동비 */
  l: number;
  /** 난이도 계수 */
  x: number;
}

export interface LinkPayload {
  v: 1;
  /** 출발지 */
  from: string;
  /** 도착지 */
  to: string;
  /** 발급 시각 ISO 8601 */
  at: string;
  tone: ToneCode;
  /** 운전자의 people 인덱스 */
  driver: number;
  people: LinkPerson[];
  segments: LinkSegment[];
  taxi: number;
  actual: number;
  saved: number;
  /** 운전자 송금 링크. 허용 형식만. 없으면 버튼을 숨긴다. */
  pay?: string;
}

/**
 * 허용하는 송금 링크 형식.
 * 위조 링크로 사기 계좌 송금을 유도하는 악용을 막기 위해 이 둘만 받는다.
 */
const PAY_LINK_PATTERNS = [
  /^https:\/\/toss\.me\/[A-Za-z0-9._-]{1,32}$/,
  /^https:\/\/qr\.kakaopay\.com\/[A-Za-z0-9]{1,64}$/,
];

export function isAllowedPayLink(value: string): boolean {
  return PAY_LINK_PATTERNS.some((re) => re.test(value));
}

/** 계좌번호처럼 보이는 문자열. 이름 칸으로 흘러들어오는 것을 막는다. */
const ACCOUNT_LIKE = /\d[\d-]{5,}/;

export class LinkError extends Error {
  constructor(
    message: string,
    readonly kind: 'corrupt' | 'too-large' | 'too-new' | 'invalid',
  ) {
    super(message);
    this.name = 'LinkError';
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new LinkError(message, 'invalid');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkAmount(value: unknown, label: string, allowNegative = false): number {
  assert(typeof value === 'number' && Number.isFinite(value), `${label}가 숫자가 아니다`);
  assert(Number.isInteger(value), `${label}가 정수가 아니다`);
  const max = LIMITS.amountWon;
  assert(value <= max && value >= (allowNegative ? -max : 0), `${label}가 허용 범위를 벗어났다`);
  return value;
}

function checkName(value: unknown): string {
  assert(typeof value === 'string', '이름이 문자열이 아니다');
  const name = value.trim();
  assert(name.length > 0 && name.length <= LIMITS.nameChars, '이름 길이가 허용 범위를 벗어났다');
  assert(!ACCOUNT_LIKE.test(name), '이름에 계좌번호처럼 보이는 값이 있다');
  return name;
}

function checkPlace(value: unknown, label: string): string {
  assert(typeof value === 'string', `${label}가 문자열이 아니다`);
  const place = value.trim();
  assert(
    place.length > 0 && place.length <= LIMITS.placeChars,
    `${label} 길이가 허용 범위를 벗어났다`,
  );
  assert(!ACCOUNT_LIKE.test(place), `${label}에 계좌번호처럼 보이는 값이 있다`);
  return place;
}

/** 해제한 값이 스키마에 맞는지 본다. 하나라도 어긋나면 손상된 링크로 취급한다. */
export function validatePayload(raw: unknown): LinkPayload {
  assert(isObject(raw), '결과가 객체가 아니다');
  if (typeof raw['v'] === 'number' && raw['v'] > 1) {
    throw new LinkError('더 새로운 버전의 링크다', 'too-new');
  }
  assert(raw['v'] === 1, '버전이 맞지 않는다');

  const from = checkPlace(raw['from'], '출발지');
  const to = checkPlace(raw['to'], '도착지');

  assert(typeof raw['at'] === 'string' && !Number.isNaN(Date.parse(raw['at'])), '발급 시각이 없다');
  const at = raw['at'];

  const tone = raw['tone'];
  assert(
    typeof tone === 'string' && (TONE_CODES as readonly string[]).includes(tone),
    '말투 코드가 올바르지 않다',
  );

  assert(Array.isArray(raw['people']), '사람 목록이 없다');
  const rawPeople = raw['people'];
  assert(
    rawPeople.length > 0 && rawPeople.length <= LIMITS.members,
    '사람 수가 허용 범위를 벗어났다',
  );

  const people: LinkPerson[] = rawPeople.map((entry) => {
    assert(isObject(entry), '사람 항목이 객체가 아니다');
    assert(Array.isArray(entry['r']), '사유 목록이 없다');
    const reasons = entry['r'].map((code) => {
      assert(
        typeof code === 'string' && (REASON_CODES as readonly string[]).includes(code),
        '사유 코드가 올바르지 않다',
      );
      return code as ReasonCode;
    });
    return {
      n: checkName(entry['n']),
      c: checkAmount(entry['c'], '공통비'),
      l: checkAmount(entry['l'], '수고비', true),
      p: checkAmount(entry['p'], '낸 돈'),
      b: checkAmount(entry['b'], '차액', true),
      r: reasons,
    };
  });

  const driver = raw['driver'];
  assert(
    typeof driver === 'number' && Number.isInteger(driver) && driver >= 0 && driver < people.length,
    '운전자 지정이 올바르지 않다',
  );

  assert(Array.isArray(raw['segments']), '구간 목록이 없다');
  const rawSegments = raw['segments'];
  assert(rawSegments.length <= LIMITS.segments, '구간 수가 허용 범위를 벗어났다');
  const segments: LinkSegment[] = rawSegments.map((entry) => {
    assert(isObject(entry), '구간 항목이 객체가 아니다');
    const n = entry['n'];
    const t = entry['t'];
    const d = entry['d'];
    const x = entry['x'];
    assert(typeof n === 'number' && n >= 0 && n <= LIMITS.members, '구간 인원이 올바르지 않다');
    assert(typeof t === 'number' && t >= 0 && t <= 60 * 24 * 7, '구간 운전 시간이 올바르지 않다');
    assert(typeof d === 'number' && d >= 0 && d <= 10_000_000, '구간 거리가 올바르지 않다');
    assert(typeof x === 'number' && x >= 1 && x <= 2, '난이도 계수가 올바르지 않다');
    return {
      n,
      d,
      t,
      f: checkAmount(entry['f'], '유류비'),
      o: checkAmount(entry['o'], '통행료'),
      l: checkAmount(entry['l'], '구간 노동비'),
      x,
    };
  });

  const payload: LinkPayload = {
    v: 1,
    from,
    to,
    at,
    tone: tone as ToneCode,
    driver,
    people,
    segments,
    taxi: checkAmount(raw['taxi'], '택시 예상요금'),
    actual: checkAmount(raw['actual'], '실제 총비용'),
    saved: checkAmount(raw['saved'], '아낀 돈', true),
  };

  // 허용 형식이 아닌 송금 링크는 버튼을 숨긴다. 링크 전체를 버리지는 않는다.
  const pay = raw['pay'];
  if (typeof pay === 'string' && isAllowedPayLink(pay)) payload.pay = pay;

  return payload;
}
