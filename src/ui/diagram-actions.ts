import type { App, Component, Modal } from 'obsidian';
import { createPng } from '../export/png';
import { exportBasename, saveExport } from '../export/files';
import type { SvgSnapshot } from '../export/svg';
import { SaveExportModal, SvgSourceModal } from './export-modal';
import { errorText } from './diagram-error';

export interface ExportRequest {
	snapshot: () => Promise<SvgSnapshot>;
	current: () => boolean;
}
type Action = 'copy-svg' | 'save-svg' | 'copy-png' | 'save-png';
let nextDiagram = 0;

/** Export operations are initiated only by an explicit diagram action. */
export class DiagramActions {
	private readonly buttons: HTMLButtonElement[] = [];
	private readonly status: HTMLElement;
	private readonly basename: string;
	private readonly abort = new AbortController();
	private modal?: Modal;
	private busy = false;
	private valid = false;
	private disposed = false;

	constructor(private readonly app: App, owner: Component, private readonly host: HTMLElement,
		private readonly sourcePath: string, private readonly capture: () => ExportRequest) {
		this.basename = exportBasename(sourcePath, String(++nextDiagram));
		const menu = host.createEl('details', { cls: 'advanced-mermaid-export' });
		menu.createEl('summary', { text: 'Export' });
		// Keep host editor click handlers from turning an export action into an edit.
		for (const event of ['click', 'dblclick', 'pointerdown'] as const) {
			owner.registerDomEvent(host, event, evt => evt.stopPropagation());
		}
		const options = menu.createDiv({ cls: 'advanced-mermaid-export-options' });
		const labels: Record<Action, string> = { 'copy-svg': 'Copy SVG', 'save-svg': 'Save SVG', 'copy-png': 'Copy PNG', 'save-png': 'Save PNG' };
		for (const action of Object.keys(labels) as Action[]) {
			const button = options.createEl('button', { text: labels[action], attr: { type: 'button' } });
			if (action === 'copy-svg') button.title = 'Copy SVG source text';
			if (action === 'copy-png' && !this.canCopyPng()) {
				button.disabled = true;
				button.dataset.unavailable = 'true';
				options.createEl('small', { text: 'PNG copy is unavailable here. Save the PNG instead.' });
			}
			owner.registerDomEvent(button, 'click', () => { void this.run(action); });
			this.buttons.push(button);
		}
		this.status = host.createEl('p', { cls: 'advanced-mermaid-export-status', attr: { role: 'status' } });
		owner.register(() => { this.disposed = true; this.abort.abort(); this.modal?.close(); });
	}

	setValid(value: boolean): void {
		this.valid = value;
		this.host.hidden = !value;
		for (const button of this.buttons) button.disabled = !value || this.busy || button.dataset.unavailable === 'true';
		this.status.textContent = '';
	}

	private canCopyPng(): boolean {
		const view = this.host.ownerDocument.defaultView;
		return !!view?.navigator.clipboard?.write && typeof view.ClipboardItem === 'function'
			&& (typeof view.ClipboardItem.supports !== 'function' || view.ClipboardItem.supports('image/png'));
	}

	private async run(action: Action): Promise<void> {
		if (this.busy || !this.valid || this.disposed) return;
		this.busy = true;
		this.setValid(this.valid);
		this.status.textContent = 'Preparing export…';
		let request: ExportRequest | undefined;
		try {
			request = this.capture();
			const captured = request;
			const view = this.host.ownerDocument.defaultView!;
			const snapshot = request.snapshot();
			// A platform may reject a clipboard request before consuming its data.
			void snapshot.catch(() => {});
			const png = (): Promise<Blob> => snapshot.then(value => createPng(value, this.host.ownerDocument, this.abort.signal));
			if (action.startsWith('save-')) {
				const extension = action === 'save-svg' ? 'svg' : 'png';
				const data = extension === 'svg' ? (await snapshot).svg : await (await png()).arrayBuffer();
				if (!request.current()) throw new Error('The diagram changed. Export it again.');
				const path = await new Promise<string | null>(resolve => {
					this.modal = new SaveExportModal(this.app, `${this.basename}.${extension}`,
						this.sourcePath.slice(0, Math.max(0, this.sourcePath.lastIndexOf('/'))),
						folder => saveExport(this.app.vault, folder, this.basename, extension, data, captured.current), resolve);
					this.modal.open();
				});
				if (request.current()) this.status.textContent = path ? `Saved ${path}` : 'Export cancelled.';
			} else if (action === 'copy-png') {
				if (!this.canCopyPng()) throw new Error('PNG copy is unavailable here. Use Save PNG.');
				// Promise-backed data starts the clipboard request during user activation.
				const blob = png().then(value => {
					if (!captured.current()) throw new Error('The diagram changed. Export it again.');
					return value;
				});
				void blob.catch(() => {});
				await view.navigator.clipboard.write([new view.ClipboardItem({ 'image/png': blob })]);
				if (request.current()) this.status.textContent = 'Copied PNG.';
			} else {
				try {
					if (!view.navigator.clipboard) throw new Error('Clipboard is unavailable.');
					if (view.ClipboardItem && view.navigator.clipboard.write) {
						const blob = snapshot.then(value => {
							if (!captured.current()) throw new Error('The diagram changed. Export it again.');
							return new view.Blob([value.svg], { type: 'text/plain' });
						});
						void blob.catch(() => {});
						await view.navigator.clipboard.write([new view.ClipboardItem({ 'text/plain': blob })]);
					} else {
						const value = await snapshot;
						if (!request.current()) throw new Error('The diagram changed. Export it again.');
						await view.navigator.clipboard.writeText(value.svg);
					}
					if (request.current()) this.status.textContent = 'Copied SVG source.';
				} catch {
					const value = await snapshot;
					if (!request.current()) return;
					this.modal = new SvgSourceModal(this.app, value.svg);
					this.modal.open();
					this.status.textContent = 'Clipboard unavailable. Copy the SVG source from the dialog.';
				}
			}
		} catch (error) {
			if (!this.disposed && (!request || request.current())) this.status.textContent = `Export failed: ${errorText(error)}`;
		} finally {
			this.busy = false;
			for (const button of this.buttons) button.disabled = !this.valid || button.dataset.unavailable === 'true';
		}
	}
}
