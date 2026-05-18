/**
 * App-wide theme preference (SC-FR — "This device" appearance setting).
 *
 * Theme is a per-device, per-browser preference, NOT ledger data and NOT part
 * of the file format (SC-ARC-FMT-1) — it lives in localStorage and never
 * syncs. 'system' defers to the OS via the CSS `prefers-color-scheme` rules
 * in app.css; 'light'/'dark' force it through `data-theme` on <html>.
 */
export type Theme = 'system' | 'light' | 'dark';

const KEY = 'splitclone-theme';

export function getTheme(): Theme {
	if (typeof localStorage === 'undefined') return 'system';
	const v = localStorage.getItem(KEY);
	return v === 'light' || v === 'dark' ? v : 'system';
}

function apply(theme: Theme): void {
	if (typeof document === 'undefined') return;
	const el = document.documentElement;
	if (theme === 'system') delete el.dataset.theme;
	else el.dataset.theme = theme;
}

/** Persist + apply. Called from the Settings screen. */
export function setTheme(theme: Theme): void {
	if (typeof localStorage !== 'undefined') {
		if (theme === 'system') localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, theme);
	}
	apply(theme);
}

/** Apply the stored preference. Called once at app start (root layout). */
export function initTheme(): void {
	apply(getTheme());
}
