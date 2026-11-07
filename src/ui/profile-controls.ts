import type { SettingDefinitionGroup, SettingDefinitionPage } from 'obsidian';
import { COLOR_TOKENS, COMPATIBILITY_CONTROLS, type StyleProfile, type ColorPair } from '../styles/registry';
import { validStyleFont } from '../styles/validate';
import { SEMANTIC_CONTROLS } from '../styles/semantic-controls';
import { colorPairDefinition, numberDefinition, rowDefinition } from './setting-controls';

export const colorLabels: Record<keyof typeof COLOR_TOKENS, string> = {
	background: 'Diagram background', text: 'Primary text', muted: 'Secondary text', line: 'Lines and connectors',
	surface: 'Primary surface', surfaceAlt: 'Secondary surface', border: 'Borders', accent: 'Accent', error: 'Error color',
	foregroundOnLight: 'Text on light fills', foregroundOnDark: 'Text on dark fills',
	series1: 'Category color 1', series2: 'Category color 2', series3: 'Category color 3', series4: 'Category color 4',
	series5: 'Category color 5', series6: 'Category color 6', series7: 'Category color 7', series8: 'Category color 8',
};
const descriptions: Partial<Record<keyof typeof COLOR_TOKENS, string>> = {
	background: 'Background behind the diagram.', text: 'Main diagram labels and text.', muted: 'Muted and supporting labels.',
	line: 'Connecting lines and arrows.', surface: 'Main shape and panel surfaces.', surfaceAlt: 'Alternate shape and panel surfaces.',
	border: 'General outlines and borders.', accent: 'Highlights and emphasis.', error: 'Error-related diagram colors.',
	foregroundOnLight: 'Contrast text on light authored fills.', foregroundOnDark: 'Contrast text on dark authored fills.',
};
const words = (text: string): string => text.replace(/[A-Z]/g, char => ' ' + char.toLowerCase()).replace(/^./, char => char.toUpperCase());

/** Definitions contain metadata only until Obsidian renders the selected page. */
export function profileDefinitions(profile: StyleProfile, changed: () => void, compatibility = false, category?: string): SettingDefinitionGroup[] {
	const colors = (Object.keys(COLOR_TOKENS) as (keyof typeof COLOR_TOKENS)[]).map(key => colorPairDefinition(colorLabels[key], descriptions[key] ?? 'Palette slot for categories or data series; use depends on diagram type.',
		() => profile.colors[key], value => { if (value) profile.colors[key] = value; else delete profile.colors[key]; changed(); }, COLOR_TOKENS[key]));
	const fonts = (['font', 'monospace'] as const).map(field => rowDefinition(field === 'font' ? 'Diagram font source' : 'Monospace font source', 'Use inherited typography or enter local font families. No fonts are downloaded.', row => {
		let text: HTMLInputElement; let source: HTMLSelectElement;
		row.addDropdown(input => { source = input.selectEl; input.addOptions({ inherit: category ? 'Use global font' : 'Use Obsidian font', custom: 'Custom font family' }).setValue(profile[field] ? 'custom' : 'inherit').onChange(value => {
			text.hidden = value !== 'custom'; if (value === 'inherit') { delete profile[field]; text.value = ''; text.setCustomValidity(''); text.setAttribute('aria-invalid', 'false'); changed(); }
		}); });
		row.addText(input => { text = input.inputEl; input.setValue(profile[field] ?? '').setPlaceholder('Local font family'); text.hidden = !profile[field]; text.setAttribute('aria-label', field === 'font' ? 'Diagram font' : 'Monospace font');
			input.onChange(raw => { const value = raw.trim(); const valid = !value || validStyleFont(value); text.setCustomValidity(valid ? '' : 'Use local font family names.'); text.setAttribute('aria-invalid', String(!valid)); if (valid) { if (value) profile[field] = value; else delete profile[field]; changed(); } });
		});
		row.addExtraButton(button => button.setIcon('rotate-ccw').setTooltip('Use inherited font').onClick(() => { delete profile[field]; source.value = 'inherit'; text.value = ''; text.hidden = true; text.setCustomValidity(''); text.setAttribute('aria-invalid', 'false'); changed(); }));
	}));
	const numbers = ([['radiusPx', 'Corner radius', 0, 32, 4], ['labelSizePx', 'Base label size', 4, 128, 16]] as const).map(([field, name, min, max, fallback]) => numberDefinition(name, `${min}–${max} px. Reset to inherit; label size participates in renderer measurement.`, () => profile[field], value => { if (value === undefined) delete profile[field]; else profile[field] = value; changed(); }, { min, max, fallback, optional: true, unit: 'px' }));
	const semantic = Object.entries(SEMANTIC_CONTROLS).filter(([, control]) => control.category === category).map(([key, control]) => {
		const id = key as keyof typeof SEMANTIC_CONTROLS;
		return colorPairDefinition(control.label, 'Color for this diagram element. Empty values inherit the resolved profile.', () => profile.elements[id] as ColorPair | undefined,
			value => { if (value) profile.elements[id] = value; else delete profile.elements[id]; changed(); });
	});
	const shared: SettingDefinitionPage[] = [];
	if (compatibility) for (const group of ['Node', 'Edge', 'Subgraph']) {
		const items = Object.entries(COMPATIBILITY_CONTROLS).filter(([key]) => key.startsWith(group.toLowerCase())).map(([key, control]) => {
			const id = key as keyof typeof COMPATIBILITY_CONTROLS; const name = words(key);
			return control.kind === 'color' ? colorPairDefinition(name, 'Default for matching elements; authored Mermaid styles retain precedence.', () => profile.elements[id] as ColorPair | undefined,
				value => { if (value) profile.elements[id] = value; else delete profile.elements[id]; changed(); })
				: numberDefinition(name, 'Outline thickness, 0–20 px. Reset to inherit.', () => typeof profile.elements[id] === 'number' ? profile.elements[id] : undefined,
					value => { if (value === undefined) delete profile.elements[id]; else profile.elements[id] = value; changed(); }, { min: 0, max: 20, fallback: 1, optional: true, unit: 'px' });
		});
		shared.push({ type: 'page', name: group + ' style settings', desc: 'Shared defaults for matching ' + group.toLowerCase() + ' elements.', items });
	}
	return [
		{ type: 'group', heading: 'Colors', items: [...colors.slice(0, 11), { type: 'page', name: category ? words(category) + ' category colors' : 'Category colors', desc: 'Eight palette slots for categories and data series.', items: colors.slice(11) }] },
		{ type: 'group', heading: 'Typography and shape', items: [...fonts, ...numbers, { name: 'Text weights', desc: 'Renderer weights are retained; measured per-role weight overrides are unavailable in Pele 1.12.0.' }] },
		...(semantic.length ? [{ type: 'group' as const, heading: 'Diagram elements', items: semantic }] : []),
		...(shared.length ? [{ type: 'group' as const, heading: 'Shared element defaults', items: shared }] : []),
	];
}
