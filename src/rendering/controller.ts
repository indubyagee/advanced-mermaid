import { Component, type App } from 'obsidian';
import { mount, type MountOptions, type Mounted, type RenderResult, type ZoomOptions } from 'pele';
import { labelPixels, type AdvancedMermaidSettings } from '../settings';
import { decodeLocalStyle } from '../styles/local-codec';
import { resolveDiagramStyle } from '../styles/resolve';
import { resolveDisplay, type ResolvedDisplaySettings } from './overrides';
import { applyStyle, activeTheme } from '../styles/apply';
import { DiagramFeedback } from '../ui/diagram-error';
import { DiagramActions, type ExportRequest } from '../ui/diagram-actions';
import { createSvgSnapshot, registerSvgPreparation, type SvgSnapshot } from '../export/svg';
import { DiagramLayout } from './layout';
import { isDiagramCategory } from '../styles/registry';
import { applyPresetClasses } from '../styles/preset-classes';
import type { PresetClass } from '../styles/presets';
import { applyZoomStyle } from '../styles/zoom-style';
import { applyExportButtonStyle } from '../styles/editor-style';
import { checkDiagramSource } from './source-budget';
import { preparePeleSource } from './pele-source';
import { originalSourceError, resolveFrontmatter } from '../styles/frontmatter';
import { createZoomControls, zoomLimit } from '../ui/zoom-controls';
import { hasPendingDiagramEnvironmentRefresh, observeDiagramEnvironment } from './environment';
import { maskClusterTitleOverlaps } from './cluster-title-mask';

export interface ControllerOptions {
	boundary?: HTMLElement;
	keepLastValid?: boolean;
	exportFooter?: { actions: HTMLElement; status: HTMLElement };
	changed?: (valid: boolean, error?: unknown) => void;
}

interface RenderRequest {
	readonly source: string;
	readonly fontSize: number | undefined;
	lineOffset: number;
}

/** Own the wrapper; Pele exclusively owns the inner mount host. */
export class DiagramController extends Component {
	private diagram?: Mounted;
	private configurationError?: unknown;
	private host!: HTMLElement;
	private feedback!: DiagramFeedback;
	private controls!: HTMLElement;
	private actions!: DiagramActions;
	private syncZoom!: () => void;
	private zoomOptions!: ZoomOptions;
	private request?: RenderRequest;
	private result?: RenderResult;
	private renderedSource?: string;
	private revision = 0;
	private canvasRevision = 0;
	private sourceRevision = 0;
	private blocked = false;
	private disposed = false;
	private layout!: DiagramLayout;
	private display?: ResolvedDisplaySettings;
	private presets: PresetClass[] = [];

	constructor(readonly containerEl: HTMLElement, private source: string,
		private readonly settings: () => AdvancedMermaidSettings, private readonly app: App,
		private readonly sourcePath: string | (() => string), private readonly options: ControllerOptions = {}) {
		super();
	}
	setSource(source: string): void {
		if (source !== this.source) {
			this.canvasRevision++;
			this.sourceRevision++;
		}
		this.source = source;
		this.blocked = false;
		this.updateSettings();
	}
	settingsChanged(): void { this.updateSettings(); }
	invalidate(): void {
		this.blocked = true;
		this.revision++;
		this.canvasRevision++;
		this.sourceRevision++;
		this.request = undefined;
		this.actions?.setValid(false);
	}
	async snapshot(): Promise<SvgSnapshot> { return this.captureExport().snapshot(); }
	closeExportModal(): void { this.actions.closeModal(); }
	destroy(): void { this.unload(); }
	onload(): void {
		this.disposed = false;

		this.containerEl.addClass('advanced-mermaid');
		this.register(registerSvgPreparation(this.containerEl, svg => this.prepareSvg(svg)));
		const layout = this.containerEl.createDiv({ cls: 'advanced-mermaid-layout' });
		const viewport = layout.createDiv({ cls: 'advanced-mermaid-viewport' });
		const frameEl = viewport.createDiv({ cls: 'advanced-mermaid-frame' });
		this.host = frameEl.createDiv({ cls: 'advanced-mermaid-mount' });
		const host = this.host;
		this.zoomOptions = { always: true, controls: false, get maxScale() { return zoomLimit(host); } };
		this.syncZoom = createZoomControls(viewport, this.host, this,
			() => this.renderedSource === undefined ? undefined : this.diagram?.zoom);
		const footer = this.options.exportFooter;
		this.controls = (footer?.actions ?? layout).createDiv({ cls: 'advanced-mermaid-actions' });
		const feedback = layout.createDiv({ cls: 'advanced-mermaid-error', attr: { role: 'status' } });
		this.feedback = new DiagramFeedback(feedback, this, text => this.copyText(text));
		this.layout = new DiagramLayout(this.containerEl, layout, viewport, this.host, this, () => {
			this.diagram?.zoom?.refresh();
			this.syncZoom();
		}, this.app, this.options.boundary);
		this.actions = new DiagramActions(this.app, this, this.controls, this.sourcePath, () => this.captureExport(), footer?.status);
		this.register(observeDiagramEnvironment(this.containerEl, () => this.updateSettings()));
		this.updateSettings();
	}

