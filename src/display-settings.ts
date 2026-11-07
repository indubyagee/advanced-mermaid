export const WIDTH_PRESETS = { auto: 'By orientation', normal: 'Normal (700 px)', wide: 'Wide (1000 px)', maximum: 'Maximum (1400 px)', none: 'Full pane' } as const;
export type WidthPreset = keyof typeof WIDTH_PRESETS;
export const WIDTH_LIMITS = { normal: 700, wide: 1000, maximum: 1400 } as const;
export const HEIGHT_PRESETS = { auto: 'By orientation', short: 'Short (30vh)', medium: 'Medium (50vh)', tall: 'Tall (75vh)', none: 'None' } as const;

export function isWidthPreset(value: unknown): value is WidthPreset {
	return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WIDTH_PRESETS, value);
}

/** Concrete lengths remain compatible with previously saved height settings. */
export function parseMaxHeight(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (trimmed === 'none') return trimmed;
	const match = /^(\d+(?:\.\d+)?|\.\d+)(vh|px|rem)$/.exec(trimmed);
	return match && Number.isFinite(Number(match[1])) && Number(match[1]) > 0 ? trimmed : null;
}

export function parseHeightSetting(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return Object.prototype.hasOwnProperty.call(HEIGHT_PRESETS, trimmed) ? trimmed : parseMaxHeight(trimmed);
}
