import { Compartment, EditorState, Transaction, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, indentWithTab, insertNewlineAndIndent, undo, redo } from '@codemirror/commands';
import type { App } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { DiagramController } from '../rendering/controller';
import { encodeLocalStyle, styleRegion, parseStyleCss, decodeLocalStyle } from '../styles/local-codec';
import { nestedOrigin, type SourceBridge } from './source-bridge';
import { retainDraft } from './drafts';
import { PreviewScheduler } from './preview-scheduler';
import { renderNativeMermaid } from '../rendering/mermaid-adapter';
import { sourceLanguage } from './languages';
import { overrideOptions, overrideValue, type OverrideOption } from './override-options';
import { insertDisplayOverride, insertStyleOverride, type StyleTarget } from './override-insertion';
import { overrideSelector } from '../ui/override-selector';
import { resolveDisplay } from '../rendering/overrides';
import { applyEditorStyle } from '../styles/editor-style';
import { DiagramSyntaxSelector } from '../ui/diagram-syntax-selector';
import { initializeDiagram, insertComponent, type SourceInsertion } from './syntax/source';
import { insertConfiguration } from './syntax/configuration-insertion';

export class LiveEditor {
	readonly element: HTMLElement;
	private readonly sourceHost: HTMLElement;
	private readonly preview: HTMLElement;
	private readonly canonical: HTMLElement;
	private readonly output: HTMLTextAreaElement;
	private readonly native: HTMLElement;
	private readonly status: HTMLElement;
	private readonly draftStatus: HTMLElement;
	private readonly controller: DiagramController;
	private readonly scheduler: PreviewScheduler;
	private readonly nested: EditorView;
	private readonly syntax: DiagramSyntaxSelector;
	private css = '';
	private cssBaseline = '';
	private sourceBaseline = '';
	private cssDirty = false;
	private invalid = false;
	private conflict = false;
	private disposed = false;
	private inputMode: 'mermaid' | 'css' = 'mermaid';
	private outputMode = 'pele';
	private outputRevision = 0;
	private readonly resize: ResizeObserver;
	private readonly intersection: IntersectionObserver;
	private visible = true;
	private readonly buttons: HTMLButtonElement[] = [];
	private readonly presentation = new Compartment();
	private compositionRange?: { from: number; to: number };
	private cssTimer?: number;

