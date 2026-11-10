import { normalizeColor } from './colors';
import { boundedNumber, isStyleRecord, type StyleIssue } from './validate';

export interface PresetClass { alias: string; text?: string; fill?: string; stroke?: string; width?: number }
export const PRESET_CATEGORIES = ['flowchart', 'state', 'agentflow', 'mindmap', 'treeView', 'treemap'] as const;

/** New arrays and entries prevent settings sessions from sharing mutable defaults. */
export function defaultPresets(): PresetClass[] {
	return [
		{ alias: 'PRESET1', fill: '#808080', stroke: '#202020', text: '#000000' },
		{ alias: 'PRESET2', fill: '#151515', stroke: '#505050', text: '#ffffff' },
		{ alias: 'PRESET3', fill: '#2d4646', stroke: '#608f94', text: '#ffffff' },
		{ alias: 'PRESET4', fill: '#32411e', stroke: '#69823c', text: '#ffffff' },
		{ alias: 'PRESET5', fill: '#501e1e', stroke: '#b24c4c', text: '#ffffff' },
		{ alias: 'PRESET6', fill: '#46375a', stroke: '#886fad', text: '#ffffff' },
		{ alias: 'PRESET7', fill: '#6e5a28', stroke: '#dab352', text: '#ffffff' },
		{ alias: 'PRESET8', fill: '#5a3250', stroke: '#915082', text: '#ffffff' },

		{ alias: 'CATEGORY1', fill: '#22466dff', stroke: '#71a5d9ff', text: '#ffffffff' },
		{ alias: 'CATEGORY2', fill: '#67401fff', stroke: '#d79860ff', text: '#ffffffff' },
		{ alias: 'CATEGORY3', fill: '#254f3dff', stroke: '#72b898ff', text: '#ffffffff' },
		{ alias: 'CATEGORY4', fill: '#4e386cff', stroke: '#b396deff', text: '#ffffffff' },
		{ alias: 'CATEGORY5', fill: '#5c4d20ff', stroke: '#c9ae56ff', text: '#ffffffff' },
		{ alias: 'CATEGORY6', fill: '#6a3834ff', stroke: '#d68c82ff', text: '#ffffffff' },
		{ alias: 'CATEGORY7', fill: '#1d4f58ff', stroke: '#68b7c2ff', text: '#ffffffff' },
		{ alias: 'CATEGORY8', fill: '#623653ff', stroke: '#cf88b6ff', text: '#ffffffff' },

		{ alias: 'HIGHLIGHT', fill: '#603060', stroke: '#805080' },

		{ alias: 'PRIMARYHIGHLIGHT', fill: '#30606040', stroke: '#508080' },
		{ alias: 'SECONDARYHIGHLIGHT', fill: '#60303040', stroke: '#805050' },
		{ alias: 'TERTIARYHIGHLIGHT', fill: '#60603040', stroke: '#808050' },
		{ alias: 'PRIMARYNOTE', fill: '#00000000', stroke: '#306060' },
		{ alias: 'SECONDARYNOTE', fill: '#00000000', stroke: '#603030' },
		{ alias: 'TERTIARYNOTE', fill: '#00000000', stroke: '#606030' },

		{ alias: 'NOTE', fill: '#20202040', stroke: '#505050' },
		{ alias: 'SUBNOTE', fill: '#00000000', stroke: '#202020' },

		{ alias: 'SUCCESS', fill: '#32411eff', stroke: '#69823cff', text: '#ffffffff' },
		{ alias: 'WARNING', fill: '#6e5a28ff', stroke: '#dab352ff', text: '#ffffffff' },
		{ alias: 'FAILURE', fill: '#501e1eff', stroke: '#b24c4cff', text: '#ffffffff' },
		{ alias: 'PENDING', fill: '#42434eff', stroke: '#9a9bacff', text: '#e9ebf0ff' },
		{ alias: 'ACTIVE', fill: '#163d63ff', stroke: '#68aae9ff', text: '#ffffffff' },
		{ alias: 'BLOCKED', fill: '#5b341dff', stroke: '#dd955aff', text: '#ffffffff' },
		{ alias: 'DONE', fill: '#36464aff', stroke: '#8fa6aaff', text: '#f2f6f6ff' },
		{ alias: 'MILESTONE', fill: '#4c365fff', stroke: '#d1adeaff', text: '#fff4ffff' },
		{ alias: 'DANGER', fill: '#740c22ff', stroke: '#ff7c92ff', text: '#ffffffff' },
		{ alias: 'INPUT', fill: '#1c4356ff', stroke: '#75bdd8ff', text: '#f1faffff' },
		{ alias: 'OUTPUT', fill: '#512844ff', stroke: '#d892c2ff', text: '#fff2faff' },
		{ alias: 'DECISION', fill: '#362d63ff', stroke: '#ae9cebff', text: '#f6f2ffff' },
		{ alias: 'GROUP', fill: '#242b33ff', stroke: '#748799ff', text: '#e8eef4ff' },
		{ alias: 'REFERENCE', fill: '#2b3a53ff', stroke: '#98afdaff', text: '#eef4ffff' },
		{ alias: 'MUTED', fill: '#34363aff', stroke: '#80858dff', text: '#c7ccd3ff' },

		{ alias: 'YES', width: 2 },
		{ alias: 'NO', fill: '#00000000' },
	];
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
