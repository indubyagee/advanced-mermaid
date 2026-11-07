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
			rowDefinition('Preset classes', 'Manage reusable classes for Flowchart, State, Agentflow, Mindmap, TreeView and Treemap. Properties apply only to existing shapes and labels.', row => {
				row.addDropdown(input => { input.selectEl.setAttribute('aria-label', 'Preset class selection'); input.addOptions({ '': 'Select a preset', ...Object.fromEntries(this.settings.presets.map(entry => [entry.alias, entry.alias])) }).setValue(selected() ? this.selected : '').onChange(value => { this.selected = value; edit.setDisabled(!selected()); remove.setDisabled(!selected()); }); });
				row.addButton(button => button.setButtonText('Create').onClick(() => new PresetModal(this.app, this.settings, saved, 'form').open()));
				let edit: import('obsidian').ButtonComponent; let remove: import('obsidian').ButtonComponent;
				row.addButton(button => { edit = button; button.setButtonText('Edit').setDisabled(!selected()).onClick(() => { const entry = selected(); if (entry) new PresetModal(this.app, this.settings, saved, 'form', entry).open(); }); });
				row.addButton(button => { remove = button; button.setButtonText('Delete').setDisabled(!selected()).onClick(() => { const entry = selected(); if (entry) new DeletePresetModal(this.app, entry.alias, () => { this.settings.presets = this.settings.presets.filter(item => item.alias !== entry.alias); saved(); }).open(); }); });
			}),
			rowDefinition('Preset class code block', 'Generated text for the saved library. Use Edit preset text for manual changes; the entire draft is validated before saving.', row => {
				const source = row.controlEl.createEl('textarea', { cls: 'advanced-mermaid-preset-source', attr: { readonly: '', 'aria-label': 'Saved preset text' } }); source.value = encodePresets(this.settings.presets);
				row.addButton(button => button.setButtonText('Edit preset text').onClick(() => new PresetModal(this.app, this.settings, saved, 'text').open()));
			}),
		];
	}
}
