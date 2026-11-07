import { normalizeColor } from './colors';
import type { ColorPair } from './registry';
import { isStyleRecord } from './validate';
import { normalizeZoomStyle, type ZoomStyleSettings } from './zoom-style';

/** Shared keys keep saved preferences, settings controls and scoped CSS aligned. */
export const EDITOR_COLORS = {
	sourceText: { variable: '--advanced-mermaid-source-text', inherited: '--text-normal' },
	sourceBackground: { variable: '--advanced-mermaid-source-background', inherited: '--background-primary' },
	activeButtonText: { variable: '--advanced-mermaid-active-button-text', inherited: '--text-on-accent' },
	inactiveButtonText: { variable: '--advanced-mermaid-inactive-button-text', inherited: '--text-normal' },
	/** Retained for saved-data round trips; Close Editor is no longer exposed. */
	closeButtonText: { variable: '--advanced-mermaid-close-button-text', inherited: '--text-normal' },
	exportButtonText: { variable: '--advanced-mermaid-export-button-text', inherited: '--text-normal' },
	activeButtonBackground: { variable: '--advanced-mermaid-active-button-background', inherited: '--interactive-accent' },
	inactiveButtonBackground: { variable: '--advanced-mermaid-inactive-button-background', inherited: '--interactive-normal' },
	closeButtonBackground: { variable: '--advanced-mermaid-close-button-background', inherited: '--interactive-normal' },
	exportButtonBackground: { variable: '--advanced-mermaid-export-button-background', inherited: '--interactive-normal' },
} as const;
export type EditorColor = keyof typeof EDITOR_COLORS;
export interface EditorStyleSettings {
	buttonFontSizePx: number | null;
	colors: Partial<Record<EditorColor, ColorPair>>;
	zoom: ZoomStyleSettings;
}

export function isEditorFontSize(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 8 && value <= 40;
}

export function normalizeEditorStyle(value: unknown): EditorStyleSettings {
	const data = isStyleRecord(value) ? value : {};
	const colors: EditorStyleSettings['colors'] = {};
	if (isStyleRecord(data.colors)) for (const key of Object.keys(EDITOR_COLORS) as EditorColor[]) {
		const saved = data.colors[key]; if (!isStyleRecord(saved)) continue;
		const pair: ColorPair = {};
		for (const mode of ['light', 'dark'] as const) {
			const raw = saved[mode]; const color = typeof raw === 'string' ? normalizeColor(raw) : null;
			if (color) pair[mode] = color;
		}
		if (Object.keys(pair).length) colors[key] = pair;
	}
	return { buttonFontSizePx: isEditorFontSize(data.buttonFontSizePx) ? data.buttonFontSizePx : null, colors, zoom: normalizeZoomStyle(data.zoom) };
}

/** Both theme variants stay on the element; CSS responds to theme switches. */
export function applyEditorStyle(element: HTMLElement, style: EditorStyleSettings): void {
	element.dataset.sourceColorLight = String(!!style.colors.sourceText?.light);
	element.dataset.sourceColorDark = String(!!style.colors.sourceText?.dark);
	const size = style.buttonFontSizePx;
	if (size === null) element.style.removeProperty('--advanced-mermaid-button-font-size');
	else element.style.setProperty('--advanced-mermaid-button-font-size', `${size}px`);
	for (const key of Object.keys(EDITOR_COLORS) as EditorColor[]) for (const mode of ['light', 'dark'] as const) {
		const variable = `${EDITOR_COLORS[key].variable}-${mode}`; const color = style.colors[key]?.[mode];
		if (color && !key.startsWith('closeButton')) element.style.setProperty(variable, color);
		else element.style.removeProperty(variable);
	}
}
