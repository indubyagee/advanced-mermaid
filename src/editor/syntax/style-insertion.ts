import { parse, type DiagramType } from 'pele';
import { normalizeColor } from '../../styles/colors';
import { PRESET_CATEGORIES, validPresetAlias, type PresetClass } from '../../styles/presets';
import { insertConfigDefaults } from './configuration-insertion';
import { insertComponent, type SourceInsertion } from './source';

type PresetFamily = typeof PRESET_CATEGORIES[number];

const classTemplates: Record<PresetFamily, readonly [placeholder: string, beforeAlias: string, example: string]> = {
	flowchart: ['NODE_ID', 'class NODE_ID ', 'flowchart TB\nNODE_ID[Node]\n'],
	state: ['NODE_ID', 'class NODE_ID ', 'stateDiagram-v2\n[*] --> NODE_ID\n'],
	agentflow: ['NODE_ID', 'NODE_ID["Task"]:::', 'agentflow-beta TB\n'],
	mindmap: ['Branch', 'branch[Branch]\n  :::', 'mindmap\n  Root((Root))\n    '],
	treeView: ['file.txt', 'file.txt :::', 'treeView-beta\nroot/\n  '],
	treemap: ['Item', '"Item": 10:::', 'treemap-beta\n"Group"\n  '],
};

const paletteSlots: Partial<Record<DiagramType, readonly [prefix: string, start: number]>> = {
	gitGraph: ['git', 0],
	mindmap: ['cScale', 1],
	timeline: ['cScale', 0],
	radar: ['cScale', 0],
	treemap: ['cScale', 0],
	pie: ['pie', 1],
	venn: ['venn', 1],
};

export function supportsPresetClasses(type: DiagramType): type is PresetFamily {
	return (PRESET_CATEGORIES as readonly DiagramType[]).includes(type);
}

/** Alias restrictions differ across Pele's diagram grammars. */
export function supportsPresetAlias(type: DiagramType, alias: string): boolean {
	if (!supportsPresetClasses(type) || !validPresetAlias(alias)) return false;
	const [, beforeAlias, example] = classTemplates[type];
	try {
		parse(insertComponent(example, example.length, example.length, beforeAlias + alias).source);
		return true;
	} catch { return false; }
}

export function supportsSeriesPalette(type: DiagramType): boolean {
	return type === 'xychart' || paletteSlots[type] !== undefined;
}

export function categoryPalette(presets: readonly PresetClass[]): string[] | undefined {
	const fills = new Map(presets.map(preset => [preset.alias, preset.fill]));
	const colors: string[] = [];
	for (let slot = 1; slot <= 8; slot++) {
		const fill = fills.get('CATEGORY' + slot);
		const color = fill && normalizeColor(fill);
		if (!color) return undefined;
		colors.push(color);
	}
	return colors;
}

export function insertPresetClass(source: string, type: DiagramType, from: number, to: number, alias: string): SourceInsertion {
	if (!supportsPresetClasses(type) || !supportsPresetAlias(type, alias)) throw new Error('Choose a saved preset class for this diagram.');
	const [placeholder, beforeAlias] = classTemplates[type];
	return insertComponent(source, from, to, beforeAlias + alias, placeholder);
}

export function insertCategoryPalette(source: string, type: DiagramType, presets: readonly PresetClass[]): SourceInsertion {
	const colors = categoryPalette(presets);
	if (!colors) throw new Error('Set a fill for each category preset before inserting a palette.');
	if (type === 'xychart') {
		return insertConfigDefaults(source, { themeVariables: { xyChart: { plotColorPalette: colors.join(', ') } } });
	}
	const slots = paletteSlots[type];
	if (!slots) throw new Error('Choose a diagram that supports a series palette.');
	const [prefix, start] = slots;
	const themeVariables = Object.fromEntries(colors.map((color, index) => [prefix + (start + index), color]));
	return insertConfigDefaults(source, { themeVariables });
}