	constructor(private readonly app: App, private readonly settings: () => AdvancedMermaidSettings, private readonly bridge: SourceBridge,
		private readonly file: string, private readonly close: () => void) {
		const doc = bridge.parent.dom.ownerDocument; const win = doc.defaultView!;
		// Create a detached element in its owning document, including pop-outs.
		this.element = doc.createElement('div'); this.element.className = 'advanced-mermaid-editor';
		applyEditorStyle(this.element, settings().liveEditor.style);
		const header = this.element.createDiv({ cls: 'advanced-mermaid-editor-header' });
		const sources = header.createDiv({ attr: { role: 'tablist', 'aria-label': 'Source format' } });
		for (const mode of ['mermaid', 'css'] as const) this.tab(sources, mode === 'css' ? 'CSS' : 'Mermaid', () => this.selectInput(mode), mode === 'mermaid');
		const outputs = header.createDiv({ attr: { role: 'tablist', 'aria-label': 'Preview format' } });
		for (const mode of ['pele', 'mermaid', 'svg']) this.tab(outputs, mode === 'svg' ? 'SVG' : mode === 'pele' ? 'Pele' : 'Mermaid', () => { this.outputMode = mode; void this.showOutput(); }, mode === 'pele');
		this.syntax = new DiagramSyntaxSelector(this.element.createDiv(), () => this.bridge.source(), {
			diagram: diagram => this.insertSyntax(source => initializeDiagram(source, diagram)),
			component: component => this.insertSyntax(source => {
				const selection = this.nested.state.selection.main;
				return insertComponent(source, selection.from, selection.to, component.text);
			}),
			configuration: diagram => this.insertSyntax(source => insertConfiguration(source, diagram)),
		});
		overrideSelector(this.element, () => overrideOptions(this.bridge.source()), (option, target) => this.insertOverride(option, target));
		const columns = this.element.createDiv({ cls: 'advanced-mermaid-editor-columns' });
		this.sourceHost = columns.createDiv({ cls: 'advanced-mermaid-editor-source', attr: { role: 'tabpanel', 'aria-label': 'Diagram source' } });
		this.applySourceFontSize();
		this.preview = columns.createDiv({ cls: 'advanced-mermaid-editor-preview', attr: { role: 'tabpanel', 'aria-label': 'Diagram preview' } });
		this.canonical = this.preview.createDiv();
		this.native = this.preview.createDiv(); this.native.hidden = true;
		// Pele is the renderer name.
		this.output = this.preview.createEl('textarea', { cls: 'advanced-mermaid-svg-source', attr: { readonly: '', 'aria-label': 'Canonical Pele SVG' } }); this.output.hidden = true;
		this.status = this.element.createDiv({ cls: 'advanced-mermaid-editor-status', attr: { role: 'status', 'aria-live': 'polite' } });
		this.draftStatus = this.element.createDiv({ cls: 'advanced-mermaid-draft-status', attr: { role: 'status' } });
		// Pele is the renderer name.
		const details = this.element.createEl('details', { cls: 'advanced-mermaid-renderer-details' }); details.createEl('summary', { text: 'Renderer details' }); details.createEl('p', { text: 'Canonical: Pele 1.12.0. All copy/save actions export Pele, including during native comparison.' });
		const footer = this.element.createDiv({ cls: 'advanced-mermaid-editor-footer' });
		const draftActions = footer.createDiv({ cls: 'advanced-mermaid-draft-actions' });
		this.button(draftActions, 'Copy draft', () => { void win.navigator.clipboard.writeText(this.inputMode === 'css' ? this.css : this.nested.state.doc.toString()).catch(() => { this.draftStatus.textContent = 'Clipboard unavailable. Select and copy the source text.'; }); });
		this.button(draftActions, 'Discard changes', () => { this.cssDirty = false; this.conflict = false; this.invalid = false; this.sync(true); });
		this.button(draftActions, 'Use note version', () => { this.cssDirty = false; this.conflict = false; this.sync(true); });
		this.button(draftActions, 'Render now', () => { if (this.flush()) this.scheduler.now(); });
		const endActions = footer.createDiv({ cls: 'advanced-mermaid-editor-end-actions' });
		this.sourceBaseline = bridge.source();
		try { this.css = styleRegion(this.sourceBaseline)?.css ?? ''; } catch { this.draftStatus.textContent = 'Repair the malformed style region in the Mermaid source. The saved note is retained.'; }
		this.cssBaseline = this.css;
		const extensions: Extension[] = [keymap.of([
			{ ...indentWithTab, stopPropagation: true },
			{ key: 'Enter', run: insertNewlineAndIndent, stopPropagation: true },
			{ key: 'Mod-z', run: () => undo(bridge.parent) }, { key: 'Mod-Shift-z', run: () => redo(bridge.parent) }, { key: 'Mod-y', run: () => redo(bridge.parent) },
			{ key: 'Mod-Enter', run: () => { if (this.flush()) this.scheduler.now(); return true; } },
			{ key: 'Escape', run: () => { if (this.canClose()) close(); return true; }, stopPropagation: true }, ...defaultKeymap,
		]), EditorView.updateListener.of(update => {
			if (!update.docChanged || update.transactions.every(transaction => transaction.annotation(nestedOrigin))) return;
			if (this.compositionRange) this.compositionRange.to = Math.max(this.compositionRange.to, update.state.selection.main.to);
			if (this.inputMode === 'mermaid') {
				if (this.conflict) { this.draftStatus.textContent = 'Draft retained. Use note version before applying further edits.'; return; }
				bridge.forward(update); this.sourceBaseline = bridge.source(); this.syntax.refresh(); this.invalidatePreview();
			} else { this.css = update.state.doc.toString(); this.cssDirty = this.css !== this.cssBaseline; this.validateCss(); }
			if (!update.view.composing && !this.conflict && (this.visible || this.nested.hasFocus)) this.scheduler.schedule(settings().liveEditor.debounceMs);
		}), EditorView.domEventHandlers({
			compositionstart: () => { const selection = this.nested.state.selection.main; this.compositionRange = { from: selection.from, to: selection.to }; },
			compositionend: () => { this.compositionRange = undefined; this.scheduler.schedule(settings().liveEditor.debounceMs); },
		})];
		extensions.push(this.presentation.of(this.presentationExtensions()));
		this.nested = new EditorView({ state: EditorState.create({ doc: this.sourceBaseline, extensions }), parent: this.sourceHost });
		this.scheduler = new PreviewScheduler(win, () => this.render(), text => { this.status.textContent = text; });
		this.syntax.load();
		this.controller = new DiagramController(this.canonical, this.sourceBaseline, settings, app, file, { boundary: this.preview, keepLastValid: true, changed: (valid, error) => {
			this.status.textContent = valid ? 'Current · ' + (this.canonical.dataset.category ?? 'diagram') : (this.canonical.classList.contains('advanced-mermaid-fallback') ? 'Using global/type fallback styling. ' : this.canonical.classList.contains('advanced-mermaid-stale') ? 'Preview is from the last valid source. ' : 'Diagram error. ') + (error instanceof Error ? error.message : 'Diagram error');
			if (error && typeof error === 'object' && 'line' in error && typeof error.line === 'number' && Number.isInteger(error.line)) {
				const line = error.line;
				this.button(this.status, 'Go To Line ' + line, () => { if (!this.selectInput('mermaid')) return; const target = this.nested.state.doc.line(Math.max(1, Math.min(this.nested.state.doc.lines, line))); this.nested.dispatch({ selection: { anchor: target.from }, scrollIntoView: true }); this.nested.focus(); });
			}
			bridge.parent.requestMeasure(); if (this.outputMode === 'svg') void this.showOutput();
		} });
		this.controller.load();
		const exports = this.canonical.querySelector<HTMLElement>('.advanced-mermaid-actions');
		if (exports) endActions.append(exports);
		this.resize = new win.ResizeObserver(entries => {
			const width = entries[0]?.contentRect.width ?? 0; const layout = settings().liveEditor.layout;
			this.element.dataset.layout = layout === 'stacked' || width < (layout === 'auto' ? 768 : 496) ? 'stacked' : 'side-by-side';
			bridge.parent.requestMeasure();
		}); this.resize.observe(this.element);
		this.intersection = new win.IntersectionObserver(entries => {
			this.visible = entries[0]?.isIntersecting ?? true;
			if (this.visible) this.scheduler.schedule(settings().liveEditor.debounceMs); else if (!this.nested.hasFocus) this.scheduler.cancel();
		}); this.intersection.observe(this.element);
	}
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
		const win = this.element.ownerDocument.defaultView!; win.clearTimeout(this.cssTimer);
		try {
			parseStyleCss(this.css, 'light'); parseStyleCss(this.css, 'dark'); this.invalid = false; this.draftStatus.textContent = this.cssDirty ? 'Valid CSS draft · pending save' : '';
			this.cssTimer = win.setTimeout(() => { if (!this.disposed && this.flush() && (this.visible || this.nested.hasFocus)) this.scheduler.schedule(0); }, this.settings().liveEditor.debounceMs);
		}
		catch (error) { this.invalid = true; this.controller.invalidate(); this.draftStatus.textContent = 'Unsaved CSS draft: ' + (error instanceof Error ? error.message : String(error)); }
	}
	private invalidatePreview(): void {
		this.controller.invalidate(); this.outputRevision++; this.output.value = '';
		if (this.outputMode === 'mermaid') this.native.textContent = 'Updating native comparison…';
	}
	flush(): boolean {
		this.element.ownerDocument.defaultView!.clearTimeout(this.cssTimer);
		if (this.conflict || this.invalid) return false;
		if (!this.cssDirty) return true;
		try {
			const source = this.bridge.source(); const current = styleRegion(source)?.css ?? '';
			if (current !== this.cssBaseline) { this.invalidatePreview(); this.conflict = true; this.draftStatus.textContent = 'The note styles changed externally. Copy the draft or use the note version.'; return false; }
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
			this.sync(); this.syntax.refresh();
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
			this.sync(); this.nested.dispatch({ selection: { anchor: inserted.from, head: inserted.to }, scrollIntoView: true }); this.nested.focus();
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
		this.replaceNested(mode === 'css' ? this.css : this.bridge.source());
		return true;
	}
	private replaceNested(text: string): void {
		const previous = this.nested.state.doc.toString(); if (previous === text) return;
		let start = 0; while (start < previous.length && start < text.length && previous[start] === text[start]) start++;
		let end = previous.length; let nextEnd = text.length;
		while (end > start && nextEnd > start && previous[end - 1] === text[nextEnd - 1]) { end--; nextEnd--; }
		this.nested.dispatch({ changes: { from: start, to: end, insert: text.slice(start, nextEnd) }, annotations: [nestedOrigin.of(true), Transaction.addToHistory.of(false)] });
	}
	sync(force = false): void {
		if (this.disposed) return;
		if (force) this.draftStatus.textContent = '';
		const source = this.bridge.source();
		if (!force && source === this.sourceBaseline) return;
		const previous = this.nested.state.doc.toString();
		let start = 0; while (start < source.length && start < previous.length && source[start] === previous[start]) start++;
		let end = previous.length; let sourceEnd = source.length;
		while (end > start && sourceEnd > start && previous[end - 1] === source[sourceEnd - 1]) { end--; sourceEnd--; }
		const composition = this.compositionRange ?? this.nested.state.selection.main;
		const overlaps = start <= composition.to && end >= composition.from;
		if (!force && this.inputMode === 'mermaid' && this.nested.composing && source !== previous && overlaps) {
			retainDraft({ file: this.file, source: this.nested.state.doc.toString(), css: this.css, reason: 'External change during composition' });
			this.conflict = true; this.invalidatePreview(); this.draftStatus.textContent = 'External change during composition. Local draft retained; use note version or copy draft.'; return;
		}
		let css = ''; try { css = styleRegion(source)?.css ?? ''; } catch (error) { this.draftStatus.textContent = String(error); }
		if (!force && this.cssDirty && css !== this.cssBaseline) { this.conflict = true; this.invalidatePreview(); this.draftStatus.textContent = 'Note styles changed externally. Copy the draft or use note version.'; return; }
		if (force || !this.cssDirty) { this.css = css; this.cssBaseline = css; this.invalid = false; }
		this.sourceBaseline = source;
		this.syntax.refresh();
		if (!this.nested.composing || !overlaps) this.replaceNested(this.inputMode === 'css' ? this.css : source);
		this.invalidatePreview(); if (this.visible || this.nested.hasFocus) this.scheduler.schedule(this.settings().liveEditor.debounceMs); else this.scheduler.cancel();
	}
	private presentationExtensions(): Extension[] {
		const options = this.settings().liveEditor;
		return [sourceLanguage(this.inputMode), options.lineNumbers ? lineNumbers() : [], options.wrapSource ? EditorView.lineWrapping : []];
	}
	private applySourceFontSize(): void {
		const size = this.settings().liveEditor.fontSizePx;
		if (size === null) this.sourceHost.style.removeProperty('--advanced-mermaid-editor-font-size');
		else this.sourceHost.style.setProperty('--advanced-mermaid-editor-font-size', `${size}px`);
	}
	refresh(): void {
		this.outputRevision++;
		applyEditorStyle(this.element, this.settings().liveEditor.style);
		this.applySourceFontSize();
		this.nested.dispatch({ effects: this.presentation.reconfigure(this.presentationExtensions()) });
		this.nested.requestMeasure();
		const layout = this.settings().liveEditor.layout; const width = this.element.getBoundingClientRect().width;
		this.element.dataset.layout = layout === 'stacked' || width < (layout === 'auto' ? 768 : 496) ? 'stacked' : 'side-by-side';
		this.controller.settingsChanged(); this.bridge.parent.requestMeasure();
		if (this.outputMode !== 'pele') void this.showOutput();
	}
	renderNow(): void { if (this.flush()) this.scheduler.now(); }
	focus(): void { if (!this.disposed) this.nested.focus(); }
	/** The parent note must not scroll its hidden fence cursor while the inline editor owns focus. */
	hasFocus(): boolean { return this.element.contains(this.element.ownerDocument.activeElement); }
	private render(): void {
		if (this.disposed || this.conflict || !this.flush()) return;
		this.controller.setSource(this.bridge.source()); if (this.outputMode !== 'pele') void this.showOutput();
	}
	private async showOutput(): Promise<void> {
		const revision = ++this.outputRevision;
		this.canonical.hidden = this.outputMode !== 'pele'; this.native.hidden = this.outputMode !== 'mermaid'; this.output.hidden = this.outputMode !== 'svg';
		for (const button of Array.from(this.element.querySelectorAll('button'))) if (/^(Copy|Save) (SVG|PNG)$/.test(button.textContent ?? '')) button.textContent = button.textContent.replace(/^(Copy|Save) /, '$1 Pele ');
		try {
			if (this.outputMode === 'svg') { this.output.value = ''; const snapshot = await this.controller.snapshot(); if (!this.disposed && revision === this.outputRevision) this.output.value = snapshot.svg; }
			if (this.outputMode === 'mermaid') {
				this.native.textContent = this.settings().liveEditor.mermaidComparison ? 'Checking native Mermaid capabilities…' : 'Enable Mermaid comparison in the plugin settings.';
				if (this.settings().liveEditor.mermaidComparison) {
					await renderNativeMermaid(this.bridge.source(), this.native, () => !this.disposed && revision === this.outputRevision);
					// Pele is the renderer name.
					if (!this.disposed && revision === this.outputRevision) this.native.createEl('p', { text: 'Native comparison uses its own styles. Export actions always use the canonical Pele result.' });
				}
			}
		} catch (error) { if (!this.disposed && revision === this.outputRevision) { this.output.value = String(error); this.native.textContent = String(error); } }
		this.bridge.parent.requestMeasure();
	}
	destroy(): void {
		if (this.disposed) return;
		if (this.cssDirty || this.conflict) retainDraft({ file: this.file, source: this.inputMode === 'mermaid' ? this.nested.state.doc.toString() : this.sourceBaseline, css: this.css, reason: 'Editor closed with an unsaved draft' });
		this.disposed = true; this.outputRevision++; this.scheduler.destroy(); this.resize.disconnect(); this.intersection.disconnect(); this.syntax.unload(); this.nested.destroy(); this.controller.destroy();
		this.element.ownerDocument.defaultView!.clearTimeout(this.cssTimer);
	}
}
