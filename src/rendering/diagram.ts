import { MarkdownRenderChild, type App } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { DiagramController } from './controller';

/** Markdown lifecycle adapter shared with the inline rendering controller. */
export class AdvancedMermaidDiagram extends MarkdownRenderChild {
	private controller?: DiagramController;
	private loaded = false;
	private inlineOwned = false;
	constructor(containerEl: HTMLElement, private source: string,
		private readonly settings: () => AdvancedMermaidSettings,
		private readonly presence: (child: AdvancedMermaidDiagram, loaded: boolean) => void,
		private readonly app: App, private readonly sourcePath: string) { super(containerEl); }
	onload(): void {
		this.loaded = true;
		this.presence(this, true);
		this.resume();
	}
	/** Keep the Markdown child registered while its inline editor owns the block.
	 * Obsidian may reuse this same preview without rerunning its processor. */
	setInlineOwned(owned: boolean, source?: string): void {
		const changed = source !== undefined && source !== this.source;
		if (source !== undefined) this.source = source;
		this.inlineOwned = owned;
		if (owned) { this.controller?.destroy(); this.controller = undefined; }
		else if (!this.controller) this.resume();
		else if (changed) this.controller.setSource(this.source);
	}
	private resume(): void {
		if (!this.loaded || this.inlineOwned || this.controller) return;
		this.controller = new DiagramController(this.containerEl, this.source, this.settings, this.app, this.sourcePath);
		this.controller.load();
	}
	updateSettings(): void { this.controller?.settingsChanged(); }
	refreshTheme(): void { this.controller?.environmentChanged(); }
	onunload(): void { this.loaded = false; this.controller?.destroy(); this.controller = undefined; this.presence(this, false); }
}
