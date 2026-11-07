import { COLOR_TOKENS, ELEMENT_CONTROLS, emptyStyleProfile, type ColorToken, type ElementControlId, type StyleProfile, type ThemeMode } from './registry';
import { validateStyleProfile } from './validate';
import { resolveStyleProfile } from './resolve';

export class LocalStyleError extends Error {
	constructor(message: string, readonly line: number, readonly column = 1) { super(message); this.name = 'LocalStyleError'; }
}
const BEGIN = '%% advanced-mermaid-style:v1';
const END = '%% advanced-mermaid-style:end';
export const elementVariable = (id: string): string => '--advanced-mermaid-' + id.replace(/[A-Z]/g, char => '-' + char.toLowerCase());
const colors = new Map(Object.entries(COLOR_TOKENS).map(([key, variable]) => [variable as string, key as ColorToken]));
const elements = new Map(Object.keys(ELEMENT_CONTROLS).map(id => [elementVariable(id), id as ElementControlId]));
const scalars: Record<string, keyof StyleProfile> = { '--pele-font': 'font', '--pele-font-mono': 'monospace', '--pele-radius': 'radiusPx', '--advanced-mermaid-label-size': 'labelSizePx' };

/** A constrained variable language. Raw CSS is never attached to a document. */
export function parseStyleCss(css: string, mode: ThemeMode = 'light'): StyleProfile {
	if (css.length > 50000) throw new LocalStyleError('Local styles exceed 50,000 characters.', 1);
	const clean = css.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\r\n]/g, ' '));
	const profiles = { base: emptyStyleProfile(), light: emptyStyleProfile(), dark: emptyStyleProfile() };
	let position = 0;
	const fail = (message: string, offset: number): never => {
		const before = css.slice(0, offset); const lines = before.split('\n');
		throw new LocalStyleError(message, lines.length, lines[lines.length - 1]!.length + 1);
	};
	while (position < clean.length) {
		const remaining = clean.slice(position);
		if (!remaining.trim()) break;
		const match = /^\s*(\.pele|\.theme-light\s+\.pele|\.theme-dark\s+\.pele)\s*\{([^{}]*)\}/.exec(remaining);
		if (!match) fail('Use .pele, .theme-light .pele, or .theme-dark .pele with registered variables only.', position);
		const block = match!;
		const selector = block[1]!;
		const profile = profiles[selector === '.pele' ? 'base' : selector.includes('theme-dark') ? 'dark' : 'light'];
		const body = block[2]!;
		let declarationOffset = position + block[0].indexOf('{') + 1;
		for (const declaration of body.split(';')) {
			if (!declaration.trim()) { declarationOffset += declaration.length + 1; continue; }
			const location = declarationOffset + declaration.search(/\S/);
			const item = /^\s*(--[a-zA-Z0-9-]+)\s*:\s*([^:;{}]+?)\s*$/.exec(declaration);
			if (!item) fail('Invalid style declaration.', location);
			const variable = item![1]!; const value = item![2]!.trim();
			const color = colors.get(variable); const element = elements.get(variable);
			const patch: Record<string, unknown> = {};
			if (color) patch.colors = { [color]: { light: value, dark: value } };
			else if (element) patch.elements = { [element]: ELEMENT_CONTROLS[element].kind === 'color' ? { light: value, dark: value } : length(value) };
			else if (Object.prototype.hasOwnProperty.call(scalars, variable)) {
				const field = scalars[variable]!;
				patch[field] = field === 'font' || field === 'monospace' ? value : field.endsWith('Px') ? length(value) : /^\d+$/.test(value) ? Number(value) : NaN;
			} else fail('Unknown or unavailable style variable: ' + variable, location);
			const checked = validateStyleProfile(patch);
			if (checked.issues.length) fail(checked.issues[0]!.message, location);
			Object.assign(profile, resolveStyleProfile(profile, undefined, checked.profile));
			declarationOffset += declaration.length + 1;
		}
		position += block[0].length;
	}
	return resolveStyleProfile(profiles.base, undefined, profiles[mode]);
}
function length(value: string): number { return /^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value) ? Number.parseFloat(value) : NaN; }

