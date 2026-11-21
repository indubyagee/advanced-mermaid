import type { SettingDefinition, SettingDefinitionPage } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { numberDefinition, rowDefinition } from './setting-controls';
import { editorStyleDefinitions } from './editor-style-settings';

export function liveEditorDefinitions(settings: AdvancedMermaidSettings, changed: () => void): (SettingDefinition | SettingDefinitionPage)[] {
	const editor = settings.liveEditor;
	const toggle = (key: 'enabled' | 'fullScreen' | 'lineNumbers' | 'wrapSource', name: string, desc: string): SettingDefinition =>
		rowDefinition(name, desc, row => row.addToggle(input => input.setValue(editor[key]).onChange(value => { editor[key] = value; changed(); })));
	return [
		toggle('enabled', 'Enable inline editor', 'Edit complete, top-level pele and mermaid blocks in Live Preview.'),
		toggle('fullScreen', 'Full-screen Live Editor (experimental)', 'Open the active diagram in a dedicated tab. Keep its note open in Live Preview.'),
		rowDefinition(
			'Open editor',
			'Open the editor manually or when a diagram block gets focus.',
			row => row.addDropdown(input => input.addOptions({
				manual: 'Manual',
				'focused-block': 'Focused block'
			}).setValue(editor.activation).onChange(value => {
					if (value === 'manual' || value === 'focused-block') {editor.activation = value; changed();}
				}))
		),
		rowDefinition(
			'Editor layout',
			'Choose automatic, side-by-side or stacked source and preview. Narrow panes always stack.',
			row => row.addDropdown(input => input.addOptions({
				auto: 'Auto',
				'side-by-side': 'Side by side',
				stacked: 'Stacked'
			}).setValue(editor.layout).onChange(value => {
				if (value === 'auto' || value === 'side-by-side' || value === 'stacked') { editor.layout = value; changed(); }
			}))
		),
		{
			...toggle('wrapSource', 'Wrap source', 'Wrap long source lines within the editor pane.'),
			aliases: ['text wrap', 'word wrap'],
		},
		toggle('lineNumbers', 'Show line numbers', 'Show line numbers beside Mermaid and CSS source.'),
		{
			type: 'page',
			name: 'Editor appearance',
			desc: 'Source text, editor buttons, and shared Export styles.',
			items: editorStyleDefinitions(settings, changed),
		},
		{
			type: 'page',
			name: 'Preview timing',
			desc: 'Choose how long the preview waits after a source edit.',
			items: [numberDefinition('Preview delay', '100–1000 milliseconds. Source edits save immediately.',
				() => editor.debounceMs, value => { editor.debounceMs = value ?? 250; changed(); },
				{ min: 100, max: 1000, step: 1, fallback: 250, unit: 'ms' })],
		},
	];
}
