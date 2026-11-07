export const COLOR_FIELDS = ['text', 'background', 'accent', 'line', 'nodeFill', 'nodeBorder', 'nodeText',
	'edgeLabelFill', 'edgeLabelText', 'edgeLabelBorder', 'subgraphFill', 'subgraphBorder', 'subgraphText'] as const;
export const WIDTH_FIELDS = ['nodeBorderWidth', 'edgeWidth', 'edgeLabelBorderWidth', 'subgraphBorderWidth'] as const;
export const THEME_FIELDS = [...COLOR_FIELDS, ...WIDTH_FIELDS, 'font', 'monospace', 'labelSize'] as const;
export type ThemeField = typeof THEME_FIELDS[number];

/** Convert validated label sizes to CSS pixels before Pele measures labels. */
export function labelPixels(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const match = /^(\d+(?:\.\d+)?)(px|pt)$/.exec(value);
	if (!match) return undefined;
	const pixels = Number(match[1]) * (match[2] === 'pt' ? 4 / 3 : 1);
	return pixels >= 4 && pixels <= 128 ? pixels : undefined;
}

export function validThemeValue(field: ThemeField, value: string): boolean {
	if (value === '') return true;
	if (field === 'font' || field === 'monospace') {
		const family = /^(?:"[\p{L}\p{N} _.-]+"|'[\p{L}\p{N} _.-]+'|[\p{L}_][\p{L}\p{N} _.-]*)$/u;
		return value.length <= 200 && value.split(',').every(part => family.test(part.trim()));
	}
	if (field === 'labelSize') return labelPixels(value) !== undefined;
	if ((WIDTH_FIELDS as readonly string[]).includes(field)) return /^(\d+(?:\.\d+)?|\.\d+)px$/.test(value) && Number.parseFloat(value) <= 20;
	return /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);
}
