import { setIcon, type App, type Component, type Modal, type WorkspaceLeaf } from 'obsidian';
import { createPng } from '../export/png';
import { exportBasename, saveExport, type ExportExtension } from '../export/files';
import type { SvgSnapshot } from '../export/svg';
import { SaveExportModal, SvgSourceModal } from './export-modal';
import { errorText } from './diagram-error';

export interface ExportRequest {
	snapshot: () => Promise<SvgSnapshot>;
	current: () => boolean;
	canvas?: { source: string; current: () => boolean };
	authored?: { source: string; current: () => boolean };
}
const labels = {
	'copy-svg': 'Copy SVG', 'save-svg': 'Save SVG', 'copy-png': 'Copy PNG', 'save-png': 'Save PNG', 'save-canvas': 'Save canvas',
	'save-mmd': 'Save .mmd', 'save-mermaid': 'Save .mermaid',
};
type Action = keyof typeof labels;
const noteActions: readonly Action[] = ['copy-svg', 'save-svg', 'copy-png', 'save-png', 'save-canvas'];
let nextDiagram = 0;

/** Export operations are initiated only by an explicit diagram action. */
export class DiagramActions {
	private readonly diagram = ++nextDiagram;
	private readonly buttons = new Map<Action, HTMLButtonElement>();
	private readonly status: HTMLElement;
	private readonly openCanvasButton: HTMLButtonElement;
	private readonly abort = new AbortController();
	private modal?: Modal;
	private savedCanvasPath?: string;
	private busy = false;
	private valid = false;
	private disposed = false;

	constructor(private readonly app: App, owner: Component, private readonly host: HTMLElement,
		private readonly sourcePath: string | (() => string), private readonly capture: () => ExportRequest, private readonly footerStatus?: HTMLElement) {
		const diagram = this.diagram;
		// Keep host editor click handlers from turning an export action into an edit.
		for (const event of ['click', 'dblclick', 'pointerdown'] as const) {
			owner.registerDomEvent(host, event, evt => evt.stopPropagation());
			if (footerStatus) owner.registerDomEvent(footerStatus, event, evt => evt.stopPropagation());
		}
		const addButton = (group: HTMLElement, action: Action): void => {
			const label = footerStatus && action === 'save-canvas' ? 'Save .canvas' : labels[action];
			const button = group.createEl('button', { text: label, attr: { type: 'button' } });
			if (action === 'copy-svg') button.title = 'Copy SVG source text';
			if (action === 'copy-png' && !this.canCopyPng()) {
				button.disabled = true;
				button.dataset.unavailable = 'true';
				button.title = 'PNG copy is unavailable here. Save the PNG instead.';
				if (!footerStatus) group.createEl('small', { text: 'PNG copy is unavailable here. Save the PNG instead.' });
			}
			owner.registerDomEvent(button, 'click', () => { void this.run(action); });
			this.buttons.set(action, button);
		};
		const menu = host.createEl(footerStatus ? 'div' : 'details', {
			cls: footerStatus ? 'advanced-mermaid-export advanced-mermaid-export-toolbar' : 'advanced-mermaid-export',
		});
		let feedback = host;
		let canvasAction: HTMLElement;
		if (footerStatus) {
			const id = `advanced-mermaid-export-${diagram}`;
			const disclosure = menu.createEl('button', { text: 'Export', attr: { type: 'button', 'aria-expanded': 'false', 'aria-controls': id } });
			const options = menu.createDiv({ cls: 'advanced-mermaid-export-options', attr: { id } });
			options.hidden = true;
			const copy = options.createDiv({ cls: 'advanced-mermaid-export-copy' });
			for (const action of ['copy-svg', 'copy-png'] as const) addButton(copy, action);
			const save = options.createDiv({ cls: 'advanced-mermaid-export-save' });
			for (const action of ['save-svg', 'save-png', 'save-canvas', 'save-mmd', 'save-mermaid'] as const) addButton(save, action);
			const collapse = options.createEl('button', { attr: { type: 'button', 'aria-label': 'Collapse export', title: 'Collapse export' } });
			setIcon(collapse, 'chevron-up');
			owner.registerDomEvent(disclosure, 'click', () => {
				disclosure.setAttribute('aria-expanded', 'true');
				disclosure.hidden = true;
				options.hidden = false;
				(this.buttons.get('copy-svg')?.disabled ? collapse : this.buttons.get('copy-svg'))?.focus();
			});
			owner.registerDomEvent(collapse, 'click', () => {
				options.hidden = true;
				disclosure.hidden = false;
				disclosure.setAttribute('aria-expanded', 'false');
				disclosure.focus();
			});
			feedback = canvasAction = footerStatus;
		} else {
			menu.createEl('summary', { text: 'Export' });
			const options = menu.createDiv({ cls: 'advanced-mermaid-export-options' });
			for (const action of noteActions) addButton(options, action);
			canvasAction = options;
		}
		this.status = feedback.createEl('p', { cls: 'advanced-mermaid-export-status', attr: { role: 'status' } });
		this.openCanvasButton = canvasAction.createEl('button', { text: 'Open canvas', attr: { type: 'button' } });
		this.openCanvasButton.hidden = true;
		owner.registerDomEvent(this.openCanvasButton, 'click', () => { void this.openSavedCanvas(); });
		owner.register(() => { this.disposed = true; this.abort.abort(); this.closeModal(); });
	}

