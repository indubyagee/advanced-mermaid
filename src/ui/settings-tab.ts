import { PluginSettingTab, type App, type Plugin, type SettingDefinitionItem } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { displayDefinitions } from './display-settings';
import { StylePages } from './style-settings';
import { liveEditorDefinitions } from './live-editor-settings';
import { localOverridesGuide } from './local-overrides-guide';
import { SettingsExample } from './settings-example';
import { PresetSettings } from './preset-settings';
import { rowDefinition } from './setting-controls';

export class AdvancedMermaidSettingTab extends PluginSettingTab {
	private readonly example: SettingsExample;
	private readonly styles: StylePages;
	private readonly presets: PresetSettings;
	constructor(app: App, plugin: Plugin, private readonly settings: AdvancedMermaidSettings, changed: () => void) {
		super(app, plugin);
		this.example = new SettingsExample(app, () => this.settings);
		this.changed = () => { changed(); this.example.refresh(); };
		this.styles = new StylePages(settings, this.changed, () => this.update());
		this.presets = new PresetSettings(app, settings, this.changed, () => this.update());
	}
	private readonly changed: () => void;

	getSettingDefinitions(): SettingDefinitionItem[] {
		const definitions: SettingDefinitionItem[] = [
			{ type: 'group', heading: 'Display settings', items: displayDefinitions(this.app, this.settings, this.changed) },
			{ type: 'group', heading: 'Live editor settings', items: liveEditorDefinitions(this.settings, this.changed, () => this.update()) },
			{ type: 'group', heading: 'Style settings', items: [
				rowDefinition('Follow Obsidian theme', 'Use Obsidian colors for inherited values. Turning this off retains overrides and local fonts.', row => row.addToggle(input => input.setValue(this.settings.style.followObsidianTheme).onChange(value => { this.settings.style.followObsidianTheme = value; this.changed(); }))),
				{ type: 'page', name: 'Global style settings', desc: 'Colors, fonts, shape sizes and shared element defaults.', items: this.styles.globalDefinitions() },
				{ type: 'page', name: 'Diagram-specific style settings', desc: 'Select a diagram family and manage its styles and custom frontmatter.', items: this.styles.diagrams() },
			] },
			{ type: 'group', heading: 'Preset class settings', items: [{ type: 'page', name: 'Preset class settings', desc: 'Create, edit and delete preset classes with a form or text.', items: this.presets.definitions() }] },
			{ type: 'page', name: 'Local overrides and example', desc: 'Syntax reference and an optional local preview.', items: [
				rowDefinition('Local overrides', 'Apply settings to one diagram using visible source comments.', row => { localOverridesGuide(row.controlEl); }),
				rowDefinition('Example', 'Expand the example to render it. Closing this page releases the renderer.', row => { this.example.attach(row.controlEl); return () => this.example.destroy(); }),
			] },
		];
		const decorate = (items: SettingDefinitionItem[]): SettingDefinitionItem[] => items.map(item => {
			if ('items' in item && item.items) return { ...item, items: decorate(item.items) } as typeof item;
			if ('render' in item && item.render) {
				const render = item.render;
				return { ...item, render: (row, group) => { row.settingEl.addClass('advanced-mermaid-settings'); row.settingEl.dataset.followTheme = String(this.settings.style.followObsidianTheme); return render(row, group); } };
			}
			return item;
		});
		return decorate(definitions);
	}
	hide(): void { this.example.destroy(); this.styles.endSession(); }
}
