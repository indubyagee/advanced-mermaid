import { decodeLocalStyle } from '../styles/local-codec';
import { resolveDiagramStyle } from '../styles/resolve';
export interface ControllerOptions { boundary?: HTMLElement; keepLastValid?: boolean; changed?: (valid: boolean, error?: unknown) => void }
import { Component, type App } from 'obsidian';
import { mount, type Mounted, type RenderResult } from 'pele';
import { labelPixels, type AdvancedMermaidSettings } from '../settings';
import { resolveDisplay, type ResolvedDisplaySettings } from './overrides';
import { applyStyle, activeTheme } from '../styles/apply';
import { showDiagramError } from '../ui/diagram-error';
import { DiagramActions, type ExportRequest } from '../ui/diagram-actions';
import { createSvgSnapshot, registerSvgPreparation, type SvgSnapshot } from '../export/svg';
import { DiagramLayout } from './layout';
import { isDiagramCategory } from '../styles/registry';
import { applyPresetClasses } from '../styles/preset-classes';
import type { PresetClass } from '../styles/presets';
import { applyZoomStyle } from '../styles/zoom-style';
import { applyExportButtonStyle } from '../styles/editor-style';
import { checkDiagramSource } from './source-budget';
import { originalSourceError, resolveFrontmatter } from '../styles/frontmatter';

/** Own the wrapper; Pele exclusively owns the inner mount host. */
export class DiagramController extends Component {
	private diagram?: Mounted;
	private configurationError?: unknown;
	private host!: HTMLElement;
	private feedback!: HTMLElement;
	private controls!: HTMLElement;
	private actions!: DiagramActions;
	private result?: RenderResult;
	private revision = 0;
	private generation = 0;
	private blocked = false;
	private disposed = false;
	private layout!: DiagramLayout;
	private display?: ResolvedDisplaySettings;
	private presets: PresetClass[] = [];

	constructor(readonly containerEl: HTMLElement, private source: string,
		private readonly settings: () => AdvancedMermaidSettings, private readonly app: App,
		private readonly sourcePath: string, private readonly options: ControllerOptions = {}) {
		super();
	}
	setSource(source: string): void { this.source = source; this.blocked = false; this.updateSettings(); }
	settingsChanged(): void { this.updateSettings(); }
	environmentChanged(): void { this.updateSettings(); }
	invalidate(): void { this.blocked = true; this.revision++; this.generation++; this.actions?.setValid(false); }
	async snapshot(): Promise<SvgSnapshot> { return this.captureExport().snapshot(); }
	destroy(): void { this.unload(); }
	onload(): void {
		this.disposed = false;

		this.containerEl.addClass('advanced-mermaid');
		this.register(registerSvgPreparation(this.containerEl, svg => applyPresetClasses(svg, this.presets, this.containerEl.dataset.category ?? '')));
		const layout = this.containerEl.createDiv({ cls: 'advanced-mermaid-layout' });
		const viewport = layout.createDiv({ cls: 'advanced-mermaid-viewport' });
		this.host = viewport.createDiv({ cls: 'advanced-mermaid-mount' });
		for (const event of ['click', 'dblclick', 'pointerdown'] as const) this.registerDomEvent(this.host, event, evt => {
			if (evt.target instanceof this.containerEl.ownerDocument.defaultView!.Element && evt.target.closest('.pele-zoom')) evt.stopPropagation();
		});
		this.controls = layout.createDiv({ cls: 'advanced-mermaid-actions' });
		this.feedback = layout.createDiv({ cls: 'advanced-mermaid-error', attr: { role: 'status' } });
		this.feedback.hidden = true;
		this.layout = new DiagramLayout(this.containerEl, layout, this.host, this, () => this.diagram?.zoom?.refresh(), this.options.boundary);
		this.actions = new DiagramActions(this.app, this, this.controls, this.sourcePath, () => this.captureExport());
		const view = this.containerEl.ownerDocument.defaultView!;
		let frame: number | undefined;
		const observer = new view.MutationObserver(() => {
			if (frame !== undefined) return;
			frame = view.requestAnimationFrame(() => { frame = undefined; this.environmentChanged(); });
		}); observer.observe(this.containerEl.ownerDocument.body, { attributes: true, attributeFilter: ['class'] });
		this.register(() => { observer.disconnect(); if (frame !== undefined) view.cancelAnimationFrame(frame); });
		this.updateSettings();
	}

