// 저장소 유지 요청. 시스템이 공간이 부족할 때 앱 저장소를 비우지 않도록 한 번 부탁한다.
// 거절당해도 앱은 그대로 동작한다. 기록은 원래 이 폰에만 있고 서버 사본이 없다.

export interface StorageManagerLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

export type PersistResult = 'persisted' | 'denied' | 'unsupported';

export async function keepStorage(manager: StorageManagerLike | undefined): Promise<PersistResult> {
  if (!manager?.persist) return 'unsupported';
  try {
    if (manager.persisted && (await manager.persisted())) return 'persisted';
    return (await manager.persist()) ? 'persisted' : 'denied';
  } catch {
    return 'unsupported';
  }
}
