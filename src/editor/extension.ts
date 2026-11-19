import { Prec, StateEffect, StateField, type Extension, type EditorState, type Transaction } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField, type App, type Editor } from 'obsidian';
import { createDetachedEl } from '../dom';
import type { AdvancedMermaidSettings } from '../settings';
import { diagramFences, fenceAt, fenceContaining, fencesBetween, type FenceRange } from './fences';
import { updateFenceDecorations, type ActiveFence, type FencePresentation } from './fence-decorations';
import { sourceBridge } from './source-bridge';
import { LiveEditor } from './live-editor';
import { releaseInlineOwner, setInlineOwner } from './ownership';
import { applyEditorStyle } from '../styles/editor-style';
import { createRenderedPreviews } from './rendered-preview';

interface DecorationContext extends FencePresentation { enabled: boolean; file: string; styleKey: string }
interface DecoratedFences extends DecorationContext { decorations: DecorationSet }
const open = StateEffect.define<number | null>();
const refresh = StateEffect.define<null>();
const modeChoice = StateEffect.define<{ from: number; static: boolean }>();
let identity = 0;

function publishOwnership(view: EditorView, active: ActiveFence | null): void {
	if (!active) { setInlineOwner(view.dom); return; }
	const { id, range } = active;
	const current = view.state;
	setInlineOwner(view.dom, {
		id, file: current.field(editorInfoField, false)?.file?.path ?? '',
		fromLine: current.doc.lineAt(range.from).number - 1,
		toLine: current.doc.lineAt(range.to).number - 1,
		source: current.sliceDoc(range.bodyFrom, range.bodyTo),
	});
}

// A whole-block replacement ends the active session even if its text is identical.
function mapFence(range: FenceRange, transaction: Transaction): FenceRange | null | undefined {
	const { changes } = transaction;
	let removed = false;
	changes.iterChangedRanges((from, to) => { if (from <= range.from && to >= range.to) removed = true; });
	if (removed) return null;
	const from = changes.mapPos(range.from, 1);
	const mapped = fenceContaining(diagramFences(transaction.state), from);
	return mapped?.from === from && mapped.to === changes.mapPos(range.to, -1) ? mapped : undefined;
}

export interface InlineExtension {
	extension: Extension; toggle(checking?: boolean, editor?: Editor): boolean; render(checking?: boolean, editor?: Editor): boolean;
	refresh(): void; remeasure(): void; destroy(): void; openAt(file: string, line: number | (() => number), element?: HTMLElement): boolean;
}

