import type { SettingDefinition, SettingDefinitionPage } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { numberDefinition, rowDefinition } from './setting-controls';
import { editorStyleDefinitions } from './editor-style-settings';

export function liveEditorDefinitions(settings: AdvancedMermaidSettings, changed: () => void, refresh: () => void): (SettingDefinition | SettingDefinitionPage)[] {
	const editor = settings.liveEditor;
	const toggles = ([
		['enabled', 'Enable inline editor', 'Allow inline editing for complete, top-level pele and mermaid fences in Live Preview. Reading view keeps its usual renderer.'],
		['mermaidComparison', 'Enable Mermaid comparison', 'Opt into local native comparison after source, host configuration, and output checks pass. Exports use Pele.'],
		['lineNumbers', 'Show line numbers', 'Show line numbers beside Mermaid and CSS source.'],
		['wrapSource', 'Wrap source', 'Wrap long source lines within the editor pane.'],
	] as const).map(([key, name, desc]) => rowDefinition(name, desc, row => row.addToggle(toggle => toggle.setValue(editor[key]).onChange(value => { editor[key] = value; changed(); }))));
	return [...toggles,
		rowDefinition('Open editor', 'Open manually, or activate the focused eligible block. An explicit static choice lasts for this note pane session.', row => row.addDropdown(input => input.addOptions({ manual: 'Manual', 'focused-block': 'Focused block' }).setValue(editor.activation).onChange(value => { if (value === 'manual' || value === 'focused-block') { editor.activation = value; changed(); } }))),
		rowDefinition('Editor layout', 'Choose automatic, side-by-side or stacked source and preview. Narrow panes always stack.', row => row.addDropdown(input => input.addOptions({ auto: 'Auto', 'side-by-side': 'Side by side', stacked: 'Stacked' }).setValue(editor.layout).onChange(value => { if (value === 'auto' || value === 'side-by-side' || value === 'stacked') { editor.layout = value; changed(); } }))),
		numberDefinition('Preview delay', '100–1000 milliseconds. Source edits save immediately; only preview work is delayed.', () => editor.debounceMs, value => { editor.debounceMs = value ?? 250; changed(); }, { min: 100, max: 1000, step: 1, fallback: 250, unit: 'ms' }),
		{ type: 'page', name: 'Editor style settings', desc: 'Source text, pane background, button sizes and paired theme colors.', items: editorStyleDefinitions(settings, changed, refresh) },
	];
}
