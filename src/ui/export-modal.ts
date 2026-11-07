import { Modal, Setting, TFolder, type App } from 'obsidian';
import { exportFolder } from '../export/files';
import { errorText } from './diagram-error';
import { VaultFolderSuggest } from './folder-suggest';

export class SaveExportModal extends Modal {
	private suggestions?: VaultFolderSuggest;
	constructor(app: App, private readonly filename: string, private folder: string,
		private readonly save: (folder: string) => Promise<string>, private readonly finish: (path: string | null) => void) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Save diagram');
		const destination = this.contentEl.createEl('p');
		const preview = (): void => { destination.textContent = `Save as: ${this.folder ? `${this.folder}/` : ''}${this.filename}`; };
		preview();
		new Setting(this.contentEl).setName('Vault folder').setDesc('Select an existing folder from the suggestions. Leave empty for the vault root.').addText(input => {
			input.setValue(this.folder).setPlaceholder('Vault root').onChange(value => { this.folder = value; preview(); });
			input.inputEl.setAttribute('aria-label', 'Vault folder');
			this.suggestions = new VaultFolderSuggest(this.app, input.inputEl, path => { this.folder = path; preview(); });
		});
		const status = this.contentEl.createEl('p', { attr: { role: 'status' } });
		new Setting(this.contentEl).addButton(button => button.setButtonText('Save').setCta().onClick(async () => {
			button.setDisabled(true);
			try {
				const folder = exportFolder(this.folder);
				if (folder && !(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) throw new Error('Choose an existing folder in this vault.');
				const path = await this.save(folder);
				this.finish(path);
				this.close();
			} catch (error) { status.textContent = errorText(error); }
			finally { button.setDisabled(false); }
		})).addButton(button => button.setButtonText('Cancel').onClick(() => this.close()));
	}

	onClose(): void {
		this.suggestions?.close();
		this.suggestions = undefined;
		this.contentEl.empty();
		this.finish(null);
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
