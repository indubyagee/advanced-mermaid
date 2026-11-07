import { DEFAULT_SETTINGS } from '../settings';
import { resolveDisplay } from '../rendering/overrides';
import { decodeLocalStyle, encodeLocalStyle, frontmatterEnd, parseStyleCss, styleRegion, type StyleRegion } from '../styles/local-codec';

export type DisplayOverrideKey = 'align' | 'max-width' | 'max-height' | 'aspect-ratio' | 'fill';
export type StyleTarget = 'both' | 'light' | 'dark';
export interface OverrideInsertion { source: string; from: number; to: number; changed: boolean }
const result = (source: string, from: number, value: string, changed: boolean): OverrideInsertion => ({ source, from, to: from + value.length, changed });

/** Insert exactly one missing header key, or select the already-authored value. */
export function insertDisplayOverride(source: string, key: DisplayOverrideKey, value: string): OverrideInsertion {
	resolveDisplay(source, { ...DEFAULT_SETTINGS });
	if (!['align', 'max-width', 'max-height', 'aspect-ratio', 'fill'].includes(key)) throw new Error('Unknown display override.');
	resolveDisplay(`%% advanced-mermaid: ${key}=${value}\nflowchart LR`, { ...DEFAULT_SETTINGS });
	const offset = frontmatterEnd(source, true); const eol = source.includes('\r\n') ? '\r\n' : '\n';
	for (const line of source.slice(offset).matchAll(/[^\n]*(?:\n|$)/g)) {
		const text = line[0].replace(/\r?\n$/, ''); const trimmed = text.trim();
		if (!trimmed) continue; if (!trimmed.startsWith('%%')) break;
		if (!trimmed.startsWith('%% advanced-mermaid:')) continue;
		const assignment = new RegExp('(?:^|\\s)' + key + '=([^\\s=]+)').exec(text);
		const start = offset + line.index;
		if (assignment) return result(source, start + assignment.index + assignment[0].length - assignment[1]!.length, assignment[1]!, false);
		const at = start + text.trimEnd().length; const insert = ` ${key}=${value}`;
		const updated = source.slice(0, at) + insert + source.slice(at);
		return result(updated, at + insert.length - value.length, value, true);
	}
	const prefix = offset && !source.slice(0, offset).endsWith('\n') ? eol : '';
	const insert = prefix + `%% advanced-mermaid: ${key}=${value}` + eol;
	return result(source.slice(0, offset) + insert + source.slice(offset), offset + insert.length - eol.length - value.length, value, true);
}

interface Declaration { from: number; value: string }
function cssDeclaration(css: string, selector: string, variable: string): { found?: Declaration; closing?: number } {
	const clean = css.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\r\n]/g, ' '));
	let found: Declaration | undefined; let closing: number | undefined;
	for (const block of clean.matchAll(/(\.pele|\.theme-light\s+\.pele|\.theme-dark\s+\.pele)\s*\{([^{}]*)\}/g)) {
		if (block[1]!.replace(/\s+/g, ' ') !== selector) continue;
		const bodyStart = block.index + block[0].indexOf('{') + 1; closing = block.index + block[0].lastIndexOf('}');
		for (const item of block[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+?)(?=\s*(?:;|$))/g)) {
			if (item[1] !== variable) continue;
			const value = item[2]!.trim(); found = { from: bodyStart + item.index + item[0].indexOf(item[2]!) + item[2]!.indexOf(value), value };
		}
	}
	return { found, closing };
}
function sourcePosition(source: string, region: StyleRegion, css: string, offset: number): number {
	const before = css.slice(0, offset); const row = before.split('\n').length - 1; const column = before.length - before.lastIndexOf('\n') - 1;
	const lines = [...source.slice(region.from).matchAll(/[^\n]*(?:\n|$)/g)]; const line = lines[row + 1]!;
	return region.from + line.index + (line[0].startsWith('%% ') ? 3 : 2) + column;
}

/** The CSS parser validates both the existing draft and the inserted literal. */
export function insertStyleOverride(source: string, variable: string, value: string, target: StyleTarget): OverrideInsertion {
	if (!['both', 'light', 'dark'].includes(target)) throw new Error('Unknown style target.');
	if (!/^--[a-zA-Z0-9-]+$/.test(variable)) throw new Error('Unknown style variable.');
	const selector = target === 'both' ? '.pele' : `.theme-${target} .pele`;
	parseStyleCss(`${selector} { ${variable}: ${value}; }`, 'light'); parseStyleCss(`${selector} { ${variable}: ${value}; }`, 'dark');
	const decoded = decodeLocalStyle(source, 'light'); decodeLocalStyle(source, 'dark');
	const existing = cssDeclaration(decoded.css, selector, variable);
	if (existing.found && decoded.region) return result(source, sourcePosition(source, decoded.region, decoded.css, existing.found.from), existing.found.value, false);
	const at = existing.closing;
	const preceding = at === undefined ? '' : decoded.css.slice(0, at).replace(/\/\*[\s\S]*?\*\//g, '').trimEnd();
	const separator = /[;{]$/.test(preceding) ? '' : ';';
	const css = at === undefined ? decoded.css + (decoded.css ? '\n' : '') + `${selector} { ${variable}: ${value}; }`
		: decoded.css.slice(0, at) + separator + ` ${variable}: ${value}; ` + decoded.css.slice(at);
	const updated = encodeLocalStyle(source, css); const region = styleRegion(updated)!;
	const inserted = cssDeclaration(region.css, selector, variable).found!;
	return result(updated, sourcePosition(updated, region, region.css, inserted.from), value, true);
}
