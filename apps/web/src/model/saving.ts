// 저장 실패를 알린다. 기록은 이 폰에만 있어서 서버 사본이 없다.
// 조용히 넘어가면 사용자가 잃은 줄도 모르고 앱을 지운다.

export const SAVE_FAILED_MESSAGE = '저장하지 못했어요. 기기 저장 공간을 확인해 주세요.';

/** 저장을 실행하고, 실패하면 알린 뒤 false. 앱은 멈추지 않는다. */
export async function trySave(
  run: () => Promise<void>,
  onFail: (message: string) => void,
): Promise<boolean> {
  try {
    await run();
    return true;
  } catch {
    onFail(SAVE_FAILED_MESSAGE);
    return false;
  }
}
