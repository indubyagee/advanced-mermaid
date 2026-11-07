import type { AdvancedMermaidSettings } from '../settings';
import { resolveDisplay } from '../rendering/overrides';
import { COLOR_TOKENS, ELEMENT_CONTROLS, diagramCategory, type ColorToken, type ElementControlId } from '../styles/registry';
import { decodeLocalStyle, elementVariable } from '../styles/local-codec';
import { resolveDiagramStyle } from '../styles/resolve';
import { activeTheme } from '../styles/apply';
import { normalizeColor } from '../styles/colors';
import { colorLabels } from '../ui/profile-controls';
import type { DisplayOverrideKey, StyleTarget } from './override-insertion';

interface DisplayOption { kind: 'display'; id: string; label: string; key: DisplayOverrideKey }
interface StyleOption {
	kind: 'style'; id: string; label: string; variable: string; cssVariable: string; valueType: 'color' | 'length' | 'font';
	token?: ColorToken; element?: ElementControlId; field?: 'font' | 'monospace' | 'radiusPx' | 'labelSizePx';
}
export type OverrideOption = DisplayOption | StyleOption;

export function overrideOptions(source: string): OverrideOption[] {
	const display = ([['align', 'Alignment'], ['max-width', 'Diagram width'], ['max-height', 'Maximum height'], ['aspect-ratio', 'Maintain aspect ratio'], ['fill', 'Fill available space']] as const).map(([key, label]): DisplayOption => ({ kind: 'display', id: 'display:' + key, label, key }));
	const colors = (Object.entries(COLOR_TOKENS) as [ColorToken, string][]).map(([token, variable]): StyleOption => ({ kind: 'style', id: 'style:' + variable, label: colorLabels[token], variable, cssVariable: variable, token, valueType: 'color' }));
	const scalars = ([['font', 'Diagram font', '--pele-font', '--pele-font', 'font'], ['monospace', 'Monospace font', '--pele-font-mono', '--pele-font-mono', 'font'], ['radiusPx', 'Corner radius', '--pele-radius', '--pele-radius', 'length'], ['labelSizePx', 'Base label size', '--advanced-mermaid-label-size', '--pele-label-size', 'length']] as const).map(([field, label, variable, cssVariable, valueType]): StyleOption => ({ kind: 'style', id: 'style:' + variable, label, field, variable, cssVariable, valueType }));
	const category = diagramCategory(source);
	const elements = Object.entries(ELEMENT_CONTROLS).filter(([, control]) => 'category' in control ? control.category === category : category === 'flowchart').map(([key, control]): StyleOption => {
		const variable = elementVariable(key);
		return { kind: 'style', id: 'style:' + variable, label: 'label' in control ? control.label : key.replace(/[A-Z]/g, char => ' ' + char.toLowerCase()).replace(/^./, char => char.toUpperCase()), element: key as ElementControlId, variable, cssVariable: control.variable, valueType: control.kind === 'color' ? 'color' : 'length' };
	});
	return [...display, ...colors, ...scalars, ...elements];
}

/** Templates capture the current appearance; explicit saved mode values take priority. */
export function overrideValue(option: OverrideOption, source: string, settings: AdvancedMermaidSettings, element: HTMLElement, target: StyleTarget): string {
	const display = resolveDisplay(source, settings);
	if (option.kind === 'display') {
		return String({ align: display.alignment, 'max-width': display.maxWidth, 'max-height': display.maxHeight, 'aspect-ratio': display.maintainAspectRatio, fill: display.fillAvailable }[option.key]);
	}
	const mode = target === 'both' ? activeTheme(element) : target;
	const local = decodeLocalStyle(source, mode).profile;
	const profile = resolveDiagramStyle(source, settings.style.global, settings.style.diagrams, local).profile;
	const computed = element.ownerDocument.defaultView!.getComputedStyle(element);
	const raw = option.token ? profile.colors[option.token]?.[mode] : option.element ? profile.elements[option.element] : option.field ? profile[option.field] : undefined;
	const value = typeof raw === 'object' ? raw[mode] : raw;
	if (option.valueType === 'color') return normalizeColor(typeof value === 'string' ? value : computed.getPropertyValue(option.cssVariable)) ?? normalizeColor(computed.color) ?? '#808080';
	if (option.valueType === 'font') return typeof value === 'string' ? value : computed.getPropertyValue(option.cssVariable).trim() || (option.field === 'monospace' ? 'monospace' : computed.fontFamily);
	const inherited = Number.parseFloat(computed.getPropertyValue(option.cssVariable));
	const fallback = option.field === 'radiusPx' ? 4 : option.field === 'labelSizePx' ? 16 : 1;
	return `${typeof value === 'number' ? value : Number.isFinite(inherited) ? inherited : fallback}px`;
}
