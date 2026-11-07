import { parseYaml } from 'obsidian';
import { PeleError } from 'pele';
import { diagramCategory, DIAGRAM_REGISTRY, type DiagramCategory, type DiagramFrontmatter, type TypeStyleProfile } from './registry';
import { frontmatterEnd } from './local-codec';
import { isStyleRecord } from './validate';

const MAX_LENGTH = 50_000;
type Value = null | boolean | number | string | Value[] | { [key: string]: Value };
type Frontmatter = { [key: string]: Value };

export function normalizeFrontmatter(value: unknown): DiagramFrontmatter {
	if (!isStyleRecord(value) || typeof value.yaml !== 'string' || value.yaml.length > MAX_LENGTH) return { enabled: false, yaml: '' };
	return { enabled: value.enabled === true, yaml: value.yaml };
}

/** Use the host YAML reader, then copy bounded JSON data for the renderer.
 * Reject cycles, unsafe keys and non-data values before merging or serializing.
 */
export function parseFrontmatter(yaml: string): Frontmatter {
	if (yaml.length > MAX_LENGTH) throw new Error('Frontmatter exceeds 50,000 characters.');
	const text = yaml.trim();
	if (!text) return {};
	const front = leadingFrontmatter(text);
	if (front && text.slice(front.end).trim()) throw new Error('Enter frontmatter only, without a diagram body.');
	const parsed: unknown = parseYaml(front ? front.yaml : text);
	if (parsed == null) return {};
	let count = 0;
	const ancestors = new Set<object>();
	const copy = (value: unknown, depth: number): Value => {
		if (++count > 5_000 || depth > 32) throw new Error('Frontmatter is too large or deeply nested.');
		if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
		if (typeof value === 'number' && Number.isFinite(value)) return value;
		if (!Array.isArray(value) && !isStyleRecord(value)) throw new Error('Use YAML mappings, lists and literal values only.');
		if (ancestors.has(value)) throw new Error('Frontmatter cannot contain circular aliases.');
		ancestors.add(value);
		let result: Value;
		if (Array.isArray(value)) result = value.map(item => copy(item, depth + 1));
		else {
			const record: Frontmatter = {};
			for (const [key, item] of Object.entries(value)) {
				if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe frontmatter key: ' + key);
				record[key] = copy(item, depth + 1);
			}
			result = record;
		}
		ancestors.delete(value);
		return result;
	};
	const result = copy(parsed, 0);
	if (!isStyleRecord(result)) throw new Error('Frontmatter must be a YAML mapping.');
	if (result.config != null && !isStyleRecord(result.config)) throw new Error('The config field must be a YAML mapping.');
	return result;
}

function leadingFrontmatter(source: string): { yaml: string; end: number } | undefined {
	const opening = /^(?:[ \t]*\r?\n)*---\r?\n/.exec(source);
	if (!opening) return undefined;
	const end = frontmatterEnd(source, false);
	if (end < opening[0].length) throw new Error('Complete the YAML frontmatter with a closing --- delimiter.');
	return { yaml: source.slice(opening[0].length, end).replace(/(?:^|\r?\n)(?:---|\.\.\.)[ \t]*(?:\r?\n)?$/, ''), end };
}

/** Missing keys inherit; lists, nulls and scalar values replace defaults. */
function merge(defaults: Frontmatter, local: Frontmatter): Frontmatter {
	const result = { ...defaults };
	for (const [key, value] of Object.entries(local)) {
		const previous = result[key];
		result[key] = isStyleRecord(previous) && isStyleRecord(value) ? merge(previous, value) : value;
	}
	return result;
}

export interface ConfiguredSource {
	source: string;
	/** Added lines before the original diagram body; never change note contents. */
	lineOffset: number;
}

export function resolveFrontmatter(source: string, diagrams: Partial<Record<DiagramCategory, TypeStyleProfile>>): ConfiguredSource {
	const category = diagramCategory(source);
	const settings = category ? diagrams[category]?.frontmatter : undefined;
	if (!category || !settings?.enabled || !settings.yaml.trim()) return { source, lineOffset: 0 };
	let defaults: Frontmatter;
	try { defaults = parseFrontmatter(settings.yaml); }
	catch (error) { throw new Error('Custom frontmatter for ' + DIAGRAM_REGISTRY[category].label + ': ' + (error instanceof Error ? error.message : String(error))); }
	if (!Object.keys(defaults).length) return { source, lineOffset: 0 };
	const front = leadingFrontmatter(source);
	const local = front ? parseFrontmatter(front.yaml) : {};
	// Gantt accepts both aliases. Its source config must outrank a type-level
	// top-level displayMode, which Pele would otherwise apply after config.
	const localGantt = isStyleRecord(local.config) ? local.config.gantt : undefined;
	if (category === 'gantt' && isStyleRecord(localGantt) && 'displayMode' in localGantt && !('displayMode' in local)) delete defaults.displayMode;
	// JSON is valid YAML and keeps added lines predictable for source diagnostics.
	const prefix = '---\n' + JSON.stringify(merge(defaults, local)) + '\n---\n';
	const end = front?.end ?? 0;
	return { source: prefix + source.slice(end), lineOffset: 3 - (source.slice(0, end).match(/\n/g)?.length ?? 0) };
}

export function originalSourceError(error: unknown, lineOffset: number): unknown {
	if (!(error instanceof PeleError) || !lineOffset || error.line <= 0) return error;
	return new PeleError(error.message, error.code, { ...error, line: Math.max(1, error.line - lineOffset) });
}
