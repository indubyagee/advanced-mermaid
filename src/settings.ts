import { isWidthPreset, parseHeightSetting, parseMaxHeight, type WidthPreset } from './display-settings';
export { parseMaxHeight } from './display-settings';

export type Alignment = 'left' | 'center' | 'right';
import { THEME_FIELDS, validThemeValue, type ThemeField } from './legacy-theme';
export { COLOR_FIELDS, WIDTH_FIELDS, THEME_FIELDS, validThemeValue, labelPixels, type ThemeField } from './legacy-theme';
import { normalizeStyleSettings, normalizeLiveEditor, type StyleSettings, type LiveEditorSettings } from './styles/persistence';
import { isStyleRecord } from './styles/validate';
import { defaultPresets, validatePresets, type PresetClass } from './styles/presets';

export const SETTINGS_SCHEMA_VERSION = 4;

export function isFutureSettingsSchema(value: unknown): boolean {
	return isStyleRecord(value) && typeof value.schemaVersion === 'number' && value.schemaVersion > SETTINGS_SCHEMA_VERSION;
}

export interface AdvancedMermaidSettings {
	schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
	presets: PresetClass[];
	alignment: Alignment;
	maxWidth: WidthPreset;
	maxHeight: string;
	maintainAspectRatio: boolean;
	fillAvailable: boolean;
	/** Retained compatibility record for previous plugin versions. */
	theme: Partial<Record<ThemeField, string>>;
	style: StyleSettings;
	liveEditor: LiveEditorSettings;
}

export const DEFAULT_SETTINGS: Readonly<AdvancedMermaidSettings> = {
	schemaVersion: SETTINGS_SCHEMA_VERSION,
	presets: defaultPresets(),
	alignment: 'center',
	maxWidth: 'auto',
	maxHeight: 'auto',
	maintainAspectRatio: true,
	fillAvailable: true,
	theme: {},
	style: normalizeStyleSettings(undefined),
	liveEditor: normalizeLiveEditor(undefined),
};

export function isAlignment(value: unknown): value is Alignment {
	return value === 'left' || value === 'center' || value === 'right';
}

export function normalizeSettings(value: unknown): AdvancedMermaidSettings {
	const data = isStyleRecord(value) ? value : {};
	const theme: AdvancedMermaidSettings['theme'] = {};
	if (isStyleRecord(data.theme)) {
		const saved = data.theme;
		for (const field of THEME_FIELDS) {
			const candidate = saved[field] ?? (field === 'text' ? saved.foreground : undefined);
			if (typeof candidate === 'string' && validThemeValue(field, candidate.trim())) theme[field] = candidate.trim();
		}
	}
	const legacy = data.schemaVersion === undefined && isAlignment(data.alignment) && parseMaxHeight(data.maxHeight) !== null;
	return {
		...DEFAULT_SETTINGS,
		presets: Array.isArray(data.presets) ? validatePresets(data.presets).presets : defaultPresets(),
		alignment: isAlignment(data.alignment) ? data.alignment : DEFAULT_SETTINGS.alignment,
		maxWidth: isWidthPreset(data.maxWidth) ? data.maxWidth : DEFAULT_SETTINGS.maxWidth,
		maxHeight: parseHeightSetting(data.maxHeight) ?? DEFAULT_SETTINGS.maxHeight,
		maintainAspectRatio: typeof data.maintainAspectRatio === 'boolean' ? data.maintainAspectRatio : true,
		fillAvailable: typeof data.fillAvailable === 'boolean' ? data.fillAvailable : !legacy,
		theme,
		style: normalizeStyleSettings(data.style, typeof data.schemaVersion !== 'number' || data.schemaVersion < 3 ? theme : undefined),
		liveEditor: normalizeLiveEditor(data.liveEditor),
	};
}
