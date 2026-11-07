import { normalizeColor } from './colors';
import { boundedNumber, isStyleRecord, type StyleIssue } from './validate';

export interface PresetClass { alias: string; text?: string; fill?: string; stroke?: string; width?: number }
export const PRESET_CATEGORIES = ['flowchart', 'state', 'agentflow', 'mindmap', 'treeView', 'treemap'] as const;

/** New arrays and entries prevent settings sessions from sharing mutable defaults. */
export function defaultPresets(): PresetClass[] {
	return [
		['DEFAULT', '#808080', '#202020', '#000000'], ['ALT', '#151515', '#505050', '#ffffff'],
		['ALT1', '#2D4646', '#608F94', '#ffffff'], ['ALT2', '#32411E', '#69823C', '#ffffff'],
		['ALT3', '#501E1E', '#B24C4C', '#ffffff'], ['ALT4', '#46375A', '#886FAD', '#ffffff'],
		['ALT5', '#6E5A28', '#DAB352', '#ffffff'], ['ALT6', '#5A3250', '#915082', '#ffffff'],
	].map(([alias, fill, stroke, text]) => ({ alias: alias!, fill: fill!.toLowerCase(), stroke: stroke!.toLowerCase(), text: text! }));
}

export function validPresetAlias(alias: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(alias)
		&& !/^(?:default|pele|__proto__|prototype|constructor)$/.test(alias) && !/^(?:pele-|theme-)/.test(alias);
}

export function validatePresets(value: unknown): { presets: PresetClass[]; issues: StyleIssue[] } {
	const presets: PresetClass[] = []; const issues: StyleIssue[] = []; const aliases = new Set<string>();
	if (!Array.isArray(value)) return { presets, issues: [{ path: 'preset', message: 'Expected a preset list.' }] };
	for (const [index, item] of value.entries()) {
		const path = `preset.${index}`; const before = issues.length;
		if (!isStyleRecord(item)) { issues.push({ path, message: 'Expected a plain preset entry.' }); continue; }
		for (const key of Object.keys(item)) if (!['alias', 'text', 'fill', 'stroke', 'width'].includes(key)) issues.push({ path: `${path}.${key}`, message: 'Unknown preset field.' });
		if (typeof item.alias !== 'string' || !validPresetAlias(item.alias)) { issues.push({ path: `${path}.alias`, message: 'Use a unique identifier of 1–64 letters, digits, underscores or hyphens; renderer names are reserved.' }); continue; }
		if (aliases.has(item.alias)) { issues.push({ path: `${path}.alias`, message: 'Duplicate preset alias.' }); continue; }
		aliases.add(item.alias);
		const preset: PresetClass = { alias: item.alias };
		for (const key of ['text', 'fill', 'stroke'] as const) {
			if (item[key] === undefined || item[key] === '') continue;
			const color = typeof item[key] === 'string' ? normalizeColor(item[key]) : null;
			if (color) preset[key] = color; else issues.push({ path: `${path}.${key}`, message: 'Use a literal hex, RGB or HSL color.' });
		}
		if (item.width !== undefined) {
			if (boundedNumber(item.width, 0, 20)) preset.width = item.width;
			else issues.push({ path: `${path}.width`, message: 'Use a stroke width from 0 to 20 px.' });
		}
		if (issues.length === before) presets.push(preset);
	}
	return { presets, issues };
}

export class PresetTextError extends Error {
	constructor(message: string, readonly line: number) { super(`Line ${line}: ${message}`); this.name = 'PresetTextError'; }
}

/** The documented preset subset, not general YAML. Bare # colors are literals. */
export function decodePresets(text: string): PresetClass[] {
	if (text.length > 100000) throw new PresetTextError('Preset text exceeds 100,000 characters.', 1);
	const lines = text.split(/\r?\n/); const entries: Record<string, unknown>[] = [];
	let root = false; let empty = false; let entry: Record<string, unknown> | undefined;
	for (const [index, line] of lines.entries()) {
		if (!line.trim() || /^\s*#/.test(line)) continue;
		if (!root) {
			if (!/^preset:\s*(?:\[\])?\s*$/.test(line)) throw new PresetTextError('Start with preset: followed by a list.', index + 1);
			root = true; empty = line.includes('[]'); continue;
		}
		if (empty) throw new PresetTextError('Use either preset: [] or a preset list, not both.', index + 1);
		const start = /^ {2}- alias:\s*(.*?)\s*$/.exec(line);
		if (start) { entry = { alias: scalar(start[1]!, index + 1) }; entries.push(entry); continue; }
		const field = /^ {4}(text|fill|stroke|width):\s*(.*?)\s*$/.exec(line);
		if (!entry || !field) throw new PresetTextError('Use a two-space alias entry and four-space text, fill, stroke or width fields.', index + 1);
		const key = field[1]!;
		if (Object.prototype.hasOwnProperty.call(entry, key)) throw new PresetTextError('Remove the repeated ' + key + ' field.', index + 1);
		const value = scalar(field[2]!, index + 1);
		entry[key] = key === 'width' && value !== '' ? (/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value) ? Number.parseFloat(value) : NaN) : value || undefined;
	}
	if (!root) throw new PresetTextError('Start with preset:.', 1);
	const result = validatePresets(entries);
	if (result.issues.length) {
		const issue = result.issues[0]!; const entryIndex = Number(issue.path.split('.')[1]);
		const starts = lines.map((line, index) => /^ {2}- alias:/.test(line) ? index + 1 : 0).filter(Boolean);
		throw new PresetTextError(issue.message, starts[entryIndex] ?? 1);
	}
	return result.presets;
}

function scalar(value: string, line: number): string {
	if (value.startsWith('"')) {
		try { const parsed: unknown = JSON.parse(value); if (typeof parsed === 'string') return parsed; } catch { /* Report the source line below. */ }
		throw new PresetTextError('Complete the quoted value.', line);
	}
	if (value.startsWith("'")) {
		if (!/^'(?:[^']|'')*'$/.test(value)) throw new PresetTextError('Complete the quoted value.', line);
		return value.slice(1, -1).replace(/''/g, "'");
	}
	return value;
}

export function encodePresets(presets: readonly PresetClass[]): string {
	if (!presets.length) return 'preset: []';
	return 'preset:\n' + presets.map(preset => [
		'  - alias: ' + preset.alias,
		...(['fill', 'stroke', 'text'] as const).flatMap(key => preset[key] === undefined ? [] : [`    ${key}: ${JSON.stringify(preset[key])}`]),
		...(preset.width === undefined ? [] : [`    width: ${preset.width}px`]),
	].join('\n')).join('\n');
}
