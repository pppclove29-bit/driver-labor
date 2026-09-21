import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // 안드로이드 프로젝트에는 빌드로 복사된 웹 번들과 Capacitor 브리지가 들어간다.
    ignores: [
      '**/dist/',
      '**/dist-assets/',
      '**/.wrangler/',
      '**/dev-dist/',
      'apps/mobile/android/',
      'mockups/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: {
      // 요청 본문·검색어·좌표가 로그로 새지 않게 한다 (CLAUDE.md 절대 규칙 7).
      // 오류 보고는 console.error만 허용.
      'no-console': ['error', { allow: ['error'] }],
      'no-restricted-properties': [
        'error',
        {
          property: 'innerHTML',
          message: '링크 데이터는 textContent로만 출력한다 (CLAUDE.md 절대 규칙 3).',
        },
      ],
    },
  },
  {
    files: [
      'apps/worker/scripts/**',
      'apps/mobile/scripts/**',
      'vitest.config.ts',
      'eslint.config.js',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },
  prettier,
);
