// 스토어 스크린샷 한 장을 만든다. 에뮬레이터 화면(1080×2400)을 찍어 1080×1920으로 자른다.
//
//   node scripts/store-shot.mjs <이름> [잘라낼 위쪽 픽셀]
//
// Play는 장변이 단변의 2배를 넘는 이미지를 받지 않는다(2400/1080 = 2.22). 그래서 잘라야 한다.
// 기본은 위 240px(상태바 쪽)과 아래 240px을 버린다. 하단 버튼이 잘리면 두 번째 인자로 조절한다.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const adb = resolve(homedir(), 'Library/Android/sdk/platform-tools/adb');
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../store-shots');
const [name, topArg] = process.argv.slice(2);

if (!name) {
  console.error('사용법: node scripts/store-shot.mjs <이름> [잘라낼 위쪽 픽셀]');
  process.exit(1);
}

const TARGET_H = 1920;
const top = Number(topArg ?? 240);

mkdirSync(outDir, { recursive: true });
const raw = resolve(outDir, `${name}.raw.png`);
const out = resolve(outDir, `${name}.png`);

execFileSync('sh', ['-c', `${adb} exec-out screencap -p > ${raw}`]);
execFileSync(
  'sips',
  ['-c', String(TARGET_H), '1080', '--cropOffset', String(top), '0', raw, '--out', out],
  {
    stdio: 'ignore',
  },
);
const size = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out]).toString().trim();
console.log(`${out}\n${size}`);
