/** Literal sRGB colors only. Never delegate validation to CSS evaluation. */
export function normalizeColor(raw: string): string | null {
	const value = raw.trim().toLowerCase();
	if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/.test(value)) {
		return value.length <= 5 ? '#' + [...value.slice(1)].map(char => char + char).join('') : value;
	}
	const match = /^(rgba?|hsla?)\(([^()]*)\)$/.exec(value);
	if (!match) return null;
	const body = match[2]!;
	let channels: string[]; let alpha: string | undefined;
	if (body.includes(',')) {
		if (body.includes('/')) return null;
		channels = body.split(',').map(part => part.trim());
		if (channels.length === 4) alpha = channels.pop();
	} else {
		const parts = body.split('/');
		if (parts.length > 2) return null;
		channels = parts[0]!.trim().split(/\s+/); alpha = parts[1]?.trim();
	}
	if (channels.length !== 3 || alpha === '') return null;
	const opacity = alpha === undefined ? 1 : component(alpha, 1);
	if (opacity === null) return null;
	let rgb: number[];
	if (match[1]!.startsWith('rgb')) {
		const parsed = channels.map(channel => component(channel, 255));
		if (parsed.some(channel => channel === null)) return null;
		rgb = parsed as number[];
	} else {
		const hue = /^([-+]?(?:\d+(?:\.\d*)?|\.\d+))(deg|turn|rad|grad)?$/.exec(channels[0]!);
		if (!hue || !channels[1]!.endsWith('%') || !channels[2]!.endsWith('%')) return null;
		const saturation = component(channels[1]!, 1); const lightness = component(channels[2]!, 1);
		if (saturation === null || lightness === null) return null;
		const degrees = Number(hue[1]) * ({ deg: 1, turn: 360, rad: 180 / Math.PI, grad: .9 }[hue[2] ?? 'deg'] ?? 1);
		if (!Number.isFinite(degrees)) return null;
		const h = ((degrees % 360) + 360) % 360 / 60;
		const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
		const x = chroma * (1 - Math.abs(h % 2 - 1)); const offset = lightness - chroma / 2;
		const sectors = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
		rgb = sectors[Math.floor(h)]!.map(channel => (channel + offset) * 255);
	}
	return '#' + rgb.map(byte).join('') + (alpha === undefined ? '' : byte(opacity * 255));
}

function component(raw: string, maximum: number): number | null {
	const percent = raw.endsWith('%'); const text = percent ? raw.slice(0, -1) : raw;
	if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
	const value = Number(text); const limit = percent ? 100 : maximum;
	return Number.isFinite(value) && value >= 0 && value <= limit ? value / limit * maximum : null;
}
function byte(value: number): string { return Math.round(value).toString(16).padStart(2, '0'); }
