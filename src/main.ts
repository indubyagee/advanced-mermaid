import { Notice, Plugin, type MarkdownPostProcessorContext } from 'obsidian';
import { normalizeSettings, isFutureSettingsSchema, type AdvancedMermaidSettings } from './settings';
import { AdvancedMermaidDiagram } from './rendering/diagram';
import { scheduleDiagramEnvironmentRefresh } from './rendering/environment';
import { AdvancedMermaidSettingTab } from './ui/settings-tab';
import { createInlineExtension, type InlineExtension } from './editor/extension';
import { RecoveryModal } from './ui/recovery-modal';
import { coversBlock, inlineOwner, observeOwnership, type InlineOwner, type OwnershipChange } from './editor/ownership';

interface RenderedBlock { element: HTMLElement; file: string; line: () => number | undefined; editor?: HTMLElement }

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
		const settingsTab = new AdvancedMermaidSettingTab(this.app, this, this.settings, () => this.settingsChanged());
		this.addSettingTab(settingsTab);
		this.register(() => settingsTab.hide());
		const renderDiagram = (source: string, element: HTMLElement, context: MarkdownPostProcessorContext): void => {
			const initialLine = context.getSectionInfo(element)?.lineStart;
			const child = new AdvancedMermaidDiagram(element, source, () => this.settings, (diagram, loaded) => {
				if (loaded) this.diagrams.add(diagram);
				else { this.diagrams.delete(diagram); this.blocks.delete(diagram); }
			}, this.app, context.sourcePath);
			const block = { element, file: context.sourcePath, line: () => context.getSectionInfo(element)?.lineStart ?? initialLine };
			this.blocks.set(child, block);
			this.applyOwnership(child, block, inlineOwner(element, block.file, initialLine));
			context.addChild(child);
		};
		this.registerMarkdownCodeBlockProcessor('pele', renderDiagram);
		// Run before Obsidian's built-in Mermaid processor consumes the code block.
		this.registerMarkdownCodeBlockProcessor('mermaid', renderDiagram, -1);
		this.register(observeOwnership(change => this.syncPaneOwnership(change)));
		this.registerEvent(this.app.workspace.on('css-change', () => {
			scheduleDiagramEnvironmentRefresh();
			this.inline?.remeasure();
		}));
		this.register(() => {
			window.clearTimeout(this.refreshTimer);
			this.persistSettings();
			for (const child of this.diagrams) child.unload();
			this.diagrams.clear();
			this.inline?.destroy();
		});
	}
	private applyOwnership(child: AdvancedMermaidDiagram, block: RenderedBlock, owner?: InlineOwner): void {
		block.editor = owner?.editor;
		child.setInlineOwned(owner !== undefined, owner?.ownership.source);
	}

	private syncPaneOwnership({ editor, previous, current }: OwnershipChange): void {
		const sameSession = current && previous?.id === current.id && previous.file === current.file;
		for (const [child, block] of this.blocks) {
			if (block.file !== previous?.file && block.file !== current?.file) continue;
			const contained = editor.contains(block.element);
			const wasOwned = block.editor === editor;
			if (!contained && !wasOwned) continue;
			if (!contained && block.element.isConnected) {
				this.applyOwnership(child, block, inlineOwner(block.element, block.file, block.line()));
				continue;
			}
			// A cached preview follows its session even if its section position is stale.
			const owns = current && (wasOwned && sameSession || contained && coversBlock(current, block.file, block.line()));
			if (owns || wasOwned) this.applyOwnership(child, block, owns ? { editor, ownership: current } : undefined);
		}
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
