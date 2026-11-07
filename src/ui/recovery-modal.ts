import { Modal, Setting, type App } from 'obsidian';
import { recoveryDrafts, discardRecoveryDraft } from '../editor/drafts';

export class RecoveryModal extends Modal {
	constructor(app: App) { super(app); }
	onOpen(): void {
		this.setTitle('Recover inline drafts');
		this.contentEl.createEl('p', { text: 'Session-only drafts. Copy the text before application exit; no note is overwritten.' });
		const drafts = [...recoveryDrafts()];
		if (!drafts.length) this.contentEl.createEl('p', { text: 'No recovery drafts in this session.' });
		for (const draft of drafts) {
			const section = this.contentEl.createEl('details'); section.createEl('summary', { text: draft.file + ' · ' + draft.reason });
			section.createEl('textarea', { cls: 'advanced-mermaid-svg-source', text: draft.source, attr: { readonly: '', 'aria-label': 'Recovered source' } });
			section.createEl('textarea', { cls: 'advanced-mermaid-svg-source', text: draft.css, attr: { readonly: '', 'aria-label': 'Recovered CSS' } });
			new Setting(section).setName('Discard recovery copy').addButton(button => button.setButtonText('Discard').onClick(() => { discardRecoveryDraft(draft.time); section.remove(); }));
		}
	}
}
