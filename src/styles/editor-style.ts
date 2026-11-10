import { normalizeColor } from './colors';
import type { ColorPair } from './registry';
import { boundedNumber, isStyleRecord } from './validate';
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
	activeButtonBorder: { variable: '--advanced-mermaid-active-button-border', inherited: '--background-modifier-border' },
	inactiveButtonBorder: { variable: '--advanced-mermaid-inactive-button-border', inherited: '--background-modifier-border' },
	exportButtonBorder: { variable: '--advanced-mermaid-export-button-border', inherited: '--background-modifier-border' },
} as const;
export type EditorColor = keyof typeof EDITOR_COLORS;
export const BUTTON_RADIUS_RANGE = { min: 0, max: 32 } as const;

export interface EditorStyleSettings {
	buttonFontSizePx: number | null;
	buttonRadiusPx: number | null;
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
	const radius = data.buttonRadiusPx;
	return {
		buttonFontSizePx: isEditorFontSize(data.buttonFontSizePx) ? data.buttonFontSizePx : null,
		buttonRadiusPx: boundedNumber(radius, BUTTON_RADIUS_RANGE.min, BUTTON_RADIUS_RANGE.max) && Number.isInteger(radius) ? radius : null,
		colors,
		zoom: normalizeZoomStyle(data.zoom),
	};
}

/** Both theme variants stay on the element; CSS responds to theme switches. */
export function applyEditorStyle(element: HTMLElement, style: EditorStyleSettings): void {
	element.dataset.sourceColorLight = String(!!style.colors.sourceText?.light);
	element.dataset.sourceColorDark = String(!!style.colors.sourceText?.dark);
	applyButtonDimensions(element, style);
	for (const key of Object.keys(EDITOR_COLORS) as EditorColor[]) {
		applyEditorColor(element, key, key.startsWith('closeButton') ? undefined : style.colors[key]);
	}
}

export function applyExportButtonStyle(element: HTMLElement, style: EditorStyleSettings): void {
	applyButtonDimensions(element, style);
	for (const [key, fallback] of [
		['exportButtonText', 'inactiveButtonText'],
		['exportButtonBackground', 'inactiveButtonBackground'],
		['exportButtonBorder', 'inactiveButtonBorder'],
	] as const) {
		applyEditorColor(element, key, { ...style.colors[fallback], ...style.colors[key] });
	}
}

function applyButtonDimensions(element: HTMLElement, style: EditorStyleSettings): void {
	for (const [variable, value] of [
		['--advanced-mermaid-button-font-size', style.buttonFontSizePx],
		['--advanced-mermaid-button-radius', style.buttonRadiusPx],
	] as const) {
		if (value === null) element.style.removeProperty(variable);
		else element.style.setProperty(variable, `${value}px`);
	}
}

function applyEditorColor(element: HTMLElement, key: EditorColor, pair?: ColorPair): void {
	for (const mode of ['light', 'dark'] as const) {
		const variable = `${EDITOR_COLORS[key].variable}-${mode}`;
		const color = pair?.[mode];
		if (color) element.style.setProperty(variable, color);
		else element.style.removeProperty(variable);
	}
}
