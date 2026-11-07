import { stringifyYaml } from 'obsidian';
import { parseFrontmatter } from '../../styles/frontmatter';
import { frontmatterEnd } from '../../styles/local-codec';
import { checkDiagramSource } from '../../rendering/source-budget';
import { DIAGRAM_CONFIGURATION, type Configuration, type ConfigurationValue } from './configuration';
import type { DiagramSyntax } from './catalog';
import { sourceEol, type SourceInsertion } from './source';

const mapping = (value: ConfigurationValue | undefined): value is Configuration => value !== null && typeof value === 'object' && !Array.isArray(value);

function mergeMissing(local: Configuration, defaults: Configuration): Configuration {
	const merged = { ...local };
	for (const [key, value] of Object.entries(defaults)) {
		if (!Object.prototype.hasOwnProperty.call(local, key)) merged[key] = value;
		else if (mapping(local[key]) && mapping(value)) merged[key] = mergeMissing(local[key], value);
	}
	return merged;
}

function equivalent(left: ConfigurationValue, right: ConfigurationValue): boolean {
	if (mapping(left) && mapping(right)) {
		const keys = Object.keys(left);
		return keys.length === Object.keys(right).length && keys.every(key => key in right && equivalent(left[key]!, right[key]!));
	}
	if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => equivalent(value, right[index]!));
	return left === right;
}

function hasYamlComments(yaml: string): boolean {
	let quote = ''; let previous = '';
	for (let index = 0; index < yaml.length; index++) {
		const char = yaml[index]!;
		if (quote) {
			if (quote === '"' && char === '\\') index++;
			else if (char === quote) { if (quote === "'" && yaml[index + 1] === "'") index++; else quote = ''; }
		} else {
			if (char === '#' && (index === 0 || /\s/.test(yaml[index - 1]!))) return true;
			if ((char === '"' || char === "'") && (!previous || /[:[,{?-]/.test(previous))) quote = char;
		}
		if (char === '\n') previous = '';
		else if (!/\s/.test(char)) previous = char;
	}
	return false;
}

/** Preserve block-YAML comments/formatting by adding missing entries within their mapping.
 * Non-block forms fall back to the host serializer after semantic validation.
 */
function extendBlockYaml(yaml: string, local: Configuration, defaults: Configuration, indent: number, eol: string): string | undefined {
	let result = yaml;
	for (const [key, value] of Object.entries(defaults)) {
		if (!Object.prototype.hasOwnProperty.call(local, key)) {
			const addition = stringifyYaml({ [key]: value }).trimEnd().split(/\r?\n/).map(line => ' '.repeat(indent) + line).join(eol) + eol;
			result += (result && !result.endsWith('\n') ? eol : '') + addition;
		} else if (mapping(local[key]) && mapping(value) && !equivalent(mergeMissing(local[key], value), local[key])) {
			const lines = [...result.matchAll(/[^\n]*(?:\n|$)/g)];
			const pattern = new RegExp('^ {' + indent + '}(?:' + key + '|"' + key + '"|\'' + key + '\'):[ \\t]*(?:#[^\\r\\n]*)?\\r?\\n$');
			const lineIndex = lines.findIndex(line => pattern.test(line[0]));
			if (lineIndex < 0) return undefined;
			const start = lines[lineIndex]!.index + lines[lineIndex]![0].length;
			const remaining = lines.slice(lineIndex + 1);
			const boundary = remaining.find(line => line[0].trim() && !line[0].trimStart().startsWith('#') && line[0].search(/\S/) <= indent);
			const end = boundary?.index ?? result.length;
			const children = result.slice(start, end);
			const childIndent = /^ +(?=\S)/m.exec(children)?.[0].length ?? indent + 2;
			const extended = extendBlockYaml(children, local[key], value, childIndent, eol);
			if (extended === undefined) return undefined;
			result = result.slice(0, start) + extended + result.slice(end);
		}
	}
	return result;
}

/** Repeated generation fills missing keys only; authored scalars, arrays and nulls win. */
export function insertConfiguration(source: string, diagram: DiagramSyntax): SourceInsertion {
	const eol = sourceEol(source); const end = frontmatterEnd(source, true);
	const opening = /^(?:[ \t]*\r?\n)*---\r?\n/.exec(source);
	const yaml = opening ? source.slice(opening[0].length, end).replace(/(?:^|\r?\n)(?:---|\.\.\.)[ \t]*(?:\r?\n)?$/, '') : '';
	const local: Configuration = parseFrontmatter(yaml);
	const defaults: Configuration = { config: { theme: 'default', ...DIAGRAM_CONFIGURATION[diagram.type] } };
	const merged = mergeMissing(local, defaults);
	if (opening && equivalent(local, merged)) return { source, from: opening[0].length, to: opening[0].length + yaml.length };
	let updatedYaml = extendBlockYaml(yaml, local, defaults, 0, eol);
	if (updatedYaml !== undefined) {
		try { if (!equivalent(parseFrontmatter(updatedYaml), merged)) updatedYaml = undefined; } catch { updatedYaml = undefined; }
	}
	if (updatedYaml === undefined) {
		if (hasYamlComments(yaml)) throw new Error('Use block YAML mappings to add configuration while keeping existing comments.');
		updatedYaml = stringifyYaml(merged).trimEnd().replace(/\r?\n/g, eol) + eol;
	}
	const prefix = '---' + eol + updatedYaml + '---' + eol;
	const updated = prefix + source.slice(opening ? end : 0);
	checkDiagramSource(updated);
	return { source: updated, from: 3 + eol.length, to: prefix.length - 3 - eol.length };
}