export interface StyleRegion { from: number; to: number; line: number; css: string }
/** Find a real leading YAML delimiter, ignoring quoted multiline scalar text. */
export function frontmatterEnd(source: string, strict: boolean): number {
	const offset = /^(?:[ \t]*\r?\n)*/.exec(source)![0].length;
	source = source.slice(offset);
	if (!/^---\r?\n/.test(source)) return offset;
	const lines = [...source.matchAll(/[^\n]*(?:\n|$)/g)];
	let quote = ''; let flowDepth = 0;
	for (const line of lines.slice(1)) {
		const text = line[0].replace(/\r?\n$/, '');
		if (!quote && flowDepth === 0 && /^(?:---|\.\.\.)\s*$/.test(text)) return offset + line.index + line[0].length;
		let previous = '';
		for (let index = 0; index < text.length; index++) {
			const char = text[index]!;
			const before = previous;
			if (!/\s/.test(char)) previous = char;
			if (quote) {
				if (quote === '"' && char === '\\') { index++; continue; }
				if (char === quote) { if (quote === "'" && text[index + 1] === "'") index++; else quote = ''; }
				continue;
			}
			if (char === '#' && (index === 0 || /\s/.test(text[index - 1]!))) break;
			const start = !before || /[:[,{?-]/.test(before);
			if ((char === '"' || char === "'") && start) quote = char;
			else if ((char === '{' || char === '[') && start) flowDepth++;
			else if ((char === '}' || char === ']') && flowDepth > 0) flowDepth--;
		}
	}
	if (strict) throw new LocalStyleError('Complete the YAML frontmatter before adding local styles.', 1);
	return offset + source.length;
}
export function styleRegion(source: string): StyleRegion | undefined {
	const lines = [...source.matchAll(/[^\n]*(?:\n|$)/g)].filter(match => match[0] !== '');
	const yamlEnd = frontmatterEnd(source, false);
	let begin = -1; let end = -1;
	for (let index = 0; index < lines.length; index++) {
		if (lines[index]!.index < yamlEnd) continue;
		const text = lines[index]![0].replace(/\r?\n$/, '');
		if (!text.startsWith('%% advanced-mermaid-style:')) continue;
		if (text === BEGIN && begin < 0 && end < 0) begin = index;
		else if (text === END && begin >= 0 && end < 0) end = index;
		else throw new LocalStyleError('Duplicate, misplaced, or unsupported style region marker.', index + 1);
	}
	if (begin < 0) return undefined;
	if (end < 0) throw new LocalStyleError('Close the local style region with ' + END, begin + 1);
	const css = lines.slice(begin + 1, end).map((match, index) => {
		const text = match[0].replace(/\r?\n$/, '');
		if (!text.startsWith('%%')) throw new LocalStyleError('Every style-region line must be a Mermaid comment.', begin + index + 2);
		return text.slice(text.startsWith('%% ') ? 3 : 2);
	}).join('\n');
	return { from: lines[begin]!.index, to: lines[end]!.index + lines[end]![0].length, line: begin + 1, css };
}

export function decodeLocalStyle(source: string, mode: ThemeMode): { css: string; profile: StyleProfile; region?: StyleRegion } {
	const region = styleRegion(source);
	try { return { css: region?.css ?? '', profile: parseStyleCss(region?.css ?? '', mode), region }; }
	catch (error) {
		if (error instanceof LocalStyleError && region) throw new LocalStyleError(error.message, region.line + error.line, error.column + 3);
		throw error;
	}
}

/** Replace exactly the reserved region, preserving every surrounding byte. */
export function encodeLocalStyle(source: string, css: string): string {
	parseStyleCss(css, 'light'); parseStyleCss(css, 'dark');
	const region = styleRegion(source);
	const eol = source.includes('\r\n') ? '\r\n' : '\n';
	const normalized = css.replace(/\r\n/g, '\n').trim();
	const replacement = normalized ? [BEGIN, ...normalized.split('\n').map(line => '%% ' + line), END].join(eol) + eol : '';
	if (region) return source.slice(0, region.from) + replacement + source.slice(region.to);
	if (!replacement) return source;
	const offset = frontmatterEnd(source, true);
	return source.slice(0, offset) + (offset && !source.slice(0, offset).endsWith('\n') ? eol : '') + replacement + source.slice(offset);
}
