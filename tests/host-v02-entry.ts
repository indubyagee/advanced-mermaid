/** Isolated real-host probe. It never registers a competing Markdown processor. */
import { Plugin, MarkdownView, editorInfoField } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { undo, redo } from '@codemirror/commands';
import { createInlineExtension } from '../src/editor/extension';
import { normalizeSettings } from '../src/settings';
import { AdvancedMermaidSettingTab } from '../src/ui/settings-tab';
import { DiagramController } from '../src/rendering/controller';
import { createPng } from '../src/export/png';
import { normalizeColor } from '../src/styles/colors';

const pause = (ms = 180): Promise<void> => new Promise(resolve => window.setTimeout(resolve, ms));

export default class V02HostProbe extends Plugin {
	settings = normalizeSettings({ schemaVersion: 3, maxHeight: 'none', liveEditor: { fontSizePx: 19 } });
	inline = createInlineExtension(this.app, () => this.settings);
	tab = new AdvancedMermaidSettingTab(this.app, this, this.settings, () => {
		this.persisted = this.persisted.then(() => this.saveData(normalizeSettings(this.settings)));
		this.inline.refresh();
	});
	persisted = Promise.resolve();
	private parents = new Map<string, EditorView>();
	checkInheritedSwatch(): boolean {
		const doc = this.tab.containerEl.ownerDocument;
		const input = doc.querySelector<HTMLInputElement>('[aria-label="Diagram background Light picker"]');
		if (!input) return false;
		const expected = normalizeColor(doc.defaultView!.getComputedStyle(input).getPropertyValue('--pele-bg'));
		return expected !== null && input.value === expected.slice(0, 7);
	}

	async onload(): Promise<void> {
		const saved: unknown = await this.loadData();
		if (saved) Object.assign(this.settings, normalizeSettings(saved));
		this.registerEditorExtension([this.inline.extension, EditorView.updateListener.of(update => {
			const path = update.state.field(editorInfoField, false)?.file?.path; if (path) this.parents.set(path, update.view);
		})]);
		this.addSettingTab(this.tab);
		this.register(() => { this.inline.destroy(); this.parents.clear(); });
		(window as unknown as { advancedMermaidV02Probe?: V02HostProbe }).advancedMermaidV02Probe = this;
		this.register(() => { delete (window as unknown as { advancedMermaidV02Probe?: V02HostProbe }).advancedMermaidV02Probe; });
	}

