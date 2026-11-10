import type { SettingDefinition, SettingDefinitionItem } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { BUTTON_RADIUS_RANGE, EDITOR_COLORS, type EditorColor } from '../styles/editor-style';
import { colorPairDefinition, numberDefinition } from './setting-controls';
import { zoomStyleDefinitions } from './zoom-style-settings';

export function editorStyleDefinitions(settings: AdvancedMermaidSettings, changed: () => void, refresh: () => void): SettingDefinitionItem[] {
	const editor = settings.liveEditor;
	const color = (key: EditorColor, name: string, description: string, kind?: 'font' | 'background' | 'border'): SettingDefinition => colorPairDefinition(name, description,
		() => editor.style.colors[key], pair => {
			if (pair) editor.style.colors[key] = pair; else delete editor.style.colors[key]; changed();
		}, EDITOR_COLORS[key].inherited, kind ? `${name} ${kind} color` : name);
	return [
		numberDefinition('Source font size', '8–40 px for Mermaid and CSS source. Reset to inherit the vault text size; diagram labels are separate.', () => editor.fontSizePx, value => { editor.fontSizePx = value ?? null; changed(); }, { min: 8, max: 40, step: 1, optional: true, fallback: 16, unit: 'px' }),
		color('sourceText', 'Source font color', 'Text color for Mermaid and CSS source.'),
		color('sourceBackground', 'Source background color', 'Background for the source pane and its line-number gutter.'),
		numberDefinition('Button font size', '8–40 px for editor buttons and export controls. Reset to inherit the interface size.', () => editor.style.buttonFontSizePx, value => { editor.style.buttonFontSizePx = value ?? null; changed(); }, { min: 8, max: 40, step: 1, optional: true, fallback: 13, unit: 'px' }),
		numberDefinition('Button corner radius', 'Round the corners of editor buttons, dropdowns and Export. Reset to use the theme’s corners.', () => editor.style.buttonRadiusPx, value => { editor.style.buttonRadiusPx = value ?? null; changed(); }, { ...BUTTON_RADIUS_RANGE, step: 1, optional: true, fallback: 4, unit: 'px' }),
		{ type: 'group', heading: 'Button font colors', items: [
			color('activeButtonText', 'Active buttons', 'Text for selected source, preview and editor mode buttons.', 'font'),
			color('inactiveButtonText', 'Inactive buttons', 'Text for unselected buttons and editor actions.', 'font'),
			color('exportButtonText', 'Export button', 'Text for Export and its actions.', 'font'),
		] },
		{ type: 'group', heading: 'Button background colors', items: [
			color('activeButtonBackground', 'Active buttons', 'Background for selected source, preview and editor mode buttons.', 'background'),
			color('inactiveButtonBackground', 'Inactive buttons', 'Background for unselected buttons and editor actions.', 'background'),
			color('exportButtonBackground', 'Export button', 'Background for Export and its actions.', 'background'),
		] },
		{ type: 'group', heading: 'Button border colors', items: [
			color('activeButtonBorder', 'Active buttons', 'Border for selected source, preview and editor mode buttons.', 'border'),
			color('inactiveButtonBorder', 'Inactive buttons', 'Border for unselected buttons and editor actions.', 'border'),
			color('exportButtonBorder', 'Export button', 'Border for Export and its actions. Inherits the inactive border if set.', 'border'),
		] },
		zoomStyleDefinitions(editor.style.zoom, changed, refresh),
	];
}
