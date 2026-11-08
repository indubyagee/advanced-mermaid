import { Prec, StateEffect, StateField, type Extension, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField, type App, type Editor } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { fenceAt, diagramFences, type FenceRange } from './fences';
import { sourceBridge } from './source-bridge';
import { LiveEditor } from './live-editor';
import { setInlineOwner } from './ownership';
import { applyEditorStyle } from '../styles/editor-style';

interface Active { range: FenceRange; id: number }
const open = StateEffect.define<number | null>();
const refresh = StateEffect.define<null>();
const modeChoice = StateEffect.define<{ from: number; static: boolean }>();
let identity = 0;

export interface InlineExtension {
	extension: Extension; toggle(checking?: boolean, editor?: Editor): boolean; render(checking?: boolean, editor?: Editor): boolean;
	refresh(): void; destroy(): void; openAt(file: string, line: number | (() => number), element?: HTMLElement): boolean;
}

export function createInlineExtension(app: App, settings: () => AdvancedMermaidSettings): InlineExtension {
	const views = new Set<EditorView>(); const editors = new Map<EditorView, LiveEditor>();
	const staticBlocks = StateField.define<readonly FenceRange[]>({
		create: () => [],
		update(previous, transaction) {
			const fences = transaction.docChanged ? diagramFences(transaction.state) : undefined;
			let ranges = transaction.docChanged ? previous.flatMap(range => {
				let removed = false; transaction.changes.iterChangedRanges((from, to) => { if (from <= range.from && to >= range.to) removed = true; });
				const mapped = fences!.find(block => block.from === transaction.changes.mapPos(range.from, 1) && block.to === transaction.changes.mapPos(range.to, -1));
				return !removed && mapped ? [mapped] : [];
			}) : [...previous];
			for (const effect of transaction.effects) if (effect.is(modeChoice)) {
				ranges = ranges.filter(range => range.from !== effect.value.from);
				const range = fenceAt(transaction.state, effect.value.from); if (effect.value.static && range) ranges.push(range);
			}
			return ranges;
		},
	});
	const isStatic = (state: EditorState, from: number): boolean => state.field(staticBlocks).some(range => range.from === from);
	const state = StateField.define<Active | null>({
		create: () => null,
		update(active, transaction) {
			if (!settings().liveEditor.enabled || !transaction.state.field(editorLivePreviewField, false)) return null;
			for (const effect of transaction.effects) if (effect.is(open)) {
				if (effect.value === null) return null;
				const range = fenceAt(transaction.state, effect.value);
				return range ? { range, id: ++identity } : null;
			}
			if (active && transaction.docChanged) {
				let removed = false;
				const previous = active.range;
				transaction.changes.iterChangedRanges((from, to) => { if (from <= previous.from && to >= previous.to) removed = true; });
				if (removed) return null;
				const from = transaction.changes.mapPos(active.range.from, 1);
				const range = diagramFences(transaction.state).find(block => block.from === from);
				const expectedClosing = transaction.changes.mapPos(previous.to, -1);
				active = range && range.to === expectedClosing ? { ...active, range } : null;
			}
			if (active && transaction.selection) {
				const range = active.range;
				if (transaction.state.selection.ranges.some(selection => !selection.empty && selection.from < range.to && selection.to > range.from && (selection.from < range.bodyFrom || selection.to > range.bodyTo))) return null;
			}
			if (!active && transaction.selection && settings().liveEditor.activation === 'focused-block') {
				const range = fenceAt(transaction.state, transaction.state.selection.main.head);
				if (range && !isStatic(transaction.state, range.from)) return { range, id: ++identity };
			}
			return active;
		},
	});
	const chooseMode = (view: EditorView, from: number, mode: 'static' | 'live' | 'rendered'): void => {
		if (!settings().liveEditor.enabled || !view.state.field(editorLivePreviewField, false)) return;
		if (editors.get(view)?.canClose() === false) return;
		const range = fenceAt(view.state, from); if (!range) return;
		if (mode === 'rendered') {
			// Live Preview reveals a fence whenever the note cursor is inside it.
			// Prefer an existing position outside all fences. A fence-only note
			// needs one trailing blank line to place the cursor in rendered mode.
			const outside = [range.to + 1, range.from - 1].find(position => position >= 0 && position <= view.state.doc.length && !fenceAt(view.state, position));
			view.dispatch({ effects: [modeChoice.of({ from: range.from, static: true }), open.of(null)],
				...(outside === undefined ? { changes: { from: range.to, insert: '\n' } } : {}), selection: { anchor: outside ?? range.to + 1 },
			});
			view.focus();
		} else {
			view.dispatch({ effects: [modeChoice.of({ from: range.from, static: mode === 'static' }), open.of(mode === 'live' ? range.from : null)], selection: { anchor: range.bodyFrom }, scrollIntoView: mode === 'static' });
			if (mode === 'static') view.focus();
		}
	};
	const requestClose = (view: EditorView): void => { const active = view.state.field(state); if (active) chooseMode(view, active.range.from, 'rendered'); };
	class ModeWidget extends WidgetType {
		private readonly styleKey = JSON.stringify(settings().liveEditor.style);
		constructor(readonly mode: 'static' | 'live' | 'rendered') { super(); }
		eq(other: ModeWidget): boolean { return other.mode === this.mode && other.styleKey === this.styleKey; }
		toDOM(view: EditorView): HTMLElement {
			// Create a detached element in its owning document, including pop-outs.
			const bar = view.dom.ownerDocument.createElement('div'); bar.className = 'advanced-mermaid-editor-mode'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Diagram editor mode');
			applyEditorStyle(bar, settings().liveEditor.style);
			for (const event of ['pointerdown', 'mousedown', 'click', 'dblclick']) bar.addEventListener(event, evt => evt.stopPropagation());
			for (const mode of ['rendered', 'live', 'static'] as const) {
				const button = bar.createEl('button', { text: mode === 'static' ? 'Static editor' : mode === 'live' ? 'Live editor' : 'Rendered view', attr: { type: 'button', 'aria-pressed': String(this.mode === mode) } });
				button.addEventListener('click', () => { if (view.dom.contains(bar)) chooseMode(view, view.posAtDOM(bar), mode); });
			}
			return bar;
		}
		ignoreEvent(): boolean { return true; }
	}
	class InlineWidget extends WidgetType {
		constructor(readonly id: number) { super(); }
		eq(other: InlineWidget): boolean { return other.id === this.id; }
		toDOM(view: EditorView): HTMLElement {
			const bridge = sourceBridge(view, () => { const active = view.state.field(state); return active?.id === this.id ? active.range : undefined; });
			const info = view.state.field(editorInfoField, false);
			const range = view.state.field(state)?.range;
			if (range) setInlineOwner(view.dom, { file: info?.file?.path ?? '', fromLine: view.state.doc.lineAt(range.from).number - 1, toLine: view.state.doc.lineAt(range.to).number - 1, source: bridge.source() });
			const editor = new LiveEditor(app, settings, bridge, info?.file?.path ?? '', () => requestClose(view));
			editors.set(view, editor);
			view.dom.ownerDocument.defaultView!.queueMicrotask(() => { if (editors.get(view) === editor) editor.focus(); });
			return editor.element;
		}
		ignoreEvent(): boolean { return true; }
		destroy(dom: HTMLElement): void {
			for (const [view, editor] of editors) if (editor.element === dom) { editor.destroy(); editors.delete(view); setInlineOwner(view.dom); }
		}
	}
	const decorate = (current: EditorState): DecorationSet => {
		if (!settings().liveEditor.enabled || !current.field(editorLivePreviewField, false)) return Decoration.none;
		const active = current.field(state);
		const ranges = diagramFences(current).map(range => Decoration.widget({ block: true, side: -1, widget: new ModeWidget(active?.range.from === range.from ? 'live' : current.selection.ranges.some(selection => selection.from <= range.to && selection.to >= range.from) ? 'static' : 'rendered') }).range(range.from));
		if (active) ranges.push(Decoration.replace({ block: true, widget: new InlineWidget(active.id) }).range(active.range.from, active.range.to));
		return Decoration.set(ranges, true);
	};
	const decorations = StateField.define<DecorationSet>({
		create: decorate,
		update: (_old, transaction) => decorate(transaction.state),
		provide: field => Prec.highest(EditorView.decorations.from(field)),
	});
	const lifecycle = ViewPlugin.define(view => {
		views.add(view);
		let switching = false;
		return {
			update(update) {
				const editor = editors.get(view);
				const active = view.state.field(state);
				if (active) setInlineOwner(view.dom, { file: view.state.field(editorInfoField, false)?.file?.path ?? '', fromLine: view.state.doc.lineAt(active.range.from).number - 1, toLine: view.state.doc.lineAt(active.range.to).number - 1, source: view.state.sliceDoc(active.range.bodyFrom, active.range.bodyTo) });
				else setInlineOwner(view.dom);
				if (update.docChanged) editor?.sync();
				if (update.transactions.some(transaction => transaction.effects.some(effect => effect.is(refresh)))) editor?.refresh();
				if (update.selectionSet && settings().liveEditor.activation === 'focused-block' && !switching) {
					const target = fenceAt(view.state, view.state.selection.main.head);
					if (target && active && target.from !== active.range.from && !isStatic(view.state, target.from)) {
						switching = true;
						view.dom.ownerDocument.defaultView!.queueMicrotask(() => {
							switching = false;
							if (!views.has(view) || !settings().liveEditor.enabled || editors.get(view)?.canClose() === false) return;
							const current = fenceAt(view.state, view.state.selection.main.head);
								if (current && current.from !== view.state.field(state)?.range.from && !isStatic(view.state, current.from)) view.dispatch({ effects: open.of(current.from) });
						});
					}
				}
			},
			destroy() { views.delete(view); editors.get(view)?.destroy(); editors.delete(view); setInlineOwner(view.dom); },
		};
	});
	const focused = (editor?: Editor): EditorView | undefined => [...views].find(view => editor ? view.state.field(editorInfoField, false)?.editor === editor : view.hasFocus || editors.get(view)?.element.contains(view.dom.ownerDocument.activeElement));
	return {
		extension: [staticBlocks, state, decorations, lifecycle, EditorView.scrollHandler.of(view => editors.get(view)?.hasFocus() ?? false)],
		toggle(checking = false, editor) {
			const view = focused(editor); if (!view || !settings().liveEditor.enabled || !view.state.field(editorLivePreviewField, false)) return false;
			const active = view.state.field(state); const range = fenceAt(view.state, view.state.selection.main.head);
			if (!range) return false;
			if (!checking && (!active || editors.get(view)?.canClose() !== false)) {
				const current = fenceAt(view.state, view.state.selection.main.head);
				if (current) chooseMode(view, current.from, active?.range.from === current.from ? 'rendered' : 'live');
			}
			return true;
		},
		render(checking = false, context) { const view = focused(context); const editor = view && editors.get(view); if (!editor) return false; if (!checking) editor.renderNow(); return true; },
		refresh() { for (const view of views) { editors.get(view)?.flush(); view.dispatch({ effects: refresh.of(null) }); } },
		destroy() { for (const editor of editors.values()) editor.destroy(); editors.clear(); views.clear(); },
		openAt(file, line, element) {
			if (!settings().liveEditor.enabled) return false;
			for (const view of views) {
				if (element && !view.dom.contains(element)) continue;
				if (view.state.field(editorInfoField, false)?.file?.path !== file || !view.state.field(editorLivePreviewField, false)) continue;
				if (editors.get(view)?.canClose() === false) return false;
				const currentLine = typeof line === 'function' ? line() : line;
				if (currentLine < 0 || currentLine >= view.state.doc.lines) continue;
				const range = fenceAt(view.state, view.state.doc.line(currentLine + 1).from);
				if (!range) return false;
				chooseMode(view, range.from, 'live'); return true;
			}
			return false;
		},
	};
}
