import { DiagramController } from '../rendering/controller';
import type { AdvancedMermaidSettings } from '../settings';
import type { App } from 'obsidian';

/** One lazily mounted example; hidden/closed settings never retain a renderer. */
export class SettingsExample {
	private controller?: DiagramController;
	constructor(private readonly app: App, private readonly settings: () => AdvancedMermaidSettings) {}
	attach(host: HTMLElement): void {
		this.destroy();
		const disclosure = host.createEl('details'); disclosure.createEl('summary', { text: 'Show example' });
		const preview = disclosure.createDiv();
		disclosure.addEventListener('toggle', () => {
			this.controller?.destroy(); this.controller = undefined;
			if (disclosure.open) {
				this.controller = new DiagramController(preview, 'flowchart LR\n A[Source] --> B[Preview]', this.settings, this.app, '', { boundary: preview.parentElement ?? undefined });
				this.controller.load();
			}
		});
	}
	refresh(): void { this.controller?.settingsChanged(); }
	destroy(): void { this.controller?.destroy(); this.controller = undefined; }
}
