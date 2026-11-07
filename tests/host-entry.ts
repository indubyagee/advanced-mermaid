/** In-memory probe for the actual installed Obsidian; never bundled into the plugin. */
import { Plugin, MarkdownView, editorInfoField, editorLivePreviewField, type App } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { undo, redo } from '@codemirror/commands';
import { createInlineExtension } from '../src/editor/extension';
import { normalizeSettings } from '../src/settings';
import { renderNativeMermaid } from '../src/rendering/mermaid-adapter';
import { diagramFences } from '../src/editor/fences';
import { AdvancedMermaidSettingTab } from '../src/ui/settings-tab';
class ProbeOwner extends Plugin {}
export default class InlineEditorHostProbe extends Plugin {
	async onload(): Promise<void> {
		try { console.debug('ADVANCED_MERMAID_RESULT', JSON.stringify(await run(this.app))); }
		catch (error) { console.error('ADVANCED_MERMAID_ERROR', error); }
	}
	onunload(): void {
		const probe = (window as unknown as { advancedMermaidProbe?: { owner: Plugin; inline: { destroy(): void } } }).advancedMermaidProbe;
		probe?.inline.destroy(); probe?.owner.unload();
	}
}

export async function run(app: App): Promise<Record<string, unknown>> {
	const path = 'tests/advanced-mermaid-host-' + Date.now() + '.md';
	const source = 'Before the diagram.\n\n```pele\nflowchart LR\n A[Start] --> B[End]\n```\n\nAfter the diagram.\n\n```pele\nsequenceDiagram\n Alice->>Bob: Hello\n```\n';
	const file = await app.vault.create(path, source);
	const owner = new ProbeOwner(app, { id: 'advanced-mermaid-probe', name: 'Advanced Mermaid probe', version: '0.0.0', minAppVersion: '1.14.5', description: 'In-memory host probe', author: 'Local', isDesktopOnly: true });
	owner.load();
	const settings = normalizeSettings(null); settings.liveEditor.mermaidComparison = true;
	const inline = createInlineExtension(app, () => settings);
	let parent: EditorView | undefined;
	owner.registerEditorExtension([inline.extension, EditorView.updateListener.of(update => { if (update.state.field(editorInfoField, false)?.file?.path === path) parent = update.view; })]);
	const leaf = app.workspace.getLeaf('tab'); await leaf.openFile(file);
	await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false }, active: true });
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) throw new Error('Markdown view unavailable');
	view.editor.setCursor({ line: 3, ch: 3 }); view.editor.focus();
	await new Promise(resolve => window.setTimeout(resolve, 300));
	const nodes: string[] = [];
	if (parent) syntaxTree(parent.state).iterate({ enter(node) { if (/code|fence/i.test(node.name)) nodes.push(node.name + ':' + node.from + '-' + node.to); } });
	const focusedCommand = inline.toggle(false, view.editor);
	const opened = focusedCommand || inline.openAt(path, 2); await new Promise(resolve => window.setTimeout(resolve, 350));
	const root = leaf.view.containerEl;
	const widget = root.querySelector<HTMLElement>('.advanced-mermaid-editor');
	const report: Record<string, unknown> = { path, parent: !!parent, focusedCommand, livePreview: parent?.state.field(editorLivePreviewField, false), ranges: parent ? diagramFences(parent.state) : [], opened, widgets: root.querySelectorAll('.advanced-mermaid-editor').length, nodes };
	if (widget && parent) {
		const nested = EditorView.findFromDOM(widget.querySelector('.advanced-mermaid-editor-source .cm-editor')!);
		if (nested) {
			const before = view.editor.getValue(); nested.dispatch({ changes: { from: nested.state.doc.length, insert: '\n B --> C[Host]' } });
			report.immediateParentEdit = view.editor.getValue().includes('C[Host]');
			report.oneUndo = undo(parent) && view.editor.getValue() === before;
			report.redo = redo(parent) && view.editor.getValue().includes('C[Host]');
			await new Promise(resolve => window.setTimeout(resolve, 400));
			report.canonicalSvg = widget.querySelectorAll('svg.pele').length;
			report.sourcePreserved = view.editor.getValue().startsWith('Before the diagram.') && view.editor.getValue().includes('After the diagram.');
			report.widgetReused = widget === root.querySelector('.advanced-mermaid-editor');
			const click = (label: string): void => { Array.from(widget.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === label)?.click(); };
			click('CSS'); nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: '.pele { --pele-fg: #246; }' } });
			await new Promise(resolve => window.setTimeout(resolve, 350));
			report.cssSaved = view.editor.getValue().includes('%% advanced-mermaid-style:v1');
			const valid = view.editor.getValue(); nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: '.pele { color:red; }' } });
			await new Promise(resolve => window.setTimeout(resolve, 300));
			report.invalidCssPreservedNote = view.editor.getValue() === valid;
			click('Close editor'); report.invalidCloseProtected = widget.isConnected;
			click('Discard changes'); click('Mermaid');
			nested.dispatch({ changes: { from: nested.state.doc.length, insert: '\n C[unclosed' } });
			await new Promise(resolve => window.setTimeout(resolve, 350));
			report.stalePreview = !!widget.querySelector('.advanced-mermaid-stale svg.pele');
			undo(parent); await new Promise(resolve => window.setTimeout(resolve, 350));
			report.recoveredPreview = !widget.querySelector('.advanced-mermaid-stale') && !!widget.querySelector('svg.pele');
			parent.dispatch({ changes: { from: 0, insert: 'Prefix\n' } });
			report.mappedPrefix = widget === root.querySelector('.advanced-mermaid-editor') && nested.state.doc.toString().startsWith('%% advanced-mermaid-style:v1');
			await view.save(); report.savedSourceOnly = (await app.vault.read(file)).includes('%% advanced-mermaid-style:v1') && !(await app.vault.read(file)).includes('<svg');
			inline.toggle(false, view.editor); await new Promise(resolve => window.setTimeout(resolve, 50));
			report.closedWithoutLoss = !root.querySelector('.advanced-mermaid-editor') && view.editor.getValue().includes('After the diagram.');
		}
	}
	const host = root.createDiv();
	try {
		await renderNativeMermaid('flowchart LR\n A[Start] --> B[End]', host, () => true); report.nativeFlowchart = !!host.querySelector('svg');
		await renderNativeMermaid('sequenceDiagram\n Alice->>Bob: Hello', host, () => true); report.nativeSequence = !!host.querySelector('svg');
	} catch (error) { report.nativeError = String(error); } finally { host.remove(); }
	const settingsHost = root.createDiv();
	const tab = new AdvancedMermaidSettingTab(app, owner, settings, () => {}); tab.containerEl = settingsHost; tab.display();
	report.settingsSections = settingsHost.querySelectorAll('.advanced-mermaid-type-settings').length;
	tab.hide(); settingsHost.remove();
	const globals = window as unknown as { advancedMermaidProbe?: { owner: Plugin; inline: typeof inline; report: typeof report } };
	globals.advancedMermaidProbe = { owner, inline, report };
	return report;
}