	closeModal(): void { this.modal?.close(); }

	setValid(value: boolean, supportsCanvas = false): void {
		const changed = this.valid !== value;
		this.valid = value;
		this.host.hidden = !value;
		this.buttons.get('save-canvas')!.hidden = !supportsCanvas;
		this.updateButtons();
		if (!this.savedCanvasPath && (!this.footerStatus || changed || !value)) this.status.textContent = '';
	}

	private get path(): string { return typeof this.sourcePath === 'function' ? this.sourcePath() : this.sourcePath; }
	private get basename(): string { return exportBasename(this.path, String(this.diagram)); }

	private updateButtons(): void {
		for (const button of this.buttons.values()) {
			button.disabled = !this.valid || this.busy || button.hidden || button.dataset.unavailable === 'true';
		}
	}

	private async save(extension: ExportExtension, isCurrent: () => boolean,
		write: (folder: string, current: () => boolean) => Promise<string>, description?: string): Promise<void> {
		if (!isCurrent()) throw new Error('The diagram changed. Export it again.');
		const sourcePath = this.path;
		const folder = sourcePath.slice(0, Math.max(0, sourcePath.lastIndexOf('/')));
		const path = await new Promise<string | null>(resolve => {
			this.modal = new SaveExportModal(this.app, this.basename + '.' + extension, folder,
				(destination, open) => write(destination, () => open() && isCurrent()), resolve, description);
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
		} else if (isCurrent()) this.status.textContent = 'Export cancelled.';
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
			if (action === 'save-mmd' || action === 'save-mermaid') {
				const authored = captured.authored;
				if (!authored) throw new Error('Mermaid source is unavailable for this preview.');
				const extension = action === 'save-mmd' ? 'mmd' : 'mermaid';
				await this.save(extension, authored.current, (folder, current) =>
					saveExport(this.app.vault, folder, this.basename, extension, authored.source, current));
				return;
			}
			if (action === 'save-canvas') {
				const canvasRequest = captured.canvas;
				if (!canvasRequest) throw new Error('Choose a Flowchart or Agentflow to save as a canvas.');
				const { createCanvasExport, createCanvasSaver } = await import('../export/canvas');
				if (!canvasRequest.current()) throw new Error('The diagram changed. Export it again.');
				const canvas = createCanvasExport(canvasRequest.source);
				const notes = canvas.nodes.filter(node => node.type === 'file').length;
				const base = 'Canvas uses its own cards and lines. Circle and cross markers become plain ends.';
				const description = notes
					? base + ' This export creates ' + notes + ' Markdown ' + (notes === 1 ? 'note' : 'notes') + ' in the selected folder.'
					: base;
				await this.save('canvas', canvasRequest.current, createCanvasSaver(this.app.vault, this.basename, canvas), description);
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
				await this.save(extension, captured.current, (folder, current) =>
					saveExport(this.app.vault, folder, this.basename, extension, data, current));
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
			let isCurrent = request?.current;
			if (action === 'save-canvas') isCurrent = request?.canvas?.current;
			if (action === 'save-mmd' || action === 'save-mermaid') isCurrent = request?.authored?.current;
			if (!this.disposed && (!isCurrent || isCurrent())) this.status.textContent = `Export failed: ${errorText(error)}`;
			else if (!this.disposed && action === 'save-canvas') this.status.textContent = 'The diagram changed. Export it again.';
		} finally {
			this.busy = false;
			this.updateButtons();
		}
	}
}
