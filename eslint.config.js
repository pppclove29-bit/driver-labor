import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/', '**/dist-assets/', '**/.wrangler/', '**/dev-dist/', 'mockups/'],
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
    files: ['apps/worker/scripts/**', 'vitest.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },
  prettier,
);
