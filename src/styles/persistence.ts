import { labelPixels, type ThemeField } from '../legacy-theme';
import { COLOR_TOKENS, COMPATIBILITY_CONTROLS, DIAGRAM_CATEGORIES, emptyStyleProfile, type ColorToken, type StyleProfile, type TypeStyleProfile, type DiagramCategory } from './registry';
import { isStyleRecord, validateStyleProfile } from './validate';
import { normalizeFrontmatter } from './frontmatter';
import { isEditorFontSize, normalizeEditorStyle, type EditorStyleSettings } from './editor-style';
export { isEditorFontSize } from './editor-style';

export interface StyleSettings {
	followObsidianTheme: boolean;
	// Serialized profile field; this is not the global object.
	global: StyleProfile;
	diagrams: Partial<Record<DiagramCategory, TypeStyleProfile>>;
}

export function migrateTheme(theme: Partial<Record<ThemeField, string>>): StyleProfile {
	const profile = emptyStyleProfile();
	for (const [key, value] of Object.entries(theme)) {
		if (!value) continue;
		if (Object.prototype.hasOwnProperty.call(COLOR_TOKENS, key)) profile.colors[key as ColorToken] = { light: value, dark: value };
		else if (Object.prototype.hasOwnProperty.call(COMPATIBILITY_CONTROLS, key)) {
			const id = key as keyof typeof COMPATIBILITY_CONTROLS;
			profile.elements[id] = COMPATIBILITY_CONTROLS[id].kind === 'width' ? Number.parseFloat(value) : { light: value, dark: value };
		} else if (key === 'font' || key === 'monospace') profile[key] = value;
		else if (key === 'labelSize') profile.labelSizePx = labelPixels(value);
	}
	return profile;
}

export function normalizeStyleSettings(value: unknown, legacy?: Partial<Record<ThemeField, string>>): StyleSettings {
	const data = isStyleRecord(value) ? value : {};
	const diagrams: StyleSettings['diagrams'] = {};
	if (isStyleRecord(data.diagrams)) for (const key of DIAGRAM_CATEGORIES) {
		const saved = data.diagrams[key];
		if (!isStyleRecord(saved)) continue;
		diagrams[key] = { useGlobal: saved.useGlobal !== false, overrides: validateStyleProfile(saved.overrides).profile };
		if (saved.frontmatter !== undefined) diagrams[key].frontmatter = normalizeFrontmatter(saved.frontmatter);
	}
	return {
		followObsidianTheme: data.followObsidianTheme !== false,
		global: legacy ? migrateTheme(legacy) : validateStyleProfile(data.global).profile,
		diagrams,
	};
}

export interface LiveEditorSettings {
	enabled: boolean; activation: 'manual' | 'focused-block'; layout: 'auto' | 'side-by-side' | 'stacked';
	debounceMs: number; lineNumbers: boolean; wrapSource: boolean;
	/** Null preserves the vault's inherited editor text size. */
	fontSizePx: number | null;
	style: EditorStyleSettings;
}
export function normalizeLiveEditor(value: unknown): LiveEditorSettings {
	const data = isStyleRecord(value) ? value : {};
	return {
		enabled: data.enabled !== false, activation: data.activation === 'focused-block' ? 'focused-block' : 'manual',
		layout: data.layout === 'side-by-side' || data.layout === 'stacked' ? data.layout : 'auto',
		debounceMs: typeof data.debounceMs === 'number' && Number.isInteger(data.debounceMs) && data.debounceMs >= 100 && data.debounceMs <= 1000 ? data.debounceMs : 250,
		lineNumbers: data.lineNumbers !== false, wrapSource: data.wrapSource === true,
		fontSizePx: data.fontSizePx === undefined ? 10 : isEditorFontSize(data.fontSizePx) ? data.fontSizePx : null,
		style: normalizeEditorStyle(data.style),
	};
}