	updateSettings(): void {
		if (this.disposed || !this.host) return;
		this.revision++;
		const generation = ++this.generation;
		let lineOffset = 0;
		try {
			checkDiagramSource(this.source);
			const settings = resolveDisplay(this.source, this.settings());
			this.presets = settings.presets.map(preset => ({ ...preset }));
			this.display = settings;
			let local;
			this.configurationError = undefined;
			try { local = decodeLocalStyle(this.source, activeTheme(this.containerEl)).profile; } catch (error) { this.configurationError = error; }
			const resolved = resolveDiagramStyle(this.source, settings.style.global, settings.style.diagrams, local);
			const configured = resolveFrontmatter(this.source, settings.style.diagrams);
			lineOffset = configured.lineOffset;
			applyStyle(this.containerEl, settings, resolved.profile);
			const editorStyle = settings.liveEditor.style;
			applyZoomStyle(this.containerEl, editorStyle.zoom);
			applyExportButtonStyle(this.controls, editorStyle);
			this.containerEl.dataset.category = resolved.category ?? 'other';
			this.containerEl.dataset.align = settings.alignment;
			this.host.hidden = false;
			const host = this.host;
			const options = {
				// The plugin fits the intrinsic SVG. Do not let the mount host's
				// already-scaled width feed back into Pele's layout or direction.
				zoom: { always: true, labels: { zoomIn: 'Zoom In', zoomOut: 'Zoom Out', reset: 'Reset Zoom' },
					// Pele's absolute default cap can be below the fitted scale when
					// a small diagram is enlarged. Retain room to zoom in from fit.
					get maxScale() {
						const intrinsic = Number(host.querySelector('svg.pele')?.getAttribute('width'));
						const fittedWidth = Number.parseFloat(host.style.getPropertyValue('--advanced-mermaid-fitted-width'));
						return Math.max(3, intrinsic > 0 ? 8 * (fittedWidth || intrinsic) / intrinsic : 3);
					},
				}, images: false, responsive: false, autoDirection: false,
				maxWidth: Number.MAX_SAFE_INTEGER,
				fontSize: resolved.profile.labelSizePx ?? labelPixels(settings.theme.labelSize),
				onRender: (result: RenderResult) => { if (generation === this.generation && !this.disposed) this.rendered(result); },
				onError: (error: unknown) => { if (generation === this.generation && !this.disposed) this.failed(originalSourceError(error, lineOffset)); },
			};
			if (this.diagram) this.diagram.update(configured.source, options);
			else this.diagram = mount(this.host, configured.source, options);
			this.diagram.refresh();
		} catch (error) { this.failed(originalSourceError(error, lineOffset)); }
	}

	refreshTheme(): void { this.updateSettings(); }

	private rendered(result: RenderResult): void {
		this.revision++;
		this.result = result;
		this.containerEl.dataset.category = isDiagramCategory(result.type) ? result.type : 'other';
		this.containerEl.dataset.mermaidType = result.mermaidType;
		const svg = this.host.querySelector<SVGSVGElement>('svg.pele');
		if (svg) applyPresetClasses(svg, this.presets, this.containerEl.dataset.category);
		this.containerEl.classList.toggle('advanced-mermaid-fallback', !!this.configurationError);
		this.host.hidden = false;
		if (this.display) this.layout.update(result, this.display);
		this.feedback.replaceChildren();
		this.feedback.hidden = true;
		this.actions.setValid(!this.configurationError && !this.blocked);
		if (this.configurationError) {
			showDiagramError(this.feedback, this.configurationError, this.source, text => this.copyText(text), this);
			this.feedback.createEl('p', { text: 'Preview uses global/type fallback styles. Fix the local styles before exporting.' });
		}
		this.containerEl.classList.remove('advanced-mermaid-stale');
		this.options.changed?.(!this.configurationError, this.configurationError);
	}

	private failed(error: unknown): void {
		this.revision++;
		if (this.options.keepLastValid && this.result) {
			const doc = this.containerEl.ownerDocument;
			const parsed = new doc.defaultView!.DOMParser().parseFromString(this.result.svg, 'image/svg+xml');
			this.host.replaceChildren(doc.importNode(parsed.documentElement, true));
			this.containerEl.dataset.category = this.result.type;
			applyPresetClasses(this.host.querySelector<SVGSVGElement>('svg')!, this.presets, this.result.type);
			this.host.hidden = false;
			this.containerEl.classList.add('advanced-mermaid-stale');
			if (this.display) this.layout.update(this.result, this.display);
		} else { this.result = undefined; this.layout.clear(); this.host.hidden = true; }
		this.actions.setValid(false);
		showDiagramError(this.feedback, error, this.source, text => this.copyText(text), this);
		this.options.changed?.(false, error);
	}

	private captureExport(): ExportRequest {
		const result = this.result;
		const revision = this.revision;
		if (!result || this.disposed || this.blocked || this.configurationError || this.containerEl.classList.contains('advanced-mermaid-stale')) throw new Error('Render the diagram successfully before exporting it.');
		const current = (): boolean => !this.disposed && this.revision === revision;
		return { current, snapshot: () => createSvgSnapshot(result, this.containerEl, current) };
	}

	private async copyText(text: string): Promise<void> {
		const clipboard = this.containerEl.ownerDocument.defaultView?.navigator.clipboard;
		if (!clipboard) throw new Error('Clipboard is unavailable.');
		await clipboard.writeText(text);
	}

	onunload(): void {
		this.disposed = true;
		this.generation++;
		this.revision++;
		this.diagram?.destroy();
		this.diagram = undefined;
		this.result = undefined;
		this.containerEl.replaceChildren();

	}
}
