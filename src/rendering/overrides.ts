import { isAlignment, type AdvancedMermaidSettings } from '../settings';
import { isWidthPreset, parseHeightSetting } from '../display-settings';
import { frontmatterEnd } from '../styles/local-codec';

export type ResolvedDisplaySettings = Omit<AdvancedMermaidSettings, 'maxWidth'> & { maxWidth: AdvancedMermaidSettings['maxWidth'] | 'auto' };

export class ConfigurationError extends Error {
	constructor(message: string, readonly line: number) {
		super(message);
		this.name = 'ConfigurationError';
	}
}

/** Read a reserved comment without removing lines or interpreting Pele's YAML. */
export function resolveDisplay(source: string, settings: AdvancedMermaidSettings): ResolvedDisplaySettings {
	const result: ResolvedDisplaySettings = { ...settings };
	const lines = source.split(/\r?\n/);
	const offset = frontmatterEnd(source, false);
	let index = source.slice(0, offset).split('\n').length - 1;
	let found = false;
	for (; index < lines.length; index++) {
		const line = lines[index]?.trim() ?? '';
		if (!line) continue;
		if (!line.startsWith('%%')) break;
		if (!line.startsWith('%% advanced-mermaid:')) continue;
		if (found) throw new ConfigurationError('Use only one Advanced Mermaid directive.', index + 1);
		found = true;
		const assignments = line.slice('%% advanced-mermaid:'.length).trim().split(/\s+/);
		const seen = new Set<string>();
		for (const assignment of assignments) {
			const match = /^(align|max-height|max-width|aspect-ratio|fill)=([^=]+)$/.exec(assignment);
			if (!match) throw new ConfigurationError('Use align=left|center|right, max-width=default|full|normal|wide|maximum|none|auto, max-height=30vh|medium|none|auto, aspect-ratio=true|false, or fill=true|false.', index + 1);
			const [, key, value] = match;
			if (seen.has(key!)) throw new ConfigurationError(`Remove the repeated ${key} setting.`, index + 1);
			seen.add(key!);
			if (key === 'align') {
				if (!isAlignment(value)) throw new ConfigurationError('Alignment must be left, center, or right.', index + 1);
				result.alignment = value;
			} else if (key === 'max-width') {
				if (value !== 'auto' && !isWidthPreset(value)) throw new ConfigurationError('Width must be default, full, normal, wide, maximum, none, or auto.', index + 1);
				result.maxWidth = value;
			} else if (key === 'aspect-ratio' || key === 'fill') {
				if (value !== 'true' && value !== 'false') throw new ConfigurationError(`${key} must be true or false.`, index + 1);
				if (key === 'aspect-ratio') result.maintainAspectRatio = value === 'true';
				else result.fillAvailable = value === 'true';
			} else {
				const height = parseHeightSetting(value);
				if (!height) throw new ConfigurationError('Use a positive height in vh, px, or rem, a height preset, or none.', index + 1);
				result.maxHeight = height;
			}
		}
	}
	return result;
}
