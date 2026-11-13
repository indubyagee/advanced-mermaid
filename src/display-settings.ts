export const WIDTH_PRESETS = {
	default: 'Default',
	normal: 'Normal',
	wide: 'Wide',
	maximum: 'Maximum',
	none: 'Full Pane'
} as const;
export const NATIVE_WIDTH_PRESETS = { default: 'Default', full: 'Full' } as const;
export type WidthPreset = keyof typeof WIDTH_PRESETS | keyof typeof NATIVE_WIDTH_PRESETS;

export function availableWidthPreset(value: WidthPreset, minimalEnabled: boolean): WidthPreset {
	if (minimalEnabled) return value === 'full' ? 'none' : value;
	return value === 'none' || value === 'full' ? 'full' : 'default';
}
export const DIAGRAM_WIDTH_RANGES = {
	normalRem: { min: 20, max: 100, fallback: 40, unit: 'rem' },
	wideRem: { min: 20, max: 100, fallback: 50, unit: 'rem' },
	maximumPercent: { min: 70, max: 96, fallback: 88, unit: '%' },
} as const;
export type DiagramWidths = Record<keyof typeof DIAGRAM_WIDTH_RANGES, number>;

export const HEIGHT_PRESETS = {
	auto: 'By orientation',
	short: 'Short (30vh)',
	medium: 'Medium (50vh)',
	tall: 'Tall (75vh)',
	none: 'None'
} as const;

export function isWidthPreset(value: unknown): value is WidthPreset {
	return value === 'full' || typeof value === 'string' && Object.prototype.hasOwnProperty.call(WIDTH_PRESETS, value);
}

/** Concrete lengths remain compatible with previously saved height settings. */
export function parseMaxHeight(value: unknown): string | null {
	if (typeof value !== 'string')
		return null;
	const trimmed = value.trim();
	if (trimmed === 'none')
		return trimmed;
	const match = /^(\d+(?:\.\d+)?|\.\d+)(vh|px|rem)$/.exec(trimmed);
	return match && Number.isFinite(Number(match[1])) && Number(match[1]) > 0 ? trimmed : null;
}

export function parseHeightSetting(value: unknown): string | null {
	if (typeof value !== 'string')
		return null;
	const trimmed = value.trim();
	return Object.prototype.hasOwnProperty.call(HEIGHT_PRESETS, trimmed) ? trimmed : parseMaxHeight(trimmed);
}
