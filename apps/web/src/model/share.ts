// 결과 링크 공유. 앱은 안드로이드 공유 시트, 웹은 Web Share API, 둘 다 없으면 복사.
// 공유 본문에는 괘씸자 인원수만 들어간다(이름 없음, decisions.md 공유 방식).

export type ShareOutcome = 'shared' | 'copied';

export interface SharePorts {
  /** 앱(Capacitor) 공유 시트. 웹에서는 없다. */
  nativeShare?: ((data: { text: string; url: string }) => Promise<void>) | undefined;
  /** 브라우저 Web Share API. 지원하지 않으면 없다. */
  webShare?: ((data: { text: string; url: string }) => Promise<void>) | undefined;
  copy: (text: string) => Promise<void>;
}

const canceled = (e: unknown): boolean =>
  e instanceof Error && (e.name === 'AbortError' || /cancel/i.test(e.message));

/** 공유 시트를 띄우고, 쓸 수 없으면 링크를 복사한다. 사용자가 취소한 것은 실패가 아니다. */
export async function shareResult(
  text: string,
  url: string,
  ports: SharePorts,
): Promise<ShareOutcome> {
  for (const share of [ports.nativeShare, ports.webShare]) {
    if (!share) continue;
    try {
      await share({ text, url });
      return 'shared';
    } catch (e) {
      if (canceled(e)) return 'shared';
    }
  }
  await ports.copy(`${text}\n${url}`);
  return 'copied';
}
