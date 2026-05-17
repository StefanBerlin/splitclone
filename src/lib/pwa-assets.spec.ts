/**
 * Guards the static PWA assets (SC-NFR-PLT-1): the manifest stays
 * install-valid and every icon it points at exists with the declared
 * dimensions. Node-only spec (reads from disk); the client project's glob
 * only picks up *.svelte.spec, so this runs in the server project.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'static/manifest.webmanifest'), 'utf8')) as {
	name: string;
	short_name: string;
	start_url: string;
	scope: string;
	display: string;
	theme_color: string;
	background_color: string;
	icons: { src: string; sizes: string; type: string; purpose: string }[];
};

/** width/height from a PNG IHDR (bytes 16..24), after the 8-byte signature. */
function pngSize(path: string): { w: number; h: number } {
	const b = readFileSync(path);
	expect([...b.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
	return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('PWA manifest (SC-NFR-PLT-1)', () => {
	it('declares the fields a browser needs to offer "install"', () => {
		expect(manifest.name).toBe('SplitClone');
		expect(manifest.short_name.length).toBeGreaterThan(0);
		expect(manifest.display).toBe('standalone');
		expect(manifest.start_url).toBeTruthy();
		expect(manifest.scope).toBeTruthy();
		expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
		expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
	});

	it('ships 192 + 512 "any" icons and a maskable icon, all present on disk', () => {
		const any = manifest.icons.filter((i) => i.purpose.split(' ').includes('any'));
		const maskable = manifest.icons.filter((i) => i.purpose.split(' ').includes('maskable'));
		expect(any.map((i) => i.sizes).sort()).toEqual(['192x192', '512x512']);
		expect(maskable.length).toBeGreaterThanOrEqual(1);

		for (const icon of manifest.icons) {
			const p = join(root, 'static', icon.src);
			expect(existsSync(p), `${icon.src} missing`).toBe(true);
			expect(icon.type).toBe('image/png');
			const [w, h] = icon.sizes.split('x').map(Number);
			expect(pngSize(p)).toEqual({ w, h });
		}
	});

	it('has an apple-touch-icon for iOS Add to Home Screen', () => {
		expect(pngSize(join(root, 'static/icons/apple-touch-icon-180.png'))).toEqual({
			w: 180,
			h: 180
		});
	});
});
