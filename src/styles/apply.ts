import type { AdvancedMermaidSettings } from '../settings';
import { applyTheme } from '../rendering/theme';
import { COLOR_TOKENS, ELEMENT_CONTROLS, type StyleProfile, type ThemeMode } from './registry';

export function activeTheme(element: HTMLElement): ThemeMode {
	return element.ownerDocument.body.classList.contains('theme-dark') ? 'dark' : 'light';
}
export function applyStyle(element: HTMLElement, settings: AdvancedMermaidSettings, profile: StyleProfile): void {
	applyTheme(element, settings.theme);
	element.dataset.followTheme = String(settings.style.followObsidianTheme);
	const mode = activeTheme(element);
	element.dataset.styleControls = Object.keys(profile.elements).filter(key => { const value = profile.elements[key as keyof typeof ELEMENT_CONTROLS]; return typeof value === 'number' || value?.[mode] !== undefined; }).join(' ');
	for (const [key, variable] of Object.entries(COLOR_TOKENS)) {
		const value = profile.colors[key as keyof typeof COLOR_TOKENS]?.[mode];
		if (value) element.style.setProperty(variable, value);
		else if (!(key in settings.theme)) element.style.removeProperty(variable);
	}
	for (const [key, control] of Object.entries(ELEMENT_CONTROLS)) {
		const value = profile.elements[key as keyof typeof ELEMENT_CONTROLS];
		const resolved = typeof value === 'number' ? value + 'px' : value?.[mode];
		if (resolved !== undefined) element.style.setProperty(control.variable, resolved);
		else if (!(key in settings.theme)) element.style.removeProperty(control.variable);
	}
	for (const [field, variable, unit] of [['font', '--pele-font', ''], ['monospace', '--pele-font-mono', ''], ['radiusPx', '--pele-radius', 'px'], ['labelSizePx', '--pele-label-size', 'px']] as const) {
		const value = profile[field];
		if (value !== undefined) element.style.setProperty(variable, String(value) + unit);
		else if (!(field in settings.theme)) element.style.removeProperty(variable);
	}
	// Weight controls remain gated: Pele 1.12.0 exposes paint variables but no
	// matching per-role measurement option. Do not create clipped labels.
	element.classList.toggle('advanced-mermaid-custom-cluster-fill', !!(profile.elements.subgraphFill ?? settings.theme.subgraphFill));
}
