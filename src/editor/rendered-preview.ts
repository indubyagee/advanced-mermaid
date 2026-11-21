import { type EditorView, WidgetType } from '@codemirror/view';
import type { App } from 'obsidian';
import { createDetachedEl } from '../dom';
import type { AdvancedMermaidSettings } from '../settings';
import { DiagramController } from '../rendering/controller';

/** Render complete Live Preview fences with their authored source. */
export function createRenderedPreviews(app: App, settings: () => AdvancedMermaidSettings): {
	widget(source: string, file: string): WidgetType; refresh(): void; destroy(): void;
} {
	const controllers = new Map<HTMLElement, DiagramController>();
	class RenderedPreview extends WidgetType {
		constructor(readonly source: string, readonly file: string) { super(); }
		eq(other: RenderedPreview): boolean { return other.source === this.source && other.file === this.file; }
		toDOM(view: EditorView): HTMLElement {
			const host = createDetachedEl(view.dom.ownerDocument, 'div', { cls: 'advanced-mermaid-rendered-preview' });
			const controller = new DiagramController(host, this.source, settings, app, this.file, {
				boundary: view.scrollDOM, exportFooter: 'rendered',
			});
			controllers.set(host, controller);
			controller.load();
			return host;
		}
		ignoreEvent(): boolean { return true; }
		destroy(host: HTMLElement): void { controllers.get(host)?.destroy(); controllers.delete(host); }
	}
	return {
		widget: (source, file) => new RenderedPreview(source, file),
		refresh() { for (const controller of controllers.values()) controller.settingsChanged(); },
		destroy() { for (const controller of controllers.values()) controller.destroy(); controllers.clear(); },
	};
}
