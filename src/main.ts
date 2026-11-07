import { Notice, Plugin } from 'obsidian';
import { normalizeSettings, isFutureSettingsSchema, type AdvancedMermaidSettings } from './settings';
import { AdvancedMermaidDiagram } from './rendering/diagram';
import { AdvancedMermaidSettingTab } from './ui/settings-tab';
import { createInlineExtension, type InlineExtension } from './editor/extension';
import { RecoveryModal } from './ui/recovery-modal';
import { inlineOwner, observeOwnership } from './editor/ownership';

interface RenderedBlock { element: HTMLElement; file: string; line: () => number | undefined }

export default class AdvancedMermaidPlugin extends Plugin {
	settings!: AdvancedMermaidSettings;
	private readonly diagrams = new Set<AdvancedMermaidDiagram>();
	private refreshTimer?: number;
	private saves = Promise.resolve();
	private settingsDirty = false;
	private inline?: InlineExtension;
	private futureSchema = false;
	private saveFailureShown = false;
	private readonly blocks = new Map<AdvancedMermaidDiagram, RenderedBlock>();

	async onload(): Promise<void> {
		const saved: unknown = await this.loadData();
		this.futureSchema = isFutureSettingsSchema(saved);
		this.settings = normalizeSettings(saved);
		if (this.futureSchema) new Notice('These diagram settings were saved by a newer plugin. Preferences will not be overwritten.');
		this.inline = createInlineExtension(this.app, () => this.settings);
		this.registerEditorExtension(this.inline.extension);
		this.addCommand({ id: 'toggle-inline-editor', name: 'Toggle inline editor', editorCheckCallback: (checking, editor) => this.inline?.toggle(checking, editor) ?? false });
		this.addCommand({ id: 'render-inline-diagram', name: 'Render inline diagram', editorCheckCallback: (checking, editor) => this.inline?.render(checking, editor) ?? false });
		this.addCommand({ id: 'recover-inline-drafts', name: 'Recover inline drafts', callback: () => new RecoveryModal(this.app).open() });
		this.addSettingTab(new AdvancedMermaidSettingTab(this.app, this, this.settings, () => this.settingsChanged()));
		this.registerMarkdownCodeBlockProcessor('pele', (source, element, context) => {
			const info = context.getSectionInfo(element);
			const child = new AdvancedMermaidDiagram(element, source, () => this.settings, (diagram, loaded) => {
				if (loaded) this.diagrams.add(diagram);
				else { this.diagrams.delete(diagram); this.blocks.delete(diagram); }
			}, this.app, context.sourcePath);
			const block = { element, file: context.sourcePath, line: () => context.getSectionInfo(element)?.lineStart ?? info?.lineStart };
			this.blocks.set(child, block);
			this.syncOwnership(child, block);
			context.addChild(child);
		});
		this.register(observeOwnership(() => { for (const [child, block] of this.blocks) this.syncOwnership(child, block); }));
		this.registerEvent(this.app.workspace.on('css-change', () => {
			for (const child of this.diagrams) child.refreshTheme();
			this.inline?.refresh();
		}));
		this.register(() => {
			window.clearTimeout(this.refreshTimer);
			this.persistSettings();
			for (const child of this.diagrams) child.unload();
			this.diagrams.clear();
			this.inline?.destroy();
		});
	}
	private syncOwnership(child: AdvancedMermaidDiagram, block: RenderedBlock): void {
		const line = block.line();
		const owner = line === undefined ? undefined : inlineOwner(block.element, block.file, line);
		child.setInlineOwned(owner !== undefined, owner?.source);
	}

	private settingsChanged(): void {
		this.settingsDirty = true;
		window.clearTimeout(this.refreshTimer);
		this.refreshTimer = window.setTimeout(() => {
			this.persistSettings();
			for (const child of this.diagrams) child.updateSettings();
			this.inline?.refresh();
		}, 250);
	}

	private persistSettings(): void {
		if (!this.settingsDirty || this.futureSchema) return;
		this.settingsDirty = false;
		const snapshot = normalizeSettings(this.settings);
		this.saves = this.saves.then(async () => { await this.saveData(snapshot); this.saveFailureShown = false; }).catch(() => {
			this.settingsDirty = true;
			if (!this.saveFailureShown) { new Notice('Could not save diagram settings. Change a setting to retry.'); this.saveFailureShown = true; }
		});
	}
}
