// 결과 링크 압축·해제·스키마 검증. M4에서 구현한다.
// 결과 JSON → deflate → base64url → /r#v1.{문자열}
// 링크 데이터 4KB, 해제 32KB 상한. 계좌번호는 절대 넣지 않는다 (CLAUDE.md 절대 규칙 4).

export const PACKAGE_NAME = '@dl/link-codec';

/** 결과 링크 형식 버전. 옛 링크를 계속 열기 위해 유지한다. */
export const LINK_VERSION = 'v1';
