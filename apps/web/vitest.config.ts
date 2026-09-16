import { defineConfig } from 'vitest/config';

// 앱 모델 테스트. 화면 없이 상태 → 계산 입력 변환만 확인한다.
export default defineConfig({
  test: {
    name: '@dl/web',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
