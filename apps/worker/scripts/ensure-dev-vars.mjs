// .dev.vars가 없으면 .dev.vars.example을 복사한다. 로컬 dev를 fixtures 모드로 시작하게 한다.
import { copyFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(workerDir, '.dev.vars');

try {
  await access(target);
} catch {
  await copyFile(resolve(workerDir, '.dev.vars.example'), target);
  console.log('.dev.vars 생성 (UPSTREAM=fixtures)');
}
