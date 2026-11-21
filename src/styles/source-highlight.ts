import { normalizeColor } from './colors';
import type { ColorPair } from './registry';
import { isStyleRecord } from './validate';

export const SOURCE_HIGHLIGHTS = {
	declaration: { label: 'Diagram declaration', light: '#0550ae', dark: '#79c0ff', selector: '.am-source-declaration, .cm-declaration', weight: 700 },
	keyword: { label: 'Keyword', light: '#8250df', dark: '#d2a8ff', selector: '.am-source-keyword, .cm-keyword' },
	operator: { label: 'Operator', light: '#9a3412', dark: '#ffa657', selector: '.am-source-operator, .cm-operator' },
	string: { label: 'String', light: '#116329', dark: '#7ee787', selector: '.am-source-string, .cm-string' },
	comment: { label: 'Comment', light: '#57606a', dark: '#9da7b3', selector: '.am-source-comment, .cm-comment', italic: true },
	frontmatter: { label: 'Frontmatter', light: '#0e6975', dark: '#76d9e6', selector: '.am-source-frontmatter, .cm-frontmatter' },
	directive: { label: 'Directive', light: '#95386f', dark: '#ff9bce', selector: '.am-source-directive, .cm-directive' },
	number: { label: 'Number and color literal', light: '#754b00', dark: '#e3c46d', selector: '.am-source-number, .cm-number, .cm-atom' },
	property: { label: 'CSS property', light: '#754b00', dark: '#e3c46d', selector: '.am-source-property, .cm-property' },
} satisfies Record<string, { label: string; light: string; dark: string; selector: string; weight?: number; italic?: boolean }>;

export type SourceHighlightToken = keyof typeof SOURCE_HIGHLIGHTS;
export const SOURCE_HIGHLIGHT_TOKENS = Object.keys(SOURCE_HIGHLIGHTS) as SourceHighlightToken[];
export const SOURCE_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type SourceWeight = typeof SOURCE_WEIGHTS[number];
export type SourceHighlightSettings = Partial<Record<SourceHighlightToken, { colors?: ColorPair; weight?: SourceWeight }>>;
const themeModes = ['light', 'dark'] as const;

export function isSourceWeight(value: unknown): value is SourceWeight {
	return SOURCE_WEIGHTS.some(weight => weight === value);
}

export function normalizeSourceHighlights(value: unknown): SourceHighlightSettings {
	const result: SourceHighlightSettings = {};
	if (!isStyleRecord(value)) return result;
	for (const token of SOURCE_HIGHLIGHT_TOKENS) {
		const saved = value[token];
		if (!isStyleRecord(saved)) continue;
		const colors: ColorPair = {};
		const raw = saved.colors;
		if (isStyleRecord(raw)) for (const mode of themeModes) {
			const input = raw[mode];
			const color = typeof input === 'string' ? normalizeColor(input) : null;
			if (color) colors[mode] = color;
		}
		const weight = isSourceWeight(saved.weight) ? saved.weight : undefined;
		const hasColors = colors.light !== undefined || colors.dark !== undefined;
		if (hasColors || weight !== undefined) result[token] = { ...(hasColors ? { colors } : {}), ...(weight !== undefined ? { weight } : {}) };
	}
	return result;
}

export function applySourceHighlights(element: HTMLElement, highlights: SourceHighlightSettings): void {
	for (const token of SOURCE_HIGHLIGHT_TOKENS) {
		const style = highlights[token];
		for (const mode of themeModes) {
			const fallback = SOURCE_HIGHLIGHTS[token][mode];
			element.style.setProperty(`--am-highlight-${token}-${mode}`, style?.colors?.[mode] ?? `var(--advanced-mermaid-source-token-color, ${fallback})`);
		}
		const variable = `--am-highlight-${token}-weight`;
		if (style?.weight === undefined) element.style.removeProperty(variable);
		else element.style.setProperty(variable, String(style.weight));
	}
}
