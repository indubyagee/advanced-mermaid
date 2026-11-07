import { PRESET_CATEGORIES, validatePresets, type PresetClass } from './presets';

/** Set validated variables only; static CSS supplies the shape/label adapters. */
export function applyPresetClasses(svg: SVGSVGElement, presets: readonly PresetClass[], category: string): void {
	if (!(PRESET_CATEGORIES as readonly string[]).includes(category)) return;
	const checked = validatePresets(presets);
	if (checked.issues.length) throw new Error(checked.issues[0]!.message);
	for (const node of Array.from(svg.querySelectorAll<SVGElement>('.pele-node,.pele-cluster'))) {
		const resolved: Partial<PresetClass> = {};
		for (const preset of checked.presets) if (node.classList.contains(preset.alias)) Object.assign(resolved, preset);
		const fields: string[] = [];
		for (const [field, variable] of [['fill', '--pele-palette-fill'], ['stroke', '--pele-palette-border'], ['text', '--pele-palette-text'], ['width', '--pele-palette-width']] as const) {
			const value = resolved[field];
			if (value === undefined) node.style.removeProperty(variable);
			else { node.style.setProperty(variable, typeof value === 'number' ? value + 'px' : value); fields.push(field); }
		}
		if (fields.length) node.dataset.advancedMermaidPreset = fields.join(' '); else delete node.dataset.advancedMermaidPreset;
	}
}
