import type { SettingDefinition, SettingDefinitionItem } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { BUTTON_RADIUS_RANGE, EDITOR_COLORS, type EditorColor, type EditorStyleSettings } from '../styles/editor-style';
import { SOURCE_HIGHLIGHTS, SOURCE_HIGHLIGHT_TOKENS, SOURCE_WEIGHTS, isSourceWeight } from '../styles/source-highlight';
import { colorPairDefinition, numberDefinition, rowDefinition } from './setting-controls';

export function editorStyleDefinitions(settings: AdvancedMermaidSettings, changed: () => void): SettingDefinitionItem[] {
	const editor = settings.liveEditor;
	const color = (key: EditorColor, name: string, description: string, kind?: 'font' | 'background' | 'border'): SettingDefinition => colorPairDefinition(name, description,
		() => editor.style.colors[key], pair => {
			if (pair) editor.style.colors[key] = pair; else delete editor.style.colors[key]; changed();
		}, EDITOR_COLORS[key].inherited, kind ? `${name} ${kind} color` : name);
	return [
		numberDefinition('Source font size', '8–40 px for Mermaid and CSS source. Defaults to 10 px. Reset to inherit the vault text size; diagram labels are separate.', () => editor.fontSizePx, value => { editor.fontSizePx = value ?? null; changed(); }, { min: 8, max: 40, step: 1, optional: true, fallback: 10, unit: 'px' }),
		color('sourceText', 'Source font color', 'Text color for Mermaid and CSS source.'),
		{ type: 'page', name: 'Syntax highlighting', desc: 'Set colors and font weights for Mermaid and CSS tokens.', items: syntaxHighlightDefinitions(editor.style, changed) },
		color('sourceBackground', 'Source background color', 'Background for the source pane and its line-number gutter.'),
		numberDefinition('Line number font size', '8–40 px. Reset to use the source font size.', () => editor.style.lineNumberFontSizePx, value => { editor.style.lineNumberFontSizePx = value ?? null; changed(); }, { min: 8, max: 40, step: 1, optional: true, fallback: editor.fontSizePx ?? 10, unit: 'px' }),
		color('lineNumberText', 'Line number font color', 'Text color for source line numbers.'),
		color('indentGuide', 'Indent guide color', 'Indentation guides in Mermaid and CSS source.'),
		color('foldArrow', 'Expand/collapse arrow color', 'Fold arrows next to indented source blocks.'),
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
	];
}

function syntaxHighlightDefinitions(style: EditorStyleSettings, changed: () => void): SettingDefinitionItem[] {
	return SOURCE_HIGHLIGHT_TOKENS.flatMap(token => {
		const { label, light, dark } = SOURCE_HIGHLIGHTS[token];
		const weightName = label + ' font weight';
		const update = (next: NonNullable<EditorStyleSettings['syntax'][typeof token]>): void => {
			if (next.colors || next.weight !== undefined) style.syntax[token] = next;
			else delete style.syntax[token];
			changed();
		};
		return [
			colorPairDefinition(label + ' color', 'Overrides the source font color for this token.', () => style.syntax[token]?.colors,
				colors => update({ ...style.syntax[token], colors }), { light: style.colors.sourceText?.light ?? light, dark: style.colors.sourceText?.dark ?? dark }),
			rowDefinition(weightName, 'Use the default weight or choose a value from 100 to 900.', row => row.addDropdown(input => {
				input.selectEl.setAttribute('aria-label', weightName);
				input.addOptions({ default: 'Default' }).addOptions(Object.fromEntries(SOURCE_WEIGHTS.map(weight => [String(weight), String(weight)])));
				input.setValue(String(style.syntax[token]?.weight ?? 'default')).onChange(value => {
					const weight = Number(value);
					update({ ...style.syntax[token], weight: isSourceWeight(weight) ? weight : undefined });
				});
			})),
		];
	});
}
