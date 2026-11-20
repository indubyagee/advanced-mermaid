import { PluginSettingTab, type App, type Plugin, type SettingDefinitionItem } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { displayDefinitions } from './display-settings';
import { StylePages } from './style-settings';
import { liveEditorDefinitions } from './live-editor-settings';
import { localOverridesGuide } from './local-overrides-guide';
import { SettingsExample } from './settings-example';
import { PresetSettings } from './preset-settings';
import { rowDefinition } from './setting-controls';
import { zoomStyleDefinitions } from './zoom-style-settings';
import { SettingsPageFocus } from './settings-page-focus';

export class AdvancedMermaidSettingTab extends PluginSettingTab {
	private readonly example: SettingsExample;
	private readonly styles: StylePages;
	private readonly presets: PresetSettings;
	private readonly navigation: SettingsPageFocus;
	constructor(app: App, plugin: Plugin, private readonly settings: AdvancedMermaidSettings, changed: () => void) {
		super(app, plugin);
		this.navigation = new SettingsPageFocus(plugin.manifest?.name);
		this.example = new SettingsExample(app, () => this.settings);
		this.changed = () => { changed(); this.example.refresh(); };
		this.styles = new StylePages(settings, this.example, this.changed, () => this.update(), () => this.refreshDomState());
		this.presets = new PresetSettings(app, settings, this.changed, () => this.update());
	}
	private readonly changed: () => void;

	getSettingDefinitions(): SettingDefinitionItem[] {
		const definitions: SettingDefinitionItem[] = [
			{ type: 'group', heading: 'Diagram display', items: [...displayDefinitions(this.app, this.settings, this.changed), this.example.definition()] },
			{ type: 'group', heading: 'Live editor', items: liveEditorDefinitions(this.settings, this.changed) },
			{ type: 'group', heading: 'Diagram styles', items: [
				rowDefinition('Follow Obsidian theme', 'Use Obsidian colors for inherited values. Turning this off retains overrides and local fonts.', row => row.addToggle(input => input.setValue(this.settings.style.followObsidianTheme).onChange(value => { this.settings.style.followObsidianTheme = value; this.changed(); }))),
				{ type: 'page', name: 'All diagrams', desc: 'Default colors, fonts, shapes, and element styles.', items: this.styles.globalDefinitions() },
				{ type: 'page', name: 'By diagram type', desc: 'Customize Flowchart, Sequence, and other diagram types.', items: this.styles.diagrams() },
			] },
			{ type: 'page', name: 'Zoom controls', desc: 'Set Zoom button colors in all diagram views.', items: zoomStyleDefinitions(this.settings.liveEditor.style.zoom, this.changed, () => this.refreshDomState()) },
			{ type: 'page', name: 'Preset classes', desc: 'Create and manage reusable styles.', items: this.presets.definitions() },
			{ type: 'page', name: 'Help and examples', desc: 'Style a single diagram and try your settings on an example.', items: [
				rowDefinition('Local overrides', 'Apply settings to one diagram using visible source comments.', row => { localOverridesGuide(row.controlEl); }),
				this.example.definition(),
			] },
		];
		const decorate = (items: SettingDefinitionItem[]): SettingDefinitionItem[] => items.map(item => {
			if ('items' in item && item.items) return { ...item, items: decorate(item.items) } as typeof item;
			if ('render' in item && item.render) {
				const render = item.render;
				return { ...item, render: (row, group) => {
					this.navigation.bind(row.settingEl.ownerDocument);
					row.settingEl.addClass('advanced-mermaid-settings');
					row.settingEl.dataset.followTheme = String(this.settings.style.followObsidianTheme);
					return render(row, group);
				} };
			}
			return item;
		});
		return decorate(definitions);
	}
	hide(): void {
		this.example.destroy();
		this.styles.endSession();
		this.navigation.destroy();
	}
}
