// 차단 목록에 넣을 IP 해시를 계산한다. 운영자가 로컬에서만 실행한다.
//   SESSION_SECRET=… node scripts/hash-ip.mjs 203.0.113.7 [YYYY-MM-DD]
// 날짜를 생략하면 오늘(KST). 결과를 KV `block:YYYY-MM-DD`의 ipHashes에 넣는다.
import { createHmac } from 'node:crypto';

const [ip, dayArg] = process.argv.slice(2);
const secret = process.env.SESSION_SECRET;
if (!ip || !secret) {
  console.error('사용법: SESSION_SECRET=… node scripts/hash-ip.mjs <IP> [YYYY-MM-DD]');
  process.exit(1);
}
const day = dayArg ?? new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const hash = createHmac('sha256', secret).update(`ip:${day}:${ip}`).digest('hex').slice(0, 32);
console.log(hash);
