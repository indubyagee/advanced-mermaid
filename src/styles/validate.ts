import { validThemeValue } from '../legacy-theme';
import {
	COLOR_TOKENS, ELEMENT_CONTROLS, emptyStyleProfile,
	type ColorPair, type ColorToken, type ElementControlId, type FontWeight, type StyleProfile,
} from './registry';

export interface StyleIssue { path: string; message: string }
export interface ProfileValidation { profile: StyleProfile; issues: StyleIssue[] }

/** Accept JSON-like own data only; inherited fields and accessors are not settings. */
export function isStyleRecord(value: unknown): value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const prototype: unknown = Object.getPrototypeOf(value);
	return (prototype === Object.prototype || prototype === null)
		&& Object.values(Object.getOwnPropertyDescriptors(value)).every(field => 'value' in field);
}

export function validStyleColor(value: unknown): value is string {
	return typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value.trim());
}

export function validStyleFont(value: unknown): value is string {
	return typeof value === 'string' && value.trim() !== '' && validThemeValue('font', value.trim());
}

export function boundedNumber(value: unknown, minimum: number, maximum: number): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function validStyleWeight(value: unknown): value is FontWeight {
	return boundedNumber(value, 400, 900) && value % 100 === 0;
}

/** Return accepted fields plus diagnostics. Interactive editors must not commit a
 * draft with issues; saved-data migration may recover independently valid fields.
 */
export function validateStyleProfile(value: unknown): ProfileValidation {
	const profile = emptyStyleProfile();
	const issues: StyleIssue[] = [];
	const issue = (path: string, message: string): void => { issues.push({ path, message }); };
	if (value === undefined || value === null) return { profile, issues };
	if (!isStyleRecord(value)) {
		issue('', 'Expected a plain style profile.');
		return { profile, issues };
	}
	const fields = ['colors', 'elements', 'font', 'monospace', 'radiusPx', 'labelSizePx', 'titleWeight', 'headingWeight', 'boldWeight'];
	for (const key of Object.keys(value)) if (!fields.includes(key)) issue(key, 'Unknown style field.');
	const pairs = (candidate: unknown, path: string): ColorPair | undefined => {
		if (!isStyleRecord(candidate)) { issue(path, 'Expected Light/Dark colors.'); return undefined; }
		const pair: ColorPair = {};
		for (const [mode, color] of Object.entries(candidate)) {
			if (mode !== 'light' && mode !== 'dark') { issue(`${path}.${mode}`, 'Unknown theme mode.'); continue; }
			if (color === undefined || (typeof color === 'string' && color.trim() === '')) continue;
			if (validStyleColor(color)) pair[mode] = color.trim();
			else issue(`${path}.${mode}`, 'Use a hex color, or empty to inherit.');
		}
		return Object.keys(pair).length ? pair : undefined;
	};
	if (value.colors !== undefined) {
		if (!isStyleRecord(value.colors)) issue('colors', 'Expected a color map.');
		else for (const [key, candidate] of Object.entries(value.colors)) {
			if (!Object.prototype.hasOwnProperty.call(COLOR_TOKENS, key)) { issue(`colors.${key}`, 'Unknown color token.'); continue; }
			if (candidate === undefined) continue;
			const pair = pairs(candidate, `colors.${key}`);
			if (pair) profile.colors[key as ColorToken] = pair;
		}
	}
	if (value.elements !== undefined) {
		if (!isStyleRecord(value.elements)) issue('elements', 'Expected an element map.');
		else for (const [key, candidate] of Object.entries(value.elements)) {
			if (!Object.prototype.hasOwnProperty.call(ELEMENT_CONTROLS, key)) { issue(`elements.${key}`, 'Unknown element control.'); continue; }
			if (candidate === undefined) continue;
			const id = key as ElementControlId;
			if (ELEMENT_CONTROLS[id].kind === 'color') {
				const pair = pairs(candidate, `elements.${key}`);
				if (pair) profile.elements[id] = pair;
			} else if (candidate !== undefined) {
				if (boundedNumber(candidate, 0, 20)) profile.elements[id] = candidate;
				else issue(`elements.${key}`, 'Use a width from 0 to 20 CSS px.');
			}
		}
	}
	for (const field of ['font', 'monospace'] as const) {
		const candidate = value[field];
		if (candidate === undefined || (typeof candidate === 'string' && candidate.trim() === '')) continue;
		if (validStyleFont(candidate)) profile[field] = candidate.trim();
		else issue(field, 'Use local font family names and generic fallbacks.');
	}
	for (const [field, minimum, maximum] of [['radiusPx', 0, 32], ['labelSizePx', 4, 128]] as const) {
		const candidate = value[field];
		if (candidate === undefined) continue;
		if (boundedNumber(candidate, minimum, maximum)) profile[field] = candidate;
		else issue(field, `Use a value from ${minimum} to ${maximum} CSS px.`);
	}
	for (const field of ['titleWeight', 'headingWeight', 'boldWeight'] as const) {
		const candidate = value[field];
		if (candidate === undefined) continue;
		if (validStyleWeight(candidate)) profile[field] = candidate;
		else issue(field, 'Use 400, 500, 600, 700, 800, or 900.');
	}
	return { profile, issues };
}
