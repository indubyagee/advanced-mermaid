import { AdvancedMermaidDiagram } from '../src/rendering/diagram';
import { normalizeSettings, type AdvancedMermaidSettings } from '../src/settings';
import type { App } from 'obsidian';
import { TFolder } from './obsidian';
export { AdvancedMermaidSettingTab } from '../src/ui/settings-tab';
export { SaveExportModal } from '../src/ui/export-modal';
export { VaultFolderSuggest } from '../src/ui/folder-suggest';
export { createSvgSnapshot } from '../src/export/svg';
export { createPng } from '../src/export/png';
export { render } from 'pele';

export const saved = new Map<string, string | ArrayBuffer>();
export const app = { plugins: { manifests: {}, plugins: {} }, vault: {
	configDir: '.fixture-config',
	adapter: { read: (path: string) => {
		const data = saved.get(path);
		return typeof data === 'string' ? Promise.resolve(data) : Promise.reject(new Error('Fixture file missing.'));
	} },
	getAllFolders: () => [new TFolder('attachments'), new TFolder('notes'), new TFolder('notes/nested')],
	getAbstractFileByPath: (path: string) => ['attachments', 'notes', 'notes/nested'].includes(path) ? new TFolder(path) : saved.has(path) ? {} : null,
	create: (path: string, data: string) => { saved.set(path, data); return Promise.resolve(); },
	createBinary: (path: string, data: ArrayBuffer) => { saved.set(path, data); return Promise.resolve(); },
}, workspace: { on: () => ({}) } } as unknown as App;

export function diagram(source: string, data?: Partial<AdvancedMermaidSettings>, parent: HTMLElement = document.body): { child: AdvancedMermaidDiagram; host: HTMLElement; settings: AdvancedMermaidSettings } {
	// Create a detached element in its owning document, including pop-outs.
	const host = document.createElement('div');
	host.className = 'fixture-diagram';
	parent.append(host);
	const settings = normalizeSettings(data);
	const child = new AdvancedMermaidDiagram(host, source, () => settings, () => {}, app, 'Example.md');
	child.load();
	return { child, host, settings };
}
export { Compartment, EditorState, StateField } from '@codemirror/state';
export { Decoration, EditorView, WidgetType } from '@codemirror/view';
export { history, undo, redo } from '@codemirror/commands';
export { Language, defineLanguageFacet } from '@codemirror/language';
export { parser as markdownParser } from '@lezer/markdown';
export { editorLivePreviewField, editorInfoField } from './obsidian';
export { createInlineExtension } from '../src/editor/extension';
export { normalizeSettings } from '../src/settings';
export { DiagramController } from '../src/rendering/controller';
export { recoveryDrafts } from '../src/editor/drafts';
export { default as AdvancedMermaidPlugin } from '../src/main';
export { setInlineOwner } from '../src/editor/ownership';
export { diagramFences } from '../src/editor/fences';
