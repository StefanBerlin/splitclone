/**
 * One-off PWA icon generator. Dependency-free (Node `zlib` only), in keeping
 * with the project's anti-dependency posture — no sharp/canvas/resvg.
 *
 * Design: full-bleed accent square (maskable-safe — the glyph stays inside the
 * central 60% so OS corner-masking never clips it) with a white disc split by
 * a vertical gap — the "split a shared expense" metaphor, matching the app's
 * iOS-blue accent (#0a84ff).
 *
 * Run: `node scripts/gen-icons.mjs` (or `pnpm gen:icons`). Outputs are
 * committed; this is not part of the build.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const ACCENT = [0x0a, 0x84, 0xff];
const WHITE = [0xff, 0xff, 0xff];
const SS = 4; // supersampling factor for crisp edges

const CRC = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return (buf) => {
		let c = 0xffffffff;
		for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	};
})();

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(CRC(td), 0);
	return Buffer.concat([len, td, crc]);
}

function png(width, height, rgba) {
	const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // colour type RGBA
	const raw = Buffer.alloc(height * (1 + width * 4));
	for (let y = 0; y < height; y++) {
		raw[y * (1 + width * 4)] = 0; // filter: none
		rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
	}
	return Buffer.concat([
		sig,
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}

/** Render one icon at `size`, glyph scaled by `glyphScale` (smaller = more
 *  padding, used for the dedicated maskable variant). */
function render(size, glyphScale) {
	const S = size * SS;
	const buf = Buffer.alloc(S * S * 4);
	const cx = S / 2;
	const cy = S / 2;
	const r = S * 0.5 * glyphScale; // disc radius
	const gap = S * 0.07; // half-width of the central split
	for (let y = 0; y < S; y++) {
		for (let x = 0; x < S; x++) {
			const dx = x + 0.5 - cx;
			const dy = y + 0.5 - cy;
			const inDisc = dx * dx + dy * dy <= r * r;
			const inGap = Math.abs(dx) < gap;
			const c = inDisc && !inGap ? WHITE : ACCENT;
			const i = (y * S + x) * 4;
			buf[i] = c[0];
			buf[i + 1] = c[1];
			buf[i + 2] = c[2];
			buf[i + 3] = 255;
		}
	}
	// Box-downsample SS×SS → size.
	const out = Buffer.alloc(size * size * 4);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let rr = 0;
			let gg = 0;
			let bb = 0;
			for (let sy = 0; sy < SS; sy++) {
				for (let sx = 0; sx < SS; sx++) {
					const i = ((y * SS + sy) * S + (x * SS + sx)) * 4;
					rr += buf[i];
					gg += buf[i + 1];
					bb += buf[i + 2];
				}
			}
			const n = SS * SS;
			const o = (y * size + x) * 4;
			out[o] = Math.round(rr / n);
			out[o + 1] = Math.round(gg / n);
			out[o + 2] = Math.round(bb / n);
			out[o + 3] = 255;
		}
	}
	return png(size, size, out);
}

mkdirSync(new URL('../static/icons/', import.meta.url), { recursive: true });
const w = (name, size, scale) =>
	writeFileSync(new URL(`../static/icons/${name}`, import.meta.url), render(size, scale));

w('icon-192.png', 192, 0.62);
w('icon-512.png', 512, 0.62);
w('icon-maskable-512.png', 512, 0.52); // extra safe-zone padding for maskable
w('apple-touch-icon-180.png', 180, 0.62);
console.log('icons written to static/icons/');
