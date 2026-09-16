import { describe, expect, it } from 'vitest';

import { createMemoryStorage, PACKAGE_NAME } from './index.js';

describe('@dl/storage', () => {
  it('패키지가 로드된다', () => {
    expect(PACKAGE_NAME).toBe('@dl/storage');
  });

  it('넣은 값을 다시 읽는다', async () => {
    const s = createMemoryStorage();
    await s.put('trips', 't1', { destination: '강릉' });
    expect(await s.get('trips', 't1')).toEqual({ destination: '강릉' });
  });

  it('저장한 값은 바깥에서 고쳐도 바뀌지 않는다', async () => {
    const s = createMemoryStorage();
    const trip = { destination: '강릉', members: ['민수'] };
    await s.put('trips', 't1', trip);
    trip.members.push('지현');
    expect(await s.get<typeof trip>('trips', 't1')).toEqual({
      destination: '강릉',
      members: ['민수'],
    });
  });

  it('목록과 삭제', async () => {
    const s = createMemoryStorage();
    await s.put('trips', 't1', 1);
    await s.put('trips', 't2', 2);
    expect((await s.list('trips')).map((e) => e.key).sort()).toEqual(['t1', 't2']);
    await s.remove('trips', 't1');
    expect(await s.get('trips', 't1')).toBeUndefined();
    await s.clear('trips');
    expect(await s.list('trips')).toEqual([]);
  });

  it('스토어는 서로 분리된다', async () => {
    const s = createMemoryStorage();
    await s.put('trips', 'k', 'trip');
    await s.put('settings', 'k', 'setting');
    expect(await s.get('trips', 'k')).toBe('trip');
    expect(await s.get('settings', 'k')).toBe('setting');
  });
});
