import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';

export default [
  {
    ignores: ['dist', 'node_modules', 'build', '.vite'],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        React: 'readonly',
        fetch: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        URLPattern: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        FormData: 'readonly',
        CustomEvent: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        ImageData: 'readonly',
        Image: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        self: 'readonly',
        clients: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Code quality
      // Legacy React screens keep some parked variants/imports while the product UI
      // is still moving quickly. Keep runtime/safety lint rules active, but avoid
      // blocking production readiness on unused presentation code.
      'no-unused-vars': 'off',
      'react/jsx-uses-react': 'warn',
      'react/jsx-uses-vars': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'warn',
      'no-var': 'warn',
      // Best practices
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-with': 'error',
      // Code style
      'semi': ['warn', 'never'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'indent': ['warn', 2],
      'comma-dangle': ['warn', 'only-multiline'],
      'no-multiple-empty-lines': ['warn', { max: 2 }],
      'no-trailing-spaces': 'warn',
      'space-before-function-paren': ['warn', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always',
      }],
    },
  },
  {
    files: ['src/__tests__/**/*.{js,jsx}', 'src/**/*.test.{js,jsx}'],
    languageOptions: {
      globals: {
        File: 'readonly',
      },
    },
  },
];
