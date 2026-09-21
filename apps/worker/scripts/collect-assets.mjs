// Worker가 서빙할 정적 파일을 한 폴더로 모은다.
//   apps/site        → dist-assets/     (/, /guide, /calc, /privacy)
//   apps/result/dist → dist-assets/r/   (/r)
// 입력 화면은 앱(Capacitor)이 들고 있으므로 웹으로 서빙하지 않는다.
import { cp, rm, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(workerDir, '../..');
const target = resolve(workerDir, 'dist-assets');

const sources = [
  { from: resolve(repoRoot, 'apps/site'), to: target, name: 'site' },
  { from: resolve(repoRoot, 'apps/result/dist'), to: resolve(target, 'r'), name: 'result' },
];

for (const { from, name } of sources) {
  try {
    await access(from);
  } catch {
    console.error(`${name} 파일이 없습니다: ${from}\n먼저 pnpm build를 실행하세요.`);
    process.exit(1);
  }
}

await rm(target, { recursive: true, force: true });
for (const { from, to } of sources) {
  await cp(from, to, { recursive: true });
}
// 소개 페이지 폴더의 문서는 서빙하지 않는다.
await rm(resolve(target, 'README.md'), { force: true });

console.log('dist-assets 준비 완료 (/ = 소개·정책 페이지, /r = 결과 보기)');
