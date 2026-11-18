import { Modal, Setting, TFolder, type App, type ButtonComponent } from 'obsidian';
import { exportFolder } from '../export/files';
import { errorText } from './diagram-error';
import { VaultFolderSuggest } from './folder-suggest';

export class SaveExportModal extends Modal {
	private suggestions?: VaultFolderSuggest;
	private saving = false;
	private closed = false;
	constructor(app: App, private readonly filename: string, private folder: string,
		private readonly save: (folder: string, open: () => boolean) => Promise<string>,
		private readonly finish: (path: string | null) => void, private readonly description?: string) {
		super(app);
	}

	onOpen(): void {
		this.closed = false;
		this.setTitle('Save diagram');
		if (this.description) this.contentEl.createEl('p', { text: this.description });
		const destination = this.contentEl.createEl('p');
		const preview = (): void => { destination.textContent = `Save as: ${this.folder ? `${this.folder}/` : ''}${this.filename}`; };
		preview();
		new Setting(this.contentEl).setName('Vault folder').setDesc('Select an existing folder from the suggestions. Leave empty for the vault root.').addText(input => {
			input.setValue(this.folder).setPlaceholder('Vault root').onChange(value => { this.folder = value; preview(); });
			input.inputEl.setAttribute('aria-label', 'Vault folder');
			this.suggestions = new VaultFolderSuggest(this.app, input.inputEl, path => { this.folder = path; preview(); });
		});
		const status = this.contentEl.createEl('p', { attr: { role: 'status' } });
		let cancel: ButtonComponent;
		new Setting(this.contentEl).addButton(button => button.setButtonText('Save').setCta().onClick(async () => {
			if (this.saving || this.closed) return;
			this.saving = true;
			button.setDisabled(true);
			cancel.setDisabled(true);
			try {
				const folder = exportFolder(this.folder);
				if (folder && !(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) throw new Error('Choose an existing folder in this vault.');
				const path = await this.save(folder, () => !this.closed);
				this.finish(path);
				if (!this.closed) this.close();
			} catch (error) {
				if (this.closed) this.finish(null);
				else status.textContent = errorText(error);
			} finally {
				this.saving = false;
				button.setDisabled(false);
				cancel.setDisabled(false);
			}
		})).addButton(button => { cancel = button.setButtonText('Cancel').onClick(() => this.close()); });
	}

	onClose(): void {
		this.closed = true;
		this.suggestions?.close();
		this.suggestions = undefined;
		this.contentEl.empty();
		if (!this.saving) this.finish(null);
	}
}

export class SvgSourceModal extends Modal {
	constructor(app: App, private readonly svg: string) { super(app); }
	onOpen(): void {
		this.setTitle('Copy SVG source');
		this.contentEl.createEl('p', { text: 'Select and copy this SVG source text.' });
		const input = this.contentEl.createEl('textarea', { cls: 'advanced-mermaid-svg-source', attr: { 'aria-label': 'SVG source', readonly: '' } });
		input.value = this.svg;
		input.focus();
		input.select();
	}
	onClose(): void { this.contentEl.empty(); }
}
