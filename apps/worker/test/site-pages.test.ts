// 공개 페이지(apps/site)에 자리표시가 남은 채 배포되지 않게 한다.
// /privacy는 스토어 심사자가 보는 주소다. 2026-09-21에 이메일 자리표시가 배포된 적이 있다.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const siteDir = new URL('../../site/', import.meta.url);
const pages = readdirSync(siteDir).filter((f) => f.endsWith('.html'));
const read = (file: string): string => readFileSync(new URL(file, siteDir), 'utf8');

describe('공개 페이지', () => {
  it('소개·가이드·계산·방침 네 장이 있다', () => {
    expect(pages.sort()).toEqual(['calc.html', 'guide.html', 'index.html', 'privacy.html']);
  });

  it.each(pages)('%s에 자리표시가 남아 있지 않다', (file) => {
    const html = read(file);
    for (const mark of ['채운다', '(배포일', 'TODO', 'TBD', 'XXX', 'lorem']) {
      expect(html, `${file}에 "${mark}"`).not.toContain(mark);
    }
  });

  it('방침에 문의 이메일과 시행일이 들어 있다', () => {
    const html = read('privacy.html');
    expect(html).toContain('musikga1116@gmail.com');
    expect(html).toContain('mailto:musikga1116@gmail.com');
    expect(html).toMatch(/시행일: \d{4}년 \d{1,2}월 \d{1,2}일/);
  });

  it('공개 페이지는 외부 스크립트·광고를 부르지 않는다', () => {
    for (const file of pages) {
      const html = read(file);
      expect(html, file).not.toMatch(/<script/i);
      expect(html, file).not.toMatch(/googletagmanager|adsbygoogle|analytics/i);
    }
  });
});
