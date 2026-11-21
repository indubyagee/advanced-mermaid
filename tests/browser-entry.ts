import { AdvancedMermaidDiagram } from '../src/rendering/diagram';
import { normalizeSettings, type AdvancedMermaidSettings } from '../src/settings';
import type { App } from 'obsidian';
import { TFolder } from './obsidian';
export { AdvancedMermaidSettingTab } from '../src/ui/settings-tab';
export { DIAGRAM_REGISTRY } from '../src/styles/registry';
export { styleExampleSources } from '../src/ui/settings-example';
export { DIAGRAM_SYNTAX } from '../src/editor/syntax/catalog';
export { diagramComponents } from '../src/editor/syntax/components';
export { syntaxBodies } from './syntax-fixtures';
export { DiagramSyntaxSelector } from '../src/ui/diagram-syntax-selector';
export { SaveExportModal } from '../src/ui/export-modal';
export { VaultFolderSuggest } from '../src/ui/folder-suggest';
export { createSvgSnapshot } from '../src/export/svg';
export { createPng } from '../src/export/png';
export { createDetachedEl } from '../src/dom';
export { render } from 'pele';

export const saved = new Map<string, string | ArrayBuffer>();
export const opened = [] as string[];

export function sourceRoot(host: ParentNode): ShadowRoot {
	return host.querySelector('.advanced-mermaid-editor-source > div')!.shadowRoot!;
}

const createdFiles = new Map<string, { path: string }>();
export const app = { plugins: { manifests: {}, plugins: {} }, vault: {
	configDir: '.fixture-config',
	adapter: { exists: (path: string) => Promise.resolve(saved.has(path)), read: (path: string) => {
		const data = saved.get(path);
		return typeof data === 'string' ? Promise.resolve(data) : Promise.reject(new Error('Fixture file missing.'));
	} },
	getAllFolders: () => [new TFolder('attachments'), new TFolder('notes'), new TFolder('notes/nested')],
	getAbstractFileByPath: (path: string) => ['attachments', 'notes', 'notes/nested'].includes(path) ? new TFolder(path) : saved.has(path) ? createdFiles.get(path) ?? { path } : null,
	getFileByPath: (path: string) => saved.has(path) ? { path } : null,
	create: (path: string, data: string) => {
		const file = { path };
		createdFiles.set(path, file);
		saved.set(path, data);
		return Promise.resolve(file);
	},
	createBinary: (path: string, data: ArrayBuffer) => { saved.set(path, data); return Promise.resolve(); },
}, workspace: {
	on: () => ({}),
	getLeaf: () => ({
		openFile: (file: { path: string }) => { opened.push(file.path); return Promise.resolve(); },
		getViewState: () => ({ type: 'canvas' }),
	}),
} } as unknown as App;

export function diagram(source: string, data?: Partial<AdvancedMermaidSettings>, parent: HTMLElement = document.body,
	sourcePath = 'Example.md'): { child: AdvancedMermaidDiagram; host: HTMLElement; settings: AdvancedMermaidSettings } {
	// Create a detached element in its owning document, including pop-outs.
	const host = document.createElement('div');
	host.className = 'fixture-diagram';
	parent.append(host);
	const settings = normalizeSettings(data);
	const child = new AdvancedMermaidDiagram(host, source, () => settings, () => {}, app, sourcePath);
	child.load();
	return { child, host, settings };
}
export { Compartment, EditorState, StateField } from '@codemirror/state';
export { Decoration, EditorView, WidgetType } from '@codemirror/view';
export { history, undo, redo } from '@codemirror/commands';
export { Language, defineLanguageFacet, ensureSyntaxTree, syntaxTree, foldedRanges, foldCode, unfoldCode, indentUnit } from '@codemirror/language';
export { parser as markdownParser } from '@lezer/markdown';
export { editorLivePreviewField, editorInfoField, installDomHelpers } from './obsidian';
export { createInlineExtension } from '../src/editor/extension';
export { normalizeSettings } from '../src/settings';
export { DiagramController } from '../src/rendering/controller';
export { recoveryDrafts } from '../src/editor/drafts';
export { default as AdvancedMermaidPlugin } from '../src/main';
export { setInlineOwner } from '../src/editor/ownership';
export { diagramFences, fenceAt } from '../src/editor/fences';