export function createInlineExtension(app: App, settings: () => AdvancedMermaidSettings): InlineExtension {
	const views = new Set<EditorView>(); const editors = new Map<EditorView, LiveEditor>();
	const previews = createRenderedPreviews(app, settings);
	const staticBlocks = StateField.define<readonly FenceRange[]>({
		create: () => [],
		update(previous, transaction) {
			let ranges = transaction.docChanged ? previous.flatMap(range => {
				const mapped = mapFence(range, transaction);
				return mapped ? [mapped] : [];
			}) : previous;
			for (const effect of transaction.effects) if (effect.is(modeChoice)) {
				ranges = ranges.filter(range => range.from !== effect.value.from);
				if (effect.value.static) {
					const range = fenceAt(transaction.state, effect.value.from);
					if (range) ranges = [...ranges, range];
				}
			}
			return ranges;
		},
	});
	const isStatic = (state: EditorState, from: number): boolean => state.field(staticBlocks).some(range => range.from === from);
	const state = StateField.define<ActiveFence | null>({
		create: () => null,
		update(active, transaction) {
			if (!settings().liveEditor.enabled || !transaction.state.field(editorLivePreviewField, false)) return null;
			for (const effect of transaction.effects) if (effect.is(open)) {
				if (effect.value === null) return null;
				const range = fenceAt(transaction.state, effect.value);
				return range ? { range, id: ++identity } : null;
			}
			if (active && transaction.docChanged) {
				const range = mapFence(active.range, transaction);
				if (range === null) return null;
				active = range ? { id: active.id, range } : null;
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
		constructor(readonly mode: 'static' | 'live' | 'rendered', private readonly styleKey: string) { super(); }
		eq(other: ModeWidget): boolean { return other.mode === this.mode && other.styleKey === this.styleKey; }
		toDOM(view: EditorView): HTMLElement {
			const bar = createDetachedEl(view.dom.ownerDocument, 'div', {
				cls: 'advanced-mermaid-editor-mode',
				attr: { role: 'group', 'aria-label': 'Diagram editor mode' },
			});
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
			const active = view.state.field(state);
			if (active?.id === this.id) publishOwnership(view, active);
			const editor = new LiveEditor(app, settings, bridge, info?.file?.path ?? '', () => requestClose(view));
			editors.set(view, editor);
			view.dom.ownerDocument.defaultView!.queueMicrotask(() => { if (editors.get(view) === editor) editor.focus(); });
			return editor.element;
		}
		ignoreEvent(): boolean { return true; }
		destroy(dom: HTMLElement): void {
			for (const [view, editor] of editors) if (editor.element === dom) {
				editor.destroy(); editors.delete(view); releaseInlineOwner(view.dom, this.id);
			}
		}
	}
	const decorationContext = (current: EditorState): DecorationContext | null => {
		if (!current.field(editorLivePreviewField, false)) return null;
		const active = current.field(state);
		const fences = diagramFences(current);
		const selected = new Set<FenceRange>();
		for (const { from, to } of current.selection.ranges) {
			for (const fence of fencesBetween(fences, from, to)) selected.add(fence);
		}
		const { enabled, style } = settings().liveEditor;
		return { fences, selected, active, enabled, styleKey: enabled ? JSON.stringify(style) : '',
			file: current.field(editorInfoField, false)?.file?.path ?? '' };
	};
	const decorateFence = (current: EditorState, context: DecorationContext, fence: FenceRange) => {
		const { active, selected, enabled, styleKey, file } = context;
		const isActive = active?.range.from === fence.from;
		const isSelected = selected.has(fence);
		const ranges = [];
		if (enabled) {
			const mode = isActive ? 'live' : isSelected ? 'static' : 'rendered';
			const widget = new ModeWidget(mode, styleKey);
			ranges.push(Decoration.widget({ block: true, side: -1, widget }).range(fence.from));
		}
		if (isActive) {
			ranges.push(Decoration.replace({ block: true, widget: new InlineWidget(active.id) }).range(fence.from, fence.to));
		} else if (fence.language === 'mermaid' && !isSelected) {
			const widget = previews.widget(current.sliceDoc(fence.bodyFrom, fence.bodyTo), file);
			ranges.push(Decoration.replace({ block: true, widget }).range(fence.from, fence.to));
		}
		return ranges;
	};
	const decorateAll = (current: EditorState, context: DecorationContext): DecoratedFences => ({
		...context, decorations: Decoration.set(context.fences.flatMap(fence => decorateFence(current, context, fence)), true),
	});
	const decorations = StateField.define<DecoratedFences | null>({
		create(current) {
			const context = decorationContext(current);
			return context && decorateAll(current, context);
		},
		update(previous, transaction) {
			const current = transaction.state;
			const context = decorationContext(current);
			if (!context) return null;
			if (!previous || previous.enabled !== context.enabled || previous.styleKey !== context.styleKey || previous.file !== context.file) {
				return decorateAll(current, context);
			}
			const updated = updateFenceDecorations(previous, context, transaction.changes, fence => decorateFence(current, context, fence));
			return { ...context, decorations: updated };
		},
		provide: field => Prec.highest(EditorView.decorations.from(field, value => value?.decorations ?? Decoration.none)),
	});
	const lifecycle = ViewPlugin.define(view => {
		views.add(view);
		let switching = false;
		return {
			update(update) {
				const editor = editors.get(view);
				const active = view.state.field(state);
				const file = view.state.field(editorInfoField, false)?.file?.path;
				if (update.docChanged || active !== update.startState.field(state) || file !== update.startState.field(editorInfoField, false)?.file?.path) {
					publishOwnership(view, active);
				}
				if (update.docChanged) editor?.syncFromParent(update);
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
		refresh() { for (const view of views) { editors.get(view)?.flush(); view.dispatch({ effects: refresh.of(null) }); } previews.refresh(); },
		remeasure() { for (const editor of editors.values()) editor.remeasure(); },
		destroy() {
			for (const editor of editors.values()) editor.destroy();
			for (const view of views) setInlineOwner(view.dom);
			editors.clear(); previews.destroy(); views.clear();
		},
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