	updateSettings(): void {
		if (this.disposed || !this.host) return;
		this.revision++;
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
			// Canvas conversion uses the configured source across visual refreshes.
			if (this.request?.source !== configured.source || this.configurationError) this.canvasRevision++;
			lineOffset = configured.lineOffset;
			applyStyle(this.containerEl, settings, resolved.profile);
			const editorStyle = settings.liveEditor.style;
			const zoom = this.diagram?.zoom;
			const orientationChanged = this.containerEl.dataset.zoomOrientation !== editorStyle.zoom.orientation;
			const magnification = zoom && orientationChanged ? zoom.scale / zoom.fit : 1;
			applyZoomStyle(this.containerEl, editorStyle.zoom);
			applyExportButtonStyle(this.controls, editorStyle);
			this.containerEl.dataset.category = resolved.category ?? 'other';
			this.containerEl.dataset.align = settings.alignment;
			this.host.hidden = false;
			const fontSize = resolved.profile.labelSizePx ?? labelPixels(settings.theme.labelSize);
			const { request, result } = this;
			if (this.diagram && result && request && this.renderedSource === configured.source && request.fontSize === fontSize) {
				request.lineOffset = lineOffset;
				// Pele refreshes geometry when the computed font changes, including inherited fonts.
				this.diagram.refresh();
				if (this.request === request && this.result === result) {
					this.present(result);
					if (zoom && magnification > 1) {
						// Let Pele measure the new gutter before restoring the level above fit.
						this.diagram.refresh();
						if (zoom.scale <= zoom.fit) zoom.zoomTo(zoom.fit * magnification);
					}
				}
			} else {
				this.render({ ...configured, fontSize });
			}
			this.syncZoom();
		} catch (error) { this.failed(originalSourceError(error, lineOffset)); }
	}

	private render(request: RenderRequest): void {
		this.request = request;
		this.renderedSource = undefined;
		this.actions.setValid(false);
		const prepared = preparePeleSource(request.source);
		const options: MountOptions = {
			// The plugin fits the intrinsic SVG. Keep Pele independent of the fitted width.
			zoom: this.zoomOptions, images: false, responsive: false, autoDirection: false,
			maxWidth: Number.MAX_SAFE_INTEGER,
			fontSize: request.fontSize,
			limit: prepared.limit,
			onRender: result => { if (this.request === request) this.rendered(result, request.source); },
			onError: error => {
				if (this.request === request) this.failed(originalSourceError(prepared.restoreError?.(error) ?? error, request.lineOffset));
			},
		};
		if (this.diagram) this.diagram.update(prepared.source, options);
		else this.diagram = mount(this.host, prepared.source, options);
		this.diagram.refresh();
	}

	private rendered(result: RenderResult, source: string): void {
		this.revision++;
		this.result = result;
		this.renderedSource = source;
		this.present(result);
	}

	private present(result: RenderResult): void {
		this.containerEl.dataset.category = isDiagramCategory(result.type) ? result.type : 'other';
		this.containerEl.dataset.mermaidType = result.mermaidType;
		const svg = this.host.querySelector<SVGSVGElement>('svg.pele');
		if (svg) this.prepareSvg(svg);
		this.containerEl.classList.toggle('advanced-mermaid-fallback', !!this.configurationError);
		this.host.hidden = false;
		if (this.display) this.layout.update(result, this.display);
		this.actions.setValid(!this.configurationError && !this.blocked, result.type === 'flowchart' || result.type === 'agentflow');
		if (this.configurationError) {
			this.sourceRevision++;
			this.feedback.show(this.configurationError, this.source, true);
		} else this.feedback.clear();
		this.containerEl.classList.remove('advanced-mermaid-stale');
		if (!this.blocked) this.options.changed?.(!this.configurationError, this.configurationError);
	}

	private prepareSvg(svg: SVGSVGElement): void {
		const category = this.containerEl.dataset.category ?? '';
		if (category === 'flowchart') maskClusterTitleOverlaps(svg);
		applyPresetClasses(svg, this.presets, category);
	}

	private failed(error: unknown): void {
		this.request = undefined;
		this.revision++;
		this.canvasRevision++;
		this.sourceRevision++;
		this.renderedSource = undefined;
		if (this.options.keepLastValid && this.result) {
			const doc = this.containerEl.ownerDocument;
			const parsed = new doc.defaultView!.DOMParser().parseFromString(this.result.svg, 'image/svg+xml');
			this.host.replaceChildren(doc.importNode(parsed.documentElement, true));
			this.containerEl.dataset.category = this.result.type;
			this.prepareSvg(this.host.querySelector<SVGSVGElement>('svg')!);
			this.host.hidden = false;
			this.containerEl.classList.add('advanced-mermaid-stale');
			if (this.display) this.layout.update(this.result, this.display);
		} else { this.result = undefined; this.layout.clear(); this.host.hidden = true; }
		this.syncZoom();
		this.actions.setValid(false);
		this.feedback.show(error, this.source);
		this.options.changed?.(false, error);
	}

	private captureExport(): ExportRequest {
		const result = this.result;
		const source = this.renderedSource;
		const revision = this.revision;
		const canvasRevision = this.canvasRevision;
		const sourceRevision = this.sourceRevision;
		if (!result || source === undefined || this.disposed || this.blocked || this.configurationError || this.containerEl.classList.contains('advanced-mermaid-stale')) throw new Error('Render the diagram successfully before exporting it.');
		const current = (): boolean => !this.disposed && this.revision === revision &&
			!hasPendingDiagramEnvironmentRefresh(this.containerEl.ownerDocument);
		return {
			current, snapshot: () => createSvgSnapshot(result, this.containerEl, current),
			authored: this.options.exportFooter ? {
				source: this.source, current: () => !this.disposed && this.sourceRevision === sourceRevision,
			} : undefined,
			canvas: result.type === 'flowchart' || result.type === 'agentflow'
				? { source, current: () => !this.disposed && this.canvasRevision === canvasRevision }
				: undefined,
		};
	}

	private async copyText(text: string): Promise<void> {
		const clipboard = this.containerEl.ownerDocument.defaultView?.navigator.clipboard;
		if (!clipboard) throw new Error('Clipboard is unavailable.');
		await clipboard.writeText(text);
	}

	onunload(): void {
		this.disposed = true;
		this.request = undefined;
		this.revision++;
		this.canvasRevision++;
		this.sourceRevision++;
		this.diagram?.destroy();
		this.diagram = undefined;
		this.result = undefined;
		this.renderedSource = undefined;
		this.feedback?.clear();
		this.containerEl.replaceChildren();

	}
}
