import type { App, Component, Modal, WorkspaceLeaf } from 'obsidian';
import { createPng } from '../export/png';
import { exportBasename, saveExport, type ExportExtension } from '../export/files';
import type { SvgSnapshot } from '../export/svg';
import { SaveExportModal, SvgSourceModal } from './export-modal';
import { errorText } from './diagram-error';

export interface ExportRequest {
	snapshot: () => Promise<SvgSnapshot>;
	current: () => boolean;
	canvasSource?: string;
}
const labels = {
	'copy-svg': 'Copy SVG', 'save-svg': 'Save SVG', 'copy-png': 'Copy PNG', 'save-png': 'Save PNG', 'save-canvas': 'Save canvas',
};
type Action = keyof typeof labels;
let nextDiagram = 0;

/** Export operations are initiated only by an explicit diagram action. */
export class DiagramActions {
	private readonly buttons = new Map<Action, HTMLButtonElement>();
	private readonly status: HTMLElement;
	private readonly openCanvasButton: HTMLButtonElement;
	private readonly basename: string;
	private readonly abort = new AbortController();
	private modal?: Modal;
	private savedCanvasPath?: string;
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
		for (const action of Object.keys(labels) as Action[]) {
			const button = options.createEl('button', { text: labels[action], attr: { type: 'button' } });
			if (action === 'copy-svg') button.title = 'Copy SVG source text';
			if (action === 'copy-png' && !this.canCopyPng()) {
				button.disabled = true;
				button.dataset.unavailable = 'true';
				options.createEl('small', { text: 'PNG copy is unavailable here. Save the PNG instead.' });
			}
			owner.registerDomEvent(button, 'click', () => { void this.run(action); });
			this.buttons.set(action, button);
		}
		this.openCanvasButton = options.createEl('button', { text: 'Open canvas', attr: { type: 'button' } });
		this.openCanvasButton.hidden = true;
		owner.registerDomEvent(this.openCanvasButton, 'click', () => { void this.openSavedCanvas(); });
		this.status = host.createEl('p', { cls: 'advanced-mermaid-export-status', attr: { role: 'status' } });
		owner.register(() => { this.disposed = true; this.abort.abort(); this.modal?.close(); });
	}

	setValid(value: boolean, supportsCanvas = false): void {
		this.valid = value;
		this.host.hidden = !value;
		this.buttons.get('save-canvas')!.hidden = !supportsCanvas;
		this.updateButtons();
		if (!this.savedCanvasPath) this.status.textContent = '';
	}

	private updateButtons(): void {
		for (const button of this.buttons.values()) {
			button.disabled = !this.valid || this.busy || button.hidden || button.dataset.unavailable === 'true';
		}
	}

	private async save(extension: ExportExtension, data: string | ArrayBuffer, request: ExportRequest): Promise<void> {
		if (!request.current()) throw new Error('The diagram changed. Export it again.');
		const folder = this.sourcePath.slice(0, Math.max(0, this.sourcePath.lastIndexOf('/')));
		const description = extension === 'canvas'
			? 'Canvas uses its own cards and lines. Circle and cross markers become plain ends.' : undefined;
		const path = await new Promise<string | null>(resolve => {
			this.modal = new SaveExportModal(this.app, this.basename + '.' + extension, folder,
				(destination, open) => saveExport(this.app.vault, destination, this.basename, extension, data, () => open() && request.current()),
				resolve, description);
			this.modal.open();
		});
		this.modal = undefined;
		if (this.disposed) return;
		if (path) {
			this.status.textContent = 'Saved ' + path;
			if (extension === 'canvas') {
				this.savedCanvasPath = path;
				this.openCanvasButton.hidden = false;
			}
		} else if (request.current()) this.status.textContent = 'Export cancelled.';
	}

	private async openSavedCanvas(): Promise<void> {
		const path = this.savedCanvasPath;
		if (!path || this.disposed || this.openCanvasButton.disabled) return;
		const file = this.app.vault.getFileByPath(path);
		if (!file) {
			this.status.textContent = 'Could not find ' + path + '. It may have been moved or renamed.';
			return;
		}
		this.openCanvasButton.disabled = true;
		let leaf: WorkspaceLeaf | undefined;
		try {
			leaf = this.app.workspace.getLeaf('tab');
			await leaf.openFile(file, { active: true });
			if (leaf.getViewState().type !== 'canvas') throw new Error('Canvas view unavailable.');
			if (this.savedCanvasPath === path) this.status.textContent = 'Saved ' + path;
		} catch {
			if (leaf?.getViewState().type === 'empty') leaf.detach();
			if (this.savedCanvasPath === path) this.status.textContent = 'Saved ' + path + '. Could not open it. Check Settings → Core plugins → Canvas.';
		} finally {
			this.openCanvasButton.disabled = false;
		}
	}

	private canCopyPng(): boolean {
		const view = this.host.ownerDocument.defaultView;
		return !!view?.navigator.clipboard?.write && typeof view.ClipboardItem === 'function'
			&& (typeof view.ClipboardItem.supports !== 'function' || view.ClipboardItem.supports('image/png'));
	}

	private async run(action: Action): Promise<void> {
		if (this.busy || !this.valid || this.disposed) return;
		this.busy = true;
		this.savedCanvasPath = undefined;
		this.openCanvasButton.hidden = true;
		this.updateButtons();
		this.status.textContent = 'Preparing export…';
		let request: ExportRequest | undefined;
		try {
			request = this.capture();
			const captured = request;
			if (action === 'save-canvas') {
				if (captured.canvasSource === undefined) throw new Error('Choose a Flowchart or Agentflow to save as a canvas.');
				const { createCanvasExport } = await import('../export/canvas');
				if (!captured.current()) throw new Error('The diagram changed. Export it again.');
				await this.save('canvas', createCanvasExport(captured.canvasSource), captured);
				return;
			}
			const view = this.host.ownerDocument.defaultView!;
			const snapshot = request.snapshot();
			// A platform may reject a clipboard request before consuming its data.
			void snapshot.catch(() => {});
			const png = (): Promise<Blob> => snapshot.then(value => createPng(value, this.host.ownerDocument, this.abort.signal));
			if (action === 'save-svg' || action === 'save-png') {
				const extension = action === 'save-svg' ? 'svg' : 'png';
				const data = extension === 'svg' ? (await snapshot).svg : await (await png()).arrayBuffer();
				await this.save(extension, data, captured);
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
			else if (!this.disposed && action === 'save-canvas') this.status.textContent = 'The diagram changed. Export it again.';
		} finally {
			this.busy = false;
			this.updateButtons();
		}
	}
}
