import { ItemView, Notice, type Workspace, type WorkspaceLeaf } from 'obsidian';
import { RecoveryModal } from '../ui/recovery-modal';
import type { LiveEditor } from './live-editor';

export const fullScreenViewType = 'advanced-mermaid-live-editor';

export class FullScreenView extends ItemView {
	navigation = false;
	private closed?: () => void;
	private recovery?: RecoveryModal;

	getViewType(): string { return fullScreenViewType; }
	getDisplayText(): string { return 'Mermaid live editor'; }

	protected async onOpen(): Promise<void> {
		this.contentEl.addClass('advanced-mermaid-full-screen-view');
		this.message('Open a diagram from its Live Editor in the note.');
	}

	show(editor: LiveEditor, closed: () => void): void {
		this.recovery?.close();
		this.contentEl.replaceChildren(editor.element);
		this.closed = closed;
		editor.setFullScreen(true);
	}

	sourceLost(): void {
		this.closed = undefined;
		this.message('The originating note or diagram is unavailable. Editing has stopped. A recovery copy is available for this session.');
		const button = this.contentEl.createEl('button', { text: 'Recover draft', attr: { type: 'button' } });
		this.registerDomEvent(button, 'click', () => {
			this.recovery?.close();
			this.recovery = new RecoveryModal(this.app);
			this.recovery.open();
		});
		button.focus();
	}

	private message(text: string): void {
		this.contentEl.empty();
		this.contentEl.createEl('p', { text, attr: { role: 'status' } });
	}

	protected async onClose(): Promise<void> {
		this.recovery?.close();
		this.recovery = undefined;
		const closed = this.closed;
		this.closed = undefined;
		closed?.();
	}
}

/** The workspace tab borrows the originating editor's surface for one session. */
export class FullScreenEditor {
	private active?: { editor: LiveEditor; view: FullScreenView; observer: MutationObserver };
	private opening = false;
	private disposed = false;

	constructor(private readonly workspace: Workspace, private readonly enabled: () => boolean) {}

	has(editor: LiveEditor): boolean { return this.active?.editor === editor; }

	async open(editor: LiveEditor, origin: WorkspaceLeaf, current: () => boolean, restore: () => void, lost: () => void): Promise<void> {
		if (this.opening || this.disposed || !this.enabled()) return;
		this.opening = true;
		try {
			if (this.active) {
				await this.workspace.revealLeaf(this.active.view.leaf);
				if (this.has(editor)) editor.focus();
				else new Notice('Return to the note from the open Mermaid live editor before opening another diagram full-screen.');
				return;
			}
			const existing = this.workspace.getLeavesOfType(fullScreenViewType)[0];
			const leaf = existing ?? this.workspace.getLeaf('tab');
			if (!existing) await leaf.setViewState({ type: fullScreenViewType, active: true });
			await this.workspace.revealLeaf(leaf);
			if (this.disposed || !(leaf.view instanceof FullScreenView) ||
				!this.workspace.getLeavesOfType(fullScreenViewType).includes(leaf)) return;
			if (!this.enabled()) { leaf.detach(); return; }
			if (!current()) {
				leaf.detach();
				new Notice('The originating diagram changed before the full-screen editor could open.');
				return;
			}
			// Reading view can keep the originating CodeMirror instance alive without an editor transaction.
			const container = origin.view.containerEl;
			const observer = new container.ownerDocument.defaultView!.MutationObserver(() => {
				if (this.has(editor) && !current()) lost();
			});
			observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
			this.active = { editor, view: leaf.view, observer };
			leaf.view.show(editor, () => {
				observer.disconnect();
				this.active = undefined;
				if (this.disposed) return;
				if (!current()) {
					editor.destroy('Originating note or diagram closed');
					lost();
					return;
				}
				restore();
				void this.workspace.revealLeaf(origin).then(() => { if (current() && !this.has(editor)) editor.focus(); })
					.catch(() => new Notice('The live editor returned to its note. Open the note tab to continue.'));
			});
			editor.focus();
		} catch {
			new Notice('Could not open the full-screen live editor.');
		} finally {
			this.opening = false;
		}
	}

	close(editor: LiveEditor): void {
		if (this.active?.editor === editor) this.active.view.leaf.detach();
	}

	sourceLost(editor: LiveEditor): void {
		if (this.active?.editor !== editor) return;
		const { view, observer } = this.active;
		this.active = undefined;
		observer.disconnect();
		editor.destroy('Originating note or diagram closed');
		view.sourceLost();
	}

	destroy(): void {
		this.disposed = true;
		this.active?.observer.disconnect();
		this.active = undefined;
		this.workspace.detachLeavesOfType(fullScreenViewType);
	}
}
