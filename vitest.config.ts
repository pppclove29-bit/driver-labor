import { defineConfig } from 'vitest/config';

// 계산·링크·저장소 패키지 테스트를 한 번에 돌린다.
// 기준값 테스트(docs/tasks.md)는 어떤 작업에서도 삭제하거나 기대값을 바꾸지 않는다.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/web'],
  },
});
