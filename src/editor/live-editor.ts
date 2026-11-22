import { Compartment, EditorState, Transaction, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, type ViewUpdate } from '@codemirror/view';
import { defaultKeymap, indentWithTab, insertNewlineAndIndent, undo, redo } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import type { App } from 'obsidian';
import { createDetachedEl } from '../dom';
import type { AdvancedMermaidSettings } from '../settings';
import { DiagramController } from '../rendering/controller';
import { encodeLocalStyle, styleRegion, parseStyleCss, decodeLocalStyle } from '../styles/local-codec';
import { nestedOrigin, sourceChange, type SourceBridge, type SourceChange } from './source-bridge';
import { retainDraft } from './drafts';
import { PreviewScheduler } from './preview-scheduler';
import { sourceLanguage } from './languages';
import { sourceTheme } from './source-theme';
import { sourceTools } from './source-tools';
import { overrideOptions, overrideValue, type OverrideOption } from './override-options';
import { insertDisplayOverride, insertStyleOverride, type StyleTarget } from './override-insertion';
import { overrideSelector } from '../ui/override-selector';
import { resolveDisplay } from '../rendering/overrides';
import { applyEditorStyle } from '../styles/editor-style';
import { applySourceHighlights } from '../styles/source-highlight';
import { STYLE_RENDERER_VERSION } from '../styles/registry';
import { DiagramSyntaxSelector } from '../ui/diagram-syntax-selector';
import { initializeDiagram, insertComponent, type SourceInsertion } from './syntax/source';
import { insertConfiguration } from './syntax/configuration-insertion';
import { insertCategoryPalette, insertPresetClass } from './syntax/style-insertion';

export class LiveEditor {
	readonly element: HTMLElement;
	private readonly sourceHost: HTMLElement;
	private readonly preview: HTMLElement;
	private readonly canonical: HTMLElement;
	private readonly output: HTMLTextAreaElement;
	private readonly status: HTMLElement;
	private readonly draftStatus: HTMLElement;
	private readonly controller: DiagramController;
	private readonly scheduler: PreviewScheduler;
	private readonly nested: EditorView;
	private readonly stopWindowMigration: () => void;
	private readonly syncWindow: () => void;
	private readonly fullScreenButton?: HTMLButtonElement;
	private readonly syntax: DiagramSyntaxSelector;
	private css = '';
	private cssBaseline = '';
	private sourceBaseline = '';
	private cssDirty = false;
	private invalid = false;
	private conflict = false;
	private disposed = false;
	private inputMode: 'mermaid' | 'css' = 'mermaid';
	private outputMode: 'pele' | 'svg' = 'pele';
	private svgOutput?: { requested: boolean };
	private resize?: ResizeObserver;
	private intersection?: IntersectionObserver;
	private visible = true;
	private readonly buttons: HTMLButtonElement[] = [];
	private readonly presentation = new Compartment();
	private compositionRange?: { from: number; to: number };
	private cancelCssTimer?: () => void;

