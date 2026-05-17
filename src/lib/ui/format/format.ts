/** Display formatting helpers (ui layer — may use the clock). */
import { formatMoney } from '$lib/domain';
import type { Money } from '$lib/domain';

export function euro(amount: Money): string {
	const negative = amount < 0n;
	const body = formatMoney(negative ? -amount : amount);
	return `${negative ? '−' : ''}€${body}`;
}

/** Signed for cashflow display: +€x in positive colour, −€x in negative. */
export function signedEuro(amount: Money): string {
	if (amount > 0n) return `+€${formatMoney(amount)}`;
	if (amount < 0n) return `−€${formatMoney(-amount)}`;
	return `€${formatMoney(0n)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-05-14" -> "14 May 2026". */
export function formatDate(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	if (!y || !m || !d) return iso;
	return `${d} ${MONTHS[m - 1]} ${y}`;
}

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Section heading for the expense list: Today / Yesterday / absolute. */
export function dateGroupLabel(iso: string): string {
	const today = todayIso();
	if (iso === today) return 'Today';
	const y = new Date(today);
	y.setUTCDate(y.getUTCDate() - 1);
	if (iso === y.toISOString().slice(0, 10)) return 'Yesterday';
	return formatDate(iso);
}

/** Coarse relative time for the ledger list ("2 h ago", "3 d ago"). */
export function relativeTime(iso: string | undefined): string {
	if (!iso) return 'no activity';
	const then = new Date(iso).getTime();
	const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins} min ago`;
	const hrs = Math.round(mins / 60);
	if (hrs < 24) return `${hrs} h ago`;
	const days = Math.round(hrs / 24);
	return `${days} d ago`;
}