	async editors(path: string): Promise<Record<string, unknown>> {
		// Legacy host probe preserves its original settings/leaf integration.
		const beforeLeaf = this.app.workspace.activeLeaf;
		const source = 'Before the v0.2.0 test.\n\n~~~mermaid\nflowchart LR\n A[Start] --> B[End]\n~~~\n\n```pele\nflowchart LR\n C[Other] --> D[Done]\n```\n\nAfter the v0.2.0 test.\n';
		const file = await this.app.vault.create(path, source);
		const leaf = this.app.workspace.getLeaf('tab');
		const report: Record<string, unknown> = { path };
		try {
			await leaf.openFile(file);
			await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false }, active: true });
			const view = leaf.view; if (!(view instanceof MarkdownView)) throw new Error('Markdown view unavailable.');
			view.editor.setCursor({ line: 3, ch: 2 }); view.editor.focus(); await pause();
			const parent = this.parents.get(path); if (!parent) throw new Error('Host CodeMirror view unavailable.');
			const root = view.containerEl;
			const bars = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('.advanced-mermaid-editor-mode'));
			const mode = (index: number, live: boolean): void => { Array.from(bars()[index]!.querySelectorAll('button')).find(button => button.textContent === (live ? 'Live editor' : 'Static editor'))?.click(); };
			const choose = (id: string): void => { const select = root.querySelector<HTMLSelectElement>('[aria-label="Insert local override"]')!; select.value = id; select.dispatchEvent(new Event('change')); };
			report.modeControls = bars().length;
			mode(0, true); await pause(); report.mermaidInlineEditor = root.querySelectorAll('.advanced-mermaid-editor').length === 1;
			const unchanged = view.editor.getValue(); choose('display:align'); await pause();
			report.overrideInserted = view.editor.getValue().includes('%% advanced-mermaid: align=center');
			report.oneUndo = undo(parent) && view.editor.getValue() === unchanged;
			report.redo = redo(parent); await pause();
			choose('style:--pele-surface'); await pause(); report.styleInserted = view.editor.getValue().includes('%% advanced-mermaid-style:v1');
			this.settings.liveEditor.activation = 'focused-block'; this.inline.refresh(); mode(0, false); await pause();
			view.editor.setCursor({ line: 4, ch: 1 }); await pause();
			report.staticSuppressed = !root.querySelector('.advanced-mermaid-editor');
			parent.dispatch({ changes: { from: 0, insert: 'Prefix\n' } }); await pause();
			report.staticMapped = !root.querySelector('.advanced-mermaid-editor');
			mode(0, true); await pause();
			const widget = root.querySelector<HTMLElement>('.advanced-mermaid-editor')!;
			const nested = EditorView.findFromDOM(widget.querySelector('.cm-editor')!)!;
			Array.from(widget.querySelectorAll('button')).find(button => button.textContent === 'CSS')!.click();
			nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: '.pele { color: red; }' } });
			const valid = view.editor.getValue(); mode(0, false); choose('display:fill');
			report.invalidDraftProtected = !!root.querySelector('.advanced-mermaid-editor') && view.editor.getValue() === valid;
			Array.from(widget.querySelectorAll('button')).find(button => button.textContent === 'Discard changes')!.click(); mode(0, false); await pause();
			mode(1, true); await pause(); report.advancedMermaidEditor = root.querySelectorAll('.advanced-mermaid-editor').length === 1;
			mode(1, false); await view.save();
			report.savedSourceOnly = (await this.app.vault.read(file)).includes('~~~mermaid') && !(await this.app.vault.read(file)).includes('<svg');
			await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' }, active: true }); await pause(400);
			report.readingNative = root.querySelectorAll('svg:not(.pele)').length > 0 && !root.querySelector('.advanced-mermaid-editor');
		} finally {
			leaf.detach(); if (beforeLeaf) this.app.workspace.setActiveLeaf(beforeLeaf, { focus: true });
		}
		return report;
	}

	async exports(): Promise<Record<string, unknown>> {
		const sources = [
			'flowchart LR\n A[Preset]:::Probe --> B[Done]',
			'stateDiagram-v2\n A --> B\n class A Probe',
			'agentflow-beta\n A[Task]:::Probe --> B[Task]',
			'mindmap\n root((Root))\n  Child[Child]\n   :::Probe',
			'treeView-beta\nroot/\n  file.ts :::Probe',
			'treemap-beta\n "Group"\n  "Item": 10:::Probe',
		];
		const previousTheme = ['theme-dark', 'theme-light'].filter(mode => document.body.classList.contains(mode));
		let svgParity = true; let pngDimensions = true; let svgPortable = true;
		try {
			for (const theme of ['theme-light', 'theme-dark']) {
				document.body.classList.remove('theme-dark', 'theme-light'); document.body.classList.add(theme);
				for (const source of sources) {
					const host = document.body.createDiv();
					const settings = normalizeSettings({ schemaVersion: 4, presets: [{ alias: 'Probe', fill: '#12345680', text: '#abcdef', stroke: '#335577', width: 2.5 }] });
					const controller = new DiagramController(host, source, () => settings, this.app, ''); controller.load();
					try {
						const visible = getComputedStyle(host.querySelector('.pele-node.Probe text')!).fill;
						const snapshot = await controller.snapshot(); const parsed = new DOMParser().parseFromString(snapshot.svg, 'image/svg+xml');
						svgParity &&= parsed.querySelector<SVGElement>('.pele-node.Probe text')!.style.fill === visible;
						const png = await createPng(snapshot, document, new AbortController().signal); const bitmap = await createImageBitmap(png);
						pngDimensions &&= bitmap.width === Math.ceil(snapshot.width * 2) && bitmap.height === Math.ceil(snapshot.height * 2); bitmap.close();
						svgPortable &&= !snapshot.svg.includes('var(');
					} finally { controller.destroy(); host.remove(); }
				}
			}
			return { sixFamiliesBothThemes: true, svgParity, pngDimensions, svgPortable };
		} finally { document.body.classList.remove('theme-dark', 'theme-light'); document.body.classList.add(...previousTheme); }
	}

	async panes(path: string): Promise<Record<string, unknown>> {
		// Legacy host probe preserves its original settings/leaf integration.
		const beforeLeaf = this.app.workspace.activeLeaf;
		const file = await this.app.vault.create(path, '~~~mermaid\nflowchart LR\n A-->B\n~~~\n');
		const first = this.app.workspace.getLeaf('tab'); await first.openFile(file);
		await first.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false }, active: true });
		const second = this.app.workspace.getLeaf('split'); await second.openFile(file);
		await second.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false }, active: true });
		try {
			const firstRoot = first.view.containerEl; const secondRoot = second.view.containerEl;
			const click = (root: HTMLElement, live: boolean): void => { Array.from(root.querySelector('.advanced-mermaid-editor-mode')!.querySelectorAll('button')).find(button => button.textContent === (live ? 'Live editor' : 'Static editor'))!.click(); };
			click(firstRoot, true); click(secondRoot, true); await pause();
			const independent = firstRoot.querySelectorAll('.advanced-mermaid-editor').length === 1 && secondRoot.querySelectorAll('.advanced-mermaid-editor').length === 1;
			click(firstRoot, false); await pause();
			const staticIsolated = !firstRoot.querySelector('.advanced-mermaid-editor') && !!secondRoot.querySelector('.advanced-mermaid-editor');
			const nested = EditorView.findFromDOM(secondRoot.querySelector('.advanced-mermaid-editor-source .cm-editor')!)!;
			nested.dispatch({ changes: { from: nested.state.doc.length, insert: '\n B-->C[Shared]' } }); await pause(300);
			const sharedSource = first.view instanceof MarkdownView && first.view.editor.getValue().includes('C[Shared]');
			if (second.view instanceof MarkdownView) await second.view.save();
			return { independent, staticIsolated, sharedSource };
		} finally { second.detach(); first.detach(); if (beforeLeaf) this.app.workspace.setActiveLeaf(beforeLeaf, { focus: true }); }
	}
}