	constructor(private readonly app: App, private readonly settings: () => AdvancedMermaidSettings, private readonly bridge: SourceBridge,
		private readonly file: () => string, private readonly close: () => void, toggleFullScreen?: () => void) {
		const doc = bridge.parent.dom.ownerDocument;
		this.element = createDetachedEl(doc, 'div', { cls: 'advanced-mermaid-editor' });
		applyEditorStyle(this.element, settings().liveEditor.style);
		applySourceHighlights(this.element, settings().liveEditor.style.syntax);
		const header = this.element.createDiv({ cls: 'advanced-mermaid-editor-header' });
		const sources = header.createDiv({ attr: { role: 'tablist', 'aria-label': 'Source format' } });
		for (const mode of ['mermaid', 'css'] as const) this.tab(sources, mode === 'css' ? 'CSS' : 'Mermaid', () => this.selectInput(mode), mode === 'mermaid');
		if (toggleFullScreen) {
			const action = header.createDiv({ cls: 'advanced-mermaid-full-screen-action' });
			this.fullScreenButton = this.button(action, 'Open full-screen', toggleFullScreen);
			this.fullScreenButton.addClass('advanced-mermaid-full-screen-toggle');
			this.fullScreenButton.hidden = !settings().liveEditor.fullScreen;
		}
		const outputs = header.createDiv({ attr: { role: 'tablist', 'aria-label': 'Preview format' } });
		for (const mode of ['pele', 'svg'] as const) this.tab(outputs, mode === 'svg' ? 'SVG' : 'Pele', () => this.selectOutput(mode), mode === 'pele');
		const syntaxHost = this.element.createDiv();
		const setOverridesDisabled = overrideSelector(this.element, () => overrideOptions(this.bridge.source()), (option, target) => this.insertOverride(option, target));
		this.syntax = new DiagramSyntaxSelector(syntaxHost, () => this.bridge.source(), {
			diagram: (diagram, orientation) => this.insertSyntax(source => initializeDiagram(source, diagram, orientation)),
			component: component => this.insertSyntax(source => {
				const selection = this.nested.state.selection.main;
				return insertComponent(source, selection.from, selection.to, component.text);
			}),
			configuration: diagram => this.insertSyntax(source => insertConfiguration(source, diagram)),
			presetLibrary: () => this.settings().presets,
			presetClass: (diagram, alias) => this.insertSyntax(source => {
				const selection = this.nested.state.selection.main;
				return insertPresetClass(source, diagram.type, selection.from, selection.to, alias);
			}),
			palette: diagram => this.insertSyntax(source => insertCategoryPalette(source, diagram.type, this.settings().presets)),
			pending: setOverridesDisabled,
		});
		const columns = this.element.createDiv({ cls: 'advanced-mermaid-editor-columns' });
		this.sourceHost = columns.createDiv({ cls: 'advanced-mermaid-editor-source', attr: { role: 'tabpanel', 'aria-label': 'Diagram source' } });
		// Keep the note's Markdown gutter and width rules out of the nested editor.
		let sourceRoot = this.sourceHost.createDiv().attachShadow({ mode: 'open' });
		this.applySourceFontSize();
		this.preview = columns.createDiv({ cls: 'advanced-mermaid-editor-preview', attr: { role: 'tabpanel', 'aria-label': 'Diagram preview' } });
		this.canonical = this.preview.createDiv({ cls: 'advanced-mermaid-editor-render' });
		// Pele is the renderer name.
		this.output = this.preview.createEl('textarea', { cls: 'advanced-mermaid-svg-source', attr: { readonly: '', 'aria-label': 'Canonical Pele SVG' } }); this.output.hidden = true;
		this.status = this.element.createDiv({ cls: 'advanced-mermaid-editor-status', attr: { role: 'status', 'aria-live': 'polite' } });
		this.draftStatus = this.element.createDiv({ cls: 'advanced-mermaid-draft-status', attr: { role: 'status' } });
		// Pele is the renderer name.
		const details = this.element.createEl('details', { cls: 'advanced-mermaid-renderer-details' }); details.createEl('summary', { text: 'Renderer details' }); details.createEl('p', { text: `Uses Pele ${STYLE_RENDERER_VERSION}.` });
		const footer = this.element.createDiv({ cls: 'advanced-mermaid-editor-footer' });
		const draftActions = footer.createDiv({ cls: 'advanced-mermaid-draft-actions' });
		this.button(draftActions, 'Copy draft', () => { void this.element.ownerDocument.defaultView!.navigator.clipboard.writeText(this.inputMode === 'css' ? this.css : this.nested.state.doc.toString()).catch(() => { this.draftStatus.textContent = 'Clipboard unavailable. Select and copy the source text.'; }); });
		this.button(draftActions, 'Discard changes', () => { this.cssDirty = false; this.conflict = false; this.invalid = false; this.sync({ force: true }); });
		this.button(draftActions, 'Use note version', () => { this.cssDirty = false; this.conflict = false; this.sync({ force: true }); });
		this.button(draftActions, 'Render now', () => { if (this.flush()) this.scheduler.now(); });
		const endActions = footer.createDiv({ cls: 'advanced-mermaid-editor-end-actions' });
		const exportStatus = footer.createDiv({ cls: 'advanced-mermaid-editor-export-status' });
		this.sourceBaseline = bridge.source();
		try { this.css = styleRegion(this.sourceBaseline)?.css ?? ''; } catch { this.draftStatus.textContent = 'Repair the malformed style region in the Mermaid source. The saved note is retained.'; }
		this.cssBaseline = this.css;
		const extensions: Extension[] = [keymap.of([
			{ ...indentWithTab, stopPropagation: true },
			{ key: 'Enter', run: insertNewlineAndIndent, stopPropagation: true },
			{ key: 'Mod-z', run: () => !!bridge.range() && undo(bridge.parent) }, { key: 'Mod-Shift-z', run: () => !!bridge.range() && redo(bridge.parent) }, { key: 'Mod-y', run: () => !!bridge.range() && redo(bridge.parent) },
			{ key: 'Mod-Enter', run: () => { if (this.flush()) this.scheduler.now(); return true; } },
			{ key: 'Escape', run: () => { if (this.element.hasAttribute('data-full-screen') || this.canClose()) close(); return true; }, stopPropagation: true }, ...defaultKeymap,
		]), EditorView.updateListener.of(update => {
			if (!update.docChanged || update.transactions.every(transaction => !transaction.docChanged || transaction.annotation(nestedOrigin))) return;
			if (this.compositionRange) this.compositionRange.to = Math.max(this.compositionRange.to, update.state.selection.main.to);
			if (this.inputMode === 'mermaid') {
				this.forwardSource(update);
				return;
			}
			this.css = update.state.doc.toString(); this.cssDirty = this.css !== this.cssBaseline; this.validateCss();
			if (!update.view.composing && !this.conflict && (this.visible || this.nested.hasFocus)) this.scheduler.schedule(settings().liveEditor.debounceMs);
		}), EditorView.domEventHandlers({
			compositionstart: () => { const selection = this.nested.state.selection.main; this.compositionRange = { from: selection.from, to: selection.to }; },
			compositionend: () => { this.compositionRange = undefined; this.scheduler.schedule(settings().liveEditor.debounceMs); },
		})];
		extensions.push(sourceTheme, sourceTools, this.presentation.of(this.presentationExtensions()));
		this.nested = new EditorView({ state: EditorState.create({ doc: this.sourceBaseline, extensions }), parent: sourceRoot, root: sourceRoot });
		let sourceDocument = doc;
		this.syncWindow = () => {
			const current = this.element.ownerDocument;
			if (current === sourceDocument) return;
			sourceDocument = current;
			this.controller.closeExportModal();
			// Adopted CodeMirror styles belong to the original document.
			const replacement = this.sourceHost.createDiv().attachShadow({ mode: 'open' });
			replacement.append(this.nested.dom);
			this.nested.setRoot(replacement);
			sourceRoot.host.remove();
			sourceRoot = replacement;
			this.observeSurface();
			this.remeasure();
		};
		this.stopWindowMigration = this.sourceHost.onWindowMigrated(this.syncWindow);
		this.scheduler = new PreviewScheduler(() => this.element.ownerDocument.defaultView, () => this.render(), text => { this.status.textContent = text; });
		this.syntax.load();
		this.controller = new DiagramController(this.canonical, this.sourceBaseline, settings, app, file, { boundary: this.preview, editorPreview: true, keepLastValid: true, exportFooter: { actions: endActions, status: exportStatus }, changed: (valid, error) => {
			this.status.textContent = valid ? 'Current · ' + (this.canonical.dataset.category ?? 'diagram') : (this.canonical.classList.contains('advanced-mermaid-fallback') ? 'Using global/type fallback styling. ' : this.canonical.classList.contains('advanced-mermaid-stale') ? 'Preview is from the last valid source. ' : 'Diagram error. ') + (error instanceof Error ? error.message : 'Diagram error');
			if (error && typeof error === 'object' && 'line' in error && typeof error.line === 'number' && Number.isInteger(error.line)) {
				const line = error.line;
				this.button(this.status, 'Go To Line ' + line, () => { if (!this.selectInput('mermaid')) return; const target = this.nested.state.doc.line(Math.max(1, Math.min(this.nested.state.doc.lines, line))); this.nested.dispatch({ selection: { anchor: target.from }, scrollIntoView: true }); this.nested.focus(); });
			}
			this.svgOutput = valid ? { requested: false } : undefined;
			this.output.value = '';
			void this.refreshSvgOutput();
			bridge.parent.requestMeasure();
		} });
		this.controller.load();
		this.observeSurface();
	}
	private observeSurface(): void {
		this.resize?.disconnect();
		this.intersection?.disconnect();
		const win = this.element.ownerDocument.defaultView!;
		this.resize = new win.ResizeObserver(entries => {
			this.applyLayout(entries[0]?.contentRect.width ?? 0);
			this.bridge.parent.requestMeasure();
		}); this.resize.observe(this.element);
		this.intersection = new win.IntersectionObserver(entries => {
			this.visible = entries[0]?.isIntersecting ?? true;
			if (this.visible) this.scheduler.schedule(this.settings().liveEditor.debounceMs); else if (!this.nested.hasFocus) this.scheduler.cancel();
		}); this.intersection.observe(this.element);
	}
	private applyLayout(width: number): void {
		const layout = this.settings().liveEditor.layout;
		const stacked = layout === 'stacked' || width < (layout === 'auto' ? 768 : 496);
		this.element.dataset.layout = stacked ? 'stacked' : 'side-by-side';
	}
	setFullScreen(open: boolean): void {
		if (this.disposed) return;
		this.controller.closeExportModal();
		this.element.toggleAttribute('data-full-screen', open);
		if (this.fullScreenButton) this.fullScreenButton.textContent = open ? 'Return to note' : 'Open full-screen';
		this.syncWindow();
		this.applyLayout(this.element.clientWidth);
		this.remeasure();
	}
	sourceAvailable(): boolean { return !!this.bridge.range(); }
	private button(host: HTMLElement, text: string, action: () => void): HTMLButtonElement {
		const button = host.createEl('button', { text, attr: { type: 'button' } }); button.addEventListener('click', action); return button;
	}
	private tab(host: HTMLElement, label: string, action: () => void | boolean, selected: boolean): void {
		const button = this.button(host, label, () => {
			if (action() === false) return;
			for (const sibling of Array.from(host.querySelectorAll('button'))) sibling.setAttribute('aria-selected', 'false'); button.setAttribute('aria-selected', 'true');
		}); button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(selected)); this.buttons.push(button);
		button.addEventListener('keydown', event => {
			if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
			const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')); const index = tabs.indexOf(button);
			const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
			event.preventDefault(); next?.focus(); next?.click();
		});
	}
	private validateCss(): void {
		this.invalidatePreview();
		this.clearCssTimer();
		try {
			parseStyleCss(this.css, 'light'); parseStyleCss(this.css, 'dark'); this.invalid = false; this.draftStatus.textContent = this.cssDirty ? 'Valid CSS draft · pending save' : '';
			const win = this.element.ownerDocument.defaultView;
			if (win) {
				const timer = win.setTimeout(() => { if (!this.disposed && this.flush() && (this.visible || this.nested.hasFocus)) this.scheduler.schedule(0); }, this.settings().liveEditor.debounceMs);
				this.cancelCssTimer = win.clearTimeout.bind(win, timer);
			}
		}
		catch (error) { this.invalid = true; this.draftStatus.textContent = 'Unsaved CSS draft: ' + (error instanceof Error ? error.message : String(error)); }
	}
	private clearCssTimer(): void {
		this.cancelCssTimer?.();
		this.cancelCssTimer = undefined;
	}
	private invalidatePreview(): void {
		this.controller.invalidate();
		this.svgOutput = undefined;
		this.output.value = '';
	}
	private protectDraft(message: string): void {
		this.conflict = true;
		this.scheduler.cancel();
		this.invalidatePreview();
		this.draftStatus.textContent = message;
	}

	private forwardSource(update: ViewUpdate): void {
		if (this.conflict) {
			this.draftStatus.textContent = 'Draft retained. Use note version before applying further edits.';
			return;
		}
		const before = this.sourceBaseline;
		// The parent transaction reconciles accepted changes synchronously.
		this.bridge.forward(update);
		if (!this.disposed && !this.conflict && this.sourceBaseline === before && this.bridge.range() && update.state.doc.toString() !== before) {
			this.protectDraft('The note did not accept the edit. Copy the draft or use the note version.');
		}
	}

	flush(): boolean {
		this.clearCssTimer();
		if (this.conflict || this.invalid || !this.bridge.range()) return false;
		if (!this.cssDirty) return true;
		try {
			const source = this.bridge.source(); const current = styleRegion(source)?.css ?? '';
			if (current !== this.cssBaseline) {
				this.protectDraft('The note styles changed externally. Copy the draft or use the note version.');
				return false;
			}
			this.cssDirty = false; this.cssBaseline = this.css;
			this.bridge.commit(encodeLocalStyle(source, this.css)); this.sourceBaseline = this.bridge.source(); this.draftStatus.textContent = ''; return true;
		} catch (error) { this.invalid = true; this.draftStatus.textContent = String(error); return false; }
	}
	canClose(): boolean { if (!this.nested.composing && this.flush()) return true; this.draftStatus.textContent += ' Finish composing, or copy or discard the draft before closing.'; return false; }
	private insertSyntax(create: (source: string) => SourceInsertion): void {
		if (this.disposed) return;
		if (this.nested.composing || !this.flush()) { this.draftStatus.textContent = 'Resolve the current draft or finish composing before inserting syntax.'; return; }
		try {
			if (!this.selectInput('mermaid')) return;
			const source = this.bridge.source();
			if (source !== this.nested.state.doc.toString()) throw new Error('The note changed. Sync the source before inserting syntax.');
			const inserted = create(source);
			if (inserted.source !== source && !this.bridge.commit(inserted.source, inserted)) throw new Error('The source block is no longer available.');
			this.nested.dispatch({ selection: { anchor: inserted.from, head: inserted.to }, scrollIntoView: true }); this.nested.focus();
			this.draftStatus.textContent = inserted.source === source ? 'Existing syntax selected; authored values are kept.' : '';
		} catch (error) { this.draftStatus.textContent = error instanceof Error ? error.message : String(error); }
	}
	private insertOverride(option: OverrideOption, target: StyleTarget): void {
		if (this.nested.composing || !this.flush()) { this.draftStatus.textContent = 'Resolve the current draft or finish composing before inserting an override.'; return; }
		try {
			const source = this.bridge.source(); resolveDisplay(source, this.settings()); decodeLocalStyle(source, 'light'); decodeLocalStyle(source, 'dark');
			const value = overrideValue(option, source, this.settings(), this.canonical, target);
			const inserted = option.kind === 'display' ? insertDisplayOverride(source, option.key, value) : insertStyleOverride(source, option.variable, value, target);
			if (!this.selectInput('mermaid')) return;
			if (inserted.changed && !this.bridge.commit(inserted.source, inserted)) throw new Error('The source block is no longer available.');
			this.nested.dispatch({ selection: { anchor: inserted.from, head: inserted.to }, scrollIntoView: true }); this.nested.focus();
			this.draftStatus.textContent = inserted.changed ? 'Local override inserted. Edit the selected value.' : 'Selected the existing override; its value is preserved.';
		} catch (error) { this.draftStatus.textContent = error instanceof Error ? error.message : String(error); }
	}
	private selectInput(mode: 'mermaid' | 'css'): boolean {
		if (mode === this.inputMode) return true;
		if (this.inputMode === 'css' && !this.flush()) return false;
		this.inputMode = mode;
		this.syntax.setInputMode(mode);
		for (const tab of Array.from(this.element.querySelectorAll('[aria-label="Source format"] [role="tab"]'))) tab.setAttribute('aria-selected', String(tab.textContent === (mode === 'css' ? 'CSS' : 'Mermaid')));
		this.nested.dispatch({ effects: this.presentation.reconfigure(this.presentationExtensions()) });
		if (mode === 'css') {
			try { this.css = styleRegion(this.bridge.source())?.css ?? ''; this.cssBaseline = this.css; } catch (error) { this.draftStatus.textContent = String(error); }
			this.draftStatus.textContent = 'Constrained style variables only; not unrestricted CSS.';
		}
		const source = mode === 'css' ? this.css : this.bridge.source();
		this.replaceNested(sourceChange(this.nested.state.doc.toString(), source));
		return true;
	}
	private replaceNested(changes: SourceChange | undefined): void {
		if (changes) this.nested.dispatch({ changes, annotations: [nestedOrigin.of(true), Transaction.addToHistory.of(false)] });
	}
	syncFromParent(update: ViewUpdate): void {
		this.sync({ forwarded: this.bridge.isForwarded(update) });
	}
	private sync({ force = false, forwarded = false } = {}): void {
		if (this.disposed || !this.bridge.range()) return;
		if (force) this.draftStatus.textContent = '';
		const source = this.bridge.source();
		if (!force && source === this.sourceBaseline) return;
		this.syntax.refresh();
		const previous = this.nested.state.doc.toString();
		let css = ''; try { css = styleRegion(source)?.css ?? ''; } catch (error) { this.draftStatus.textContent = String(error); }
		if (!force && this.cssDirty && css !== this.cssBaseline) {
			this.protectDraft('Note styles changed externally. Copy the draft or use the note version.');
			return;
		}
		const cssMode = this.inputMode === 'css';
		const nextCss = !force && this.cssDirty ? this.css : css;
		const change = sourceChange(previous, cssMode ? nextCss : source);
		const composition = this.compositionRange ?? this.nested.state.selection.main;
		const composing = this.nested.composing;
		if (composing && change && change.from <= composition.to && change.to >= composition.from) {
			if (force) {
				this.protectDraft('Finish composing before loading the note version.');
			} else {
				retainDraft({ file: this.file(), source: cssMode ? this.sourceBaseline : previous, css: cssMode ? previous : this.css, reason: 'External change during composition' });
				this.protectDraft('External change during composition. Local draft retained. Copy the draft or use the note version.');
			}
			return;
		}
		if (force || !this.cssDirty) { this.css = css; this.cssBaseline = css; this.invalid = false; }
		this.sourceBaseline = source;
		this.replaceNested(change);
		this.invalidatePreview();
		if ((!forwarded || !composing) && (this.visible || this.nested.hasFocus)) this.scheduler.schedule(this.settings().liveEditor.debounceMs);
		else this.scheduler.cancel();
	}
	private presentationExtensions(): Extension[] {
		const options = this.settings().liveEditor;
		const parent = this.bridge.parent.state;
		return [sourceLanguage(this.inputMode), EditorState.tabSize.of(parent.tabSize),
			indentUnit.of(parent.facet(indentUnit) === '\t' ? '\t' : '    '),
			options.lineNumbers ? lineNumbers() : [], options.wrapSource ? EditorView.lineWrapping : []];
	}
	syncIndentation(): void {
		this.nested.dispatch({ effects: this.presentation.reconfigure(this.presentationExtensions()) });
	}
	private applySourceFontSize(): void {
		const size = this.settings().liveEditor.fontSizePx;
		if (size === null) this.sourceHost.style.removeProperty('--advanced-mermaid-editor-font-size');
		else this.sourceHost.style.setProperty('--advanced-mermaid-editor-font-size', `${size}px`);
	}
	refresh(): void {
		applyEditorStyle(this.element, this.settings().liveEditor.style);
		applySourceHighlights(this.element, this.settings().liveEditor.style.syntax);
		this.syntax.refresh(true);
		this.applySourceFontSize();
		this.nested.dispatch({ effects: this.presentation.reconfigure(this.presentationExtensions()) });
		this.nested.requestMeasure();
		this.applyLayout(this.element.clientWidth);
		if (this.fullScreenButton) this.fullScreenButton.hidden = !this.element.hasAttribute('data-full-screen') && !this.settings().liveEditor.fullScreen;
		this.controller.settingsChanged(); this.bridge.parent.requestMeasure();
	}
	remeasure(): void { this.nested.requestMeasure(); this.bridge.parent.requestMeasure(); }
	renderNow(): void { if (this.flush()) this.scheduler.now(); }
	focus(): void { if (!this.disposed) this.nested.focus(); }
	/** The parent note must not scroll its hidden fence cursor while the inline editor owns focus. */
	hasFocus(): boolean { return this.element.contains(this.element.ownerDocument.activeElement); }
	private render(): void {
		if (this.disposed || this.conflict || !this.flush()) return;
		this.controller.setSource(this.bridge.source());
	}
	private selectOutput(mode: 'pele' | 'svg'): void {
		this.outputMode = mode;
		const showSvg = mode === 'svg';
		this.canonical.inert = showSvg;
		this.output.hidden = !showSvg;
		void this.refreshSvgOutput();
		this.bridge.parent.requestMeasure();
	}
	private async refreshSvgOutput(): Promise<void> {
		const revision = this.svgOutput;
		if (this.outputMode !== 'svg' || !revision || revision.requested) return;
		revision.requested = true;
		try {
			const snapshot = await this.controller.snapshot();
			if (this.svgOutput === revision) this.output.value = snapshot.svg;
		} catch (error) {
			if (this.svgOutput === revision) this.output.value = String(error);
		}
	}
	destroy(recoveryReason?: string): void {
		if (this.disposed) return;
		if (recoveryReason || this.cssDirty || this.conflict) retainDraft({ file: this.file(), source: this.inputMode === 'mermaid' ? this.nested.state.doc.toString() : this.sourceBaseline, css: this.css, reason: recoveryReason ?? 'Editor closed with an unsaved draft' });
		this.disposed = true;
		this.svgOutput = undefined;
		this.scheduler.destroy();
		this.resize?.disconnect();
		this.intersection?.disconnect();
		this.syntax.unload();
		this.stopWindowMigration();
		this.nested.destroy();
		this.controller.destroy();
		this.clearCssTimer();
	}
}
