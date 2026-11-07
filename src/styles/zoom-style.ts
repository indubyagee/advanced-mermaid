import { normalizeColor } from './colors';
import type { ColorPair } from './registry';
import { isStyleRecord } from './validate';

export const ZOOM_COLORS = {
	border: { variable: '--advanced-mermaid-zoom-border', inherited: '--background-modifier-border' },
	text: { variable: '--advanced-mermaid-zoom-text', inherited: '--text-normal' },
	background: { variable: '--advanced-mermaid-zoom-background', inherited: '--background-primary' },
} as const;
export type ZoomColor = keyof typeof ZOOM_COLORS;
export interface ZoomStyleSettings {
	useGlobal: boolean;
	colors: Partial<Record<ZoomColor, ColorPair>>;
}

export function normalizeZoomStyle(value: unknown): ZoomStyleSettings {
	const data = isStyleRecord(value) ? value : {};
	const colors: ZoomStyleSettings['colors'] = {};
	if (isStyleRecord(data.colors)) for (const key of Object.keys(ZOOM_COLORS) as ZoomColor[]) {
		const saved = data.colors[key]; if (!isStyleRecord(saved)) continue;
		const pair: ColorPair = {};
		for (const mode of ['light', 'dark'] as const) {
			const raw = saved[mode]; const color = typeof raw === 'string' ? normalizeColor(raw) : null;
			if (color) pair[mode] = color;
		}
		if (Object.keys(pair).length) colors[key] = pair;
	}
	return { useGlobal: data.useGlobal === true, colors };
}

/** Apply at each diagram root so Zoom has the same precedence in every view. */
export function applyZoomStyle(element: HTMLElement, style: ZoomStyleSettings): void {
	element.dataset.zoomGlobal = String(style.useGlobal);
	for (const key of Object.keys(ZOOM_COLORS) as ZoomColor[]) for (const mode of ['light', 'dark'] as const) {
		const variable = `${ZOOM_COLORS[key].variable}-${mode}`; const color = style.colors[key]?.[mode];
		if (color) element.style.setProperty(variable, color); else element.style.removeProperty(variable);
	}
}
