import { Modal, Setting, type App } from 'obsidian';
import { decodePresets, encodePresets, validatePresets, type PresetClass } from '../styles/presets';
import type { AdvancedMermaidSettings } from '../settings';
import { colorInput, numberControl } from './setting-controls';

/** Both editors commit a complete validated library, never an incomplete draft. */
export class PresetModal extends Modal {
	private readonly baseline: string;
	private cleanups: (() => void)[] = [];
	constructor(app: App, private readonly settings: AdvancedMermaidSettings, private readonly saved: () => void, private readonly mode: 'text' | 'form', private readonly original?: PresetClass) {
		super(app); this.baseline = encodePresets(settings.presets);
	}
	onOpen(): void {
		this.setTitle(this.mode === 'text' ? 'Edit preset text' : this.original ? 'Edit preset class' : 'Create preset class');
		const host = this.contentEl; host.addClass('advanced-mermaid-preset-dialog'); let draftText = this.baseline; const draft: PresetClass = { ...this.original, alias: this.original?.alias ?? '' };
		if (this.mode === 'text') {
			host.createEl('p', { text: 'Edit the preset list. Colors may use hex, RGB or HSL; widths use px. Saving replaces the library without changing notes.' });
			const input = host.createEl('textarea', { cls: 'advanced-mermaid-preset-source', attr: { 'aria-label': 'Preset text', spellcheck: 'false' } }); input.value = draftText;
			input.addEventListener('input', () => { draftText = input.value; });
		} else {
			new Setting(host).setName('Preset class alias').setDesc('Case-sensitive identifier, up to 64 characters. Renaming does not update aliases already used in notes.').addText(input => { input.inputEl.setAttribute('aria-label', 'Preset class alias'); input.setValue(draft.alias).onChange(value => { draft.alias = value.trim(); }); }).addExtraButton(button => button.setIcon('rotate-ccw').setTooltip('Clear alias').onClick(() => { draft.alias = ''; const input = host.querySelector<HTMLInputElement>('[aria-label="Preset class alias"]'); if (input) input.value = ''; }));
			for (const key of ['text', 'fill', 'stroke'] as const) {
				const row = new Setting(host).setName('Preset class ' + key + ' color').setDesc('A fixed color in both themes. Empty inherits. Fill and borders apply only to existing shapes.');
				this.cleanups.push(colorInput(row.controlEl, 'Preset ' + key, () => draft[key], value => { if (value) draft[key] = value; else delete draft[key]; }));
			}
			numberControl(new Setting(host).setName('Preset class stroke width').setDesc('0–20 px for existing shapes. Reset to inherit.'), 'Preset stroke width', () => draft.width, value => { if (value === undefined) delete draft.width; else draft.width = value; }, { min: 0, max: 20, optional: true, fallback: 1, unit: 'px' });
		}
		const status = host.createDiv({ attr: { role: 'status' } });
		new Setting(host).addButton(button => button.setButtonText('Cancel').onClick(() => this.close())).addButton(button => button.setButtonText('Save').setCta().onClick(() => {
			try {
				if (encodePresets(this.settings.presets) !== this.baseline) throw new Error('The preset library changed while this dialog was open. Reopen the editor to use its current version.');
				if (host.querySelector('input:invalid')) throw new Error('Correct the invalid color or size before saving.');
				let entries: PresetClass[];
				if (this.mode === 'text') entries = decodePresets(draftText);
				else {
					const candidates = this.original ? this.settings.presets.map(entry => entry.alias === this.original!.alias ? draft : entry) : [...this.settings.presets, draft];
					const result = validatePresets(candidates); if (result.issues.length) throw new Error(result.issues[0]!.message); entries = result.presets;
				}
				this.settings.presets = entries; this.saved(); this.close();
			} catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
		}));
	}
	onClose(): void { this.cleanups.splice(0).forEach(cleanup => cleanup()); this.contentEl.empty(); }
}

export class DeletePresetModal extends Modal {
	constructor(app: App, private readonly alias: string, private readonly remove: () => void) { super(app); }
	onOpen(): void {
		this.setTitle('Delete preset class');
		this.contentEl.addClass('advanced-mermaid-delete-preset-dialog');
		this.contentEl.createEl('p', { text: `Delete ${this.alias}? Notes keep their class references, but this preset will no longer supply their styles.` });
		new Setting(this.contentEl).addButton(button => button.setButtonText('Cancel').onClick(() => this.close())).addButton(button => button.setButtonText('Delete').setDestructive().onClick(() => { this.remove(); this.close(); }));
	}
	onClose(): void { this.contentEl.empty(); }
}
