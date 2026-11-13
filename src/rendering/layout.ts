import type { App, Component } from 'obsidian';
import { availableWidthPreset } from '../display-settings';
import type { ResolvedDisplaySettings } from './overrides';
import { fitDiagram, type Dimensions } from './sizing';
import { minimalThemeWidths } from './minimal-settings';

/** Size one block within its own pane without changing the note's reading width. */
export class DiagramLayout {
	private intrinsic?: Dimensions;
	private settings?: ResolvedDisplaySettings;
	private frame?: number;
	private pane?: HTMLElement;
	private readonly observer: ResizeObserver;

	constructor(private readonly root: HTMLElement, private readonly layout: HTMLElement, private readonly host: HTMLElement,
		owner: Component, private readonly resized: () => void, private readonly app: App, private readonly boundary?: HTMLElement) {
		const view = root.ownerDocument.defaultView!;
		const schedule = (): void => {
			if (this.frame !== undefined) return;
			this.frame = view.requestAnimationFrame(() => { this.frame = undefined; this.fit(); });
		};
		this.observer = new view.ResizeObserver(schedule);
		this.observer.observe(root);
		// Minimal Theme Settings publishes vault-wide widths in the main window.
		const minimalChanges = new MutationObserver(schedule);
		minimalChanges.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
		owner.registerDomEvent(view, 'resize', schedule);
		owner.register(() => {
			minimalChanges.disconnect();
			this.observer.disconnect();
			if (this.frame !== undefined) view.cancelAnimationFrame(this.frame);
			this.clear();
		});
	}

	update(intrinsic: Dimensions, settings: ResolvedDisplaySettings): void {
		this.intrinsic = intrinsic;
		this.settings = settings;
		this.fit();
	}

	clear(): void {
		this.intrinsic = undefined;
		this.settings = undefined;
		this.root.removeAttribute('data-rendered-live-preview');
		this.layout.style.removeProperty('width');
		this.layout.style.removeProperty('left');
		this.host.style.removeProperty('--advanced-mermaid-fitted-width');
		this.host.style.removeProperty('--advanced-mermaid-fitted-height');
	}

	private fit(): void {
		const { intrinsic, settings, root, layout, host } = this;
		if (!intrinsic || !settings || host.hidden || root.getClientRects().length === 0) return;
		const view = root.ownerDocument.defaultView!;
		// Markdown render children can load before their pane is attached.
		const pane = this.boundary ?? root.closest<HTMLElement>('.markdown-embed-content, .markdown-preview-view, .cm-scroller') ?? root;
		root.toggleAttribute('data-rendered-live-preview', pane.matches('.cm-scroller'));
		if (this.pane !== pane) {
			if (this.pane && this.pane !== root) this.observer.unobserve(this.pane);
			if (pane !== root) this.observer.observe(pane);
			this.pane = pane;
		}
		const paneStyle = view.getComputedStyle(pane);
		const paddingLeft = Number.parseFloat(paneStyle.paddingLeft) || 0;
		const paddingRight = Number.parseFloat(paneStyle.paddingRight) || 0;
		const paneWidth = Math.max(0, pane.clientWidth - paddingLeft - paddingRight);
		const paneLeft = pane.getBoundingClientRect().left + pane.clientLeft + paddingLeft;
		const rem = Number.parseFloat(view.getComputedStyle(root.ownerDocument.documentElement).fontSize) || 16;
		const viewportStyle = view.getComputedStyle(host.parentElement!);
		const navigationSpace = (Number.parseFloat(viewportStyle.paddingLeft) || 0) + (Number.parseFloat(viewportStyle.paddingRight) || 0);
		const diagramWidths = minimalThemeWidths(this.app);
		const requested = settings.maxWidth === 'auto' ? (intrinsic.height > intrinsic.width ? 'none' : 'normal') : settings.maxWidth;
		const maxWidth = availableWidthPreset(requested, !!diagramWidths);
		const display = { ...settings, maxWidth, diagramWidths: diagramWidths ?? settings.diagramWidths };
		const textWidth = Math.min(paneWidth, root.clientWidth);
		const box = fitDiagram(intrinsic, paneWidth, view.innerHeight, rem, display, navigationSpace, textWidth);
		// Leave the outer block at the host theme's readable line width.
		layout.style.width = `${box.containerWidth}px`;
		layout.style.removeProperty('left');
		const column = maxWidth === 'default' || maxWidth === 'full';
		const left = column ? root.getBoundingClientRect().left + root.clientLeft : paneLeft;
		const centered = left + ((column ? textWidth : paneWidth) - box.containerWidth) / 2;
		layout.style.left = `${centered - layout.getBoundingClientRect().left}px`;
		root.dataset.orientation = box.portrait ? 'portrait' : 'landscape';
		// Keep the fitted size available when Pele temporarily expands the SVG for zoom.
		host.style.setProperty('--advanced-mermaid-fitted-width', `${box.width}px`);
		host.style.setProperty('--advanced-mermaid-fitted-height', `${box.height}px`);
		const svg = host.querySelector<SVGSVGElement>('svg.pele');
		svg?.setAttribute('preserveAspectRatio', settings.maintainAspectRatio ? 'xMidYMid meet' : 'none');
		this.resized();
	}
}
