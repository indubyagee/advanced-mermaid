import type { Component } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { fitDiagram, type Dimensions } from './sizing';

/** Size one block within its own pane without changing the note's reading width. */
export class DiagramLayout {
	private intrinsic?: Dimensions;
	private settings?: AdvancedMermaidSettings;
	private frame?: number;
	private readonly pane: HTMLElement | null;

	constructor(private readonly root: HTMLElement, private readonly host: HTMLElement, owner: Component, private readonly resized: () => void, private readonly boundary?: HTMLElement) {
		this.pane = boundary ?? root.closest<HTMLElement>('.markdown-embed-content, .markdown-preview-view, .cm-scroller');
		const view = root.ownerDocument.defaultView!;
		const schedule = (): void => {
			if (this.frame !== undefined) return;
			this.frame = view.requestAnimationFrame(() => { this.frame = undefined; this.fit(); });
		};
		const observer = new view.ResizeObserver(schedule);
		observer.observe(this.pane ?? root.parentElement ?? root);
		if (root.parentElement && root.parentElement !== this.pane) observer.observe(root.parentElement);
		owner.registerDomEvent(view, 'resize', schedule);
		owner.register(() => { observer.disconnect(); if (this.frame !== undefined) view.cancelAnimationFrame(this.frame); this.clear(); });
	}

	update(intrinsic: Dimensions, settings: AdvancedMermaidSettings): void {
		this.intrinsic = intrinsic;
		this.settings = settings;
		this.fit();
	}

	clear(): void {
		this.intrinsic = undefined;
		this.settings = undefined;
		this.root.style.removeProperty('width');
		this.root.style.removeProperty('margin-left');
		this.host.style.removeProperty('width');
		this.host.style.removeProperty('height');
	}

	private fit(): void {
		const { intrinsic, settings, root, host } = this;
		if (!intrinsic || !settings || host.hidden) return;
		const view = root.ownerDocument.defaultView!;
		// Recover the host's natural block position instead of reading our previous size.
		root.style.removeProperty('width');
		root.style.removeProperty('margin-left');
		const natural = root.getBoundingClientRect();
		if (natural.width <= 0) return;
		let available = natural.width;
		let left = natural.left;
		if (this.pane && (settings.fillAvailable || settings.maxWidth !== 'auto')) {
			const style = view.getComputedStyle(this.pane);
			const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
			const paddingRight = Number.parseFloat(style.paddingRight) || 0;
			available = Math.max(0, this.pane.clientWidth - paddingLeft - paddingRight);
			left = this.pane.getBoundingClientRect().left + this.pane.clientLeft + paddingLeft;
		}
		const rem = Number.parseFloat(view.getComputedStyle(root.ownerDocument.documentElement).fontSize) || 16;
		const container = fitDiagram(intrinsic, available, view.innerHeight, rem, settings);
		const viewportStyle = view.getComputedStyle(host.parentElement!);
		const navigationSpace = (Number.parseFloat(viewportStyle.paddingLeft) || 0) + (Number.parseFloat(viewportStyle.paddingRight) || 0);
		const box = fitDiagram(intrinsic, Math.max(0, container.containerWidth - navigationSpace), view.innerHeight, rem, settings);
		root.style.width = `${container.containerWidth}px`;
		root.style.marginLeft = `${left + (available - container.containerWidth) / 2 - natural.left}px`;
		root.dataset.orientation = box.portrait ? 'portrait' : 'landscape';
		host.style.width = `${box.width}px`;
		host.style.height = `${box.height}px`;
		const svg = host.querySelector<SVGSVGElement>('svg.pele');
		if (svg) {
			svg.style.width = `${box.width}px`;
			svg.style.height = `${box.height}px`;
		}
		svg?.setAttribute('preserveAspectRatio', settings.maintainAspectRatio ? 'xMidYMid meet' : 'none');
		this.resized();
	}
}
