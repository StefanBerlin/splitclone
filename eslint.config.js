import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		// Cardinal rule from docs/architecture.md §2: src/lib/domain/ is PURE.
		// No I/O, no framework, no platform primitives, no ambient time/randomness.
		// This is what makes the deterministic-merge claim (SC-ARC-MRG-1) provable.
		files: ['src/lib/domain/**/*.{ts,js}'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: [
								'$lib/storage/*',
								'$lib/sync/*',
								'$lib/auth/*',
								'$lib/export/*',
								'$lib/platform/*',
								'$lib/ui/*',
								'$app/*',
								'$env/*',
								'svelte',
								'svelte/*',
								'@sveltejs/*'
							],
							message:
								'domain/ must stay pure (no I/O, no framework, no platform). See docs/architecture.md §2.'
						}
					]
				}
			],
			'no-restricted-globals': [
				'error',
				{ name: 'fetch', message: 'domain/ is pure: no network. Move I/O to storage/ or sync/.' },
				{ name: 'indexedDB', message: 'domain/ is pure: no persistence. Use storage/.' },
				{ name: 'localStorage', message: 'domain/ is pure: no persistence.' },
				{ name: 'sessionStorage', message: 'domain/ is pure: no persistence.' },
				{ name: 'caches', message: 'domain/ is pure: no Cache API.' },
				{ name: 'crypto', message: 'domain/ is pure: no crypto. Use storage/encryption.ts.' }
			],
			'no-restricted-properties': [
				'error',
				{
					object: 'Date',
					property: 'now',
					message:
						'domain/ must be deterministic: inject the timestamp instead of reading the clock (SC-ARC-MRG-1).'
				},
				{
					object: 'Math',
					property: 'random',
					message: 'domain/ must be deterministic: inject randomness instead of Math.random().'
				}
			]
		}
	},
	{
		rules: {
			// Re-enabled in Phase 9 (v1.0 hardening): every internal link/goto
			// goes through resolve() from '$app/paths' so the app stays correct
			// under any deployment base path (e.g. a GitHub Pages subpath),
			// without baking a base path into the code.
			'svelte/no-navigation-without-resolve': 'error'
		}
	}
);
