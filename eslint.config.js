import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import harness from './eslint.harness-rules.js';

export default [
	{ ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.svelte-kit/**', 'build/**'] },
	prettier,
	{
		files: ['src/**/*.ts', 'test/**/*.ts', 'db/**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: { project: './tsconfig.json' },
			globals: {
				$state: 'readonly',
				Buffer: 'readonly',
				Bun: 'readonly',
				Response: 'readonly',
				console: 'readonly',
				fetch: 'readonly',
				localStorage: 'readonly',
				process: 'readonly',
				setTimeout: 'readonly',
				window: 'readonly'
			}
		},
		plugins: { '@typescript-eslint': tseslint, harness },
		rules: {
			...eslint.configs.recommended.rules,
			'no-unused-vars': 'off',
			'@typescript-eslint/consistent-type-imports': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			complexity: ['error', 10],
			'harness/max-class-lines': 'error',
			'harness/max-method-lines': 'error',
			'harness/no-manager-name': 'error',
			'max-classes-per-file': ['error', 1],
			'max-depth': ['error', 4],
			'max-lines': ['error', { max: 220, skipBlankLines: true, skipComments: true }],
			'max-lines-per-function': ['error', { max: 55, skipBlankLines: true, skipComments: true }],
			'max-params': ['error', 4],
			'no-nested-ternary': 'error'
		}
	}
];
