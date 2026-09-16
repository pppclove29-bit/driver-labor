// 빌드된 두 앱을 Worker의 정적 자산 폴더 하나로 모은다.
//   apps/web/dist    → dist-assets/     (/)
//   apps/result/dist → dist-assets/r/   (/r)
import { cp, rm, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(workerDir, '../..');
const target = resolve(workerDir, 'dist-assets');

const sources = [
  { from: resolve(repoRoot, 'apps/web/dist'), to: target, name: 'web' },
  { from: resolve(repoRoot, 'apps/result/dist'), to: resolve(target, 'r'), name: 'result' },
];

for (const { from, name } of sources) {
  try {
    await access(from);
  } catch {
    console.error(`${name} 빌드 결과가 없습니다: ${from}\n먼저 pnpm build를 실행하세요.`);
    process.exit(1);
  }
}

await rm(target, { recursive: true, force: true });
for (const { from, to } of sources) {
  await cp(from, to, { recursive: true });
}

console.log('dist-assets 준비 완료 (/ = web, /r = result)');
