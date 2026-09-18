// 하드 상한 (architecture.md "호출량 제한", decisions.md).
// 카카오·TMAP 무료량보다 낮게 둬서 쿼터 초과 이용이 구조적으로 생기지 않게 한다.

export type Provider = 'kakao' | 'tmap';
export type Kind = 'route' | 'places';
export type Counter = `${Provider}_${Kind}` | 'opinet';

/** 전체 하루 (KST 자정 초기화). 넘으면 그 제공자를 절대 호출하지 않는다. */
export const DAILY_LIMITS: Readonly<Record<Counter, number>> = {
  kakao_route: 9_000,
  kakao_places: 50_000,
  tmap_route: 900,
  tmap_places: 18_000,
  opinet: 50,
};

/** 전체 시간당 (두 제공자 합). 오전에 하루치가 다 타버리는 것을 막는다. */
export const HOURLY_LIMITS: Readonly<Record<Kind, number>> = { route: 1_500, places: 8_000 };

/** 세션 하루. 구간 4개짜리 여행을 10번 조회할 수 있는 양. */
export const SESSION_DAILY_LIMITS: Readonly<Record<Kind, number>> = { route: 40, places: 300 };
