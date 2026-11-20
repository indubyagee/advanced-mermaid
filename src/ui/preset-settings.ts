import type { App, SettingDefinitionItem } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { encodePresets } from '../styles/presets';
import { rowDefinition } from './setting-controls';
import { DeletePresetModal, PresetModal } from './preset-modal';

export class PresetSettings {
	private selected = '';
	constructor(private readonly app: App, private readonly settings: AdvancedMermaidSettings, private readonly changed: () => void, private readonly refresh: () => void) {}
	definitions(): SettingDefinitionItem[] {
		const saved = (): void => { this.changed(); this.refresh(); };
		const selected = (): typeof this.settings.presets[number] | undefined => this.settings.presets.find(entry => entry.alias === this.selected);
		return [
			rowDefinition('Manage presets', 'Select a reusable class for Flowchart, State, Agentflow, Mindmap, TreeView, or Treemap.', row => {
				row.addDropdown(input => { input.selectEl.setAttribute('aria-label', 'Preset class selection'); input.addOptions({ '': this.settings.presets.length ? 'Select a preset' : 'No saved presets', ...Object.fromEntries(this.settings.presets.map(entry => [entry.alias, entry.alias])) }).setValue(selected() ? this.selected : '').onChange(value => { this.selected = value; edit.setDisabled(!selected()); remove.setDisabled(!selected()); }); });
				row.addButton(button => button.setButtonText('Create preset').setCta().onClick(() => new PresetModal(this.app, this.settings, saved, 'form').open()));
				let edit: import('obsidian').ButtonComponent; let remove: import('obsidian').ButtonComponent;
				row.addButton(button => { edit = button; button.setButtonText('Edit').setDisabled(!selected()).onClick(() => { const entry = selected(); if (entry) new PresetModal(this.app, this.settings, saved, 'form', entry).open(); }); });
				row.addButton(button => { remove = button; button.setButtonText('Delete').setDisabled(!selected()).onClick(() => { const entry = selected(); if (entry) new DeletePresetModal(this.app, entry.alias, () => { this.settings.presets = this.settings.presets.filter(item => item.alias !== entry.alias); saved(); }).open(); }); });
			}),
			{
				...rowDefinition('Preset text', 'Edit the saved library as text.', row => {
					row.addButton(button => button.setButtonText('Edit preset text').onClick(() => new PresetModal(this.app, this.settings, saved, 'text').open()));
					const disclosure = row.controlEl.createEl('details', { cls: 'advanced-mermaid-preset-code' });
					disclosure.createEl('summary', { text: 'Show generated code' });
					const source = disclosure.createEl('textarea', { cls: 'advanced-mermaid-preset-source', attr: { readonly: '', 'aria-label': 'Saved preset text' } });
					source.value = encodePresets(this.settings.presets);
				}),
				aliases: ['preset class code block', 'generated preset code'],
			},
		];
	}
}
