// 첫 실행 고지. 서버로 가는 값과 폰에만 남는 값을 한 장으로 알린다.
// 여기서는 "확인"만 받는다. 앱은 위치 권한을 쓰지 않는다(2026-09-21 결정: 운전 중 잠금 삭제).

/** 문구가 바뀌면 올린다. 올리면 이미 본 사람에게도 다시 보여준다. */
export const NOTICE_VERSION = 2;

export const NOTICE_LINES = [
  '여행 기록·금액·이름은 이 폰에만 저장돼요. 서버에는 남지 않아요.',
  '서버로 가는 값은 장소 검색어, 고른 장소 좌표, 시·도 코드, 사람 확인 토큰뿐이에요.',
  '결과 링크의 # 뒤 내용은 서버로 가지 않아요. 링크를 받은 사람의 브라우저에서만 풀려요.',
] as const;

export const STORAGE_LINE = '기록은 이 폰에만 있어요. 앱을 지우면 사라집니다.';

export const needsNotice = (seenVersion: number | undefined): boolean =>
  (seenVersion ?? 0) < NOTICE_VERSION;
