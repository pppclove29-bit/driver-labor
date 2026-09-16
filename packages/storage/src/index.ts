// 저장소 인터페이스. 구현은 플랫폼별로 갈린다.
// 웹(PWA): IndexedDB — M2에서 구현
// 네이티브 전환 시: SQLite — 화면과 저장소 구현만 새로 만든다 (decisions.md 로드맵)
//
// 모든 여행 기록은 입력 담당의 폰에만 저장한다. 서버로 보내지 않는다
// (CLAUDE.md 절대 규칙 1).

export const PACKAGE_NAME = '@dl/storage';

/** 엔티티 컬렉션 이름. 필드 구조는 M1의 @dl/calc 도메인 타입을 따른다. */
export type CollectionName =
  | 'trips'
  | 'vehicles'
  | 'members'
  | 'segments'
  | 'tripEvents'
  | 'segmentRiders'
  | 'fuelLogs'
  | 'priceSnapshots'
  | 'penaltyEvents'
  | 'payments'
  | 'settlements';

/** 폰 안의 저장소. 구현체는 M2에서 붙인다. */
export interface LocalStore {
  get<T>(collection: CollectionName, id: string): Promise<T | undefined>;
  put<T>(collection: CollectionName, id: string, value: T): Promise<void>;
  delete(collection: CollectionName, id: string): Promise<void>;
  list<T>(collection: CollectionName): Promise<T[]>;
}
