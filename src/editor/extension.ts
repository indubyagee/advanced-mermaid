import { Prec, StateEffect, StateField, type Extension, type EditorState, type Transaction } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from '@codemirror/view';
import { indentUnit, syntaxTree } from '@codemirror/language';
import { editorInfoField, editorLivePreviewField, MarkdownView, type App, type Editor } from 'obsidian';
import { createDetachedEl } from '../dom';
import type { AdvancedMermaidSettings } from '../settings';
import { diagramFences, fenceAt, fenceContaining, fencesBetween, mapFenceBody, type FenceRange } from './fences';
import { updateFenceDecorations, type ActiveFence, type FencePresentation } from './fence-decorations';
import { sourceBridge } from './source-bridge';
import { LiveEditor } from './live-editor';
import { releaseInlineOwner, setInlineOwner } from './ownership';
import { applyEditorStyle } from '../styles/editor-style';
import { createRenderedPreviews } from './rendered-preview';
import type { FullScreenEditor } from './full-screen';

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
function mapFence(range: FenceRange, transaction: Transaction, preserveBodyWhileParsing = false): FenceRange | null | undefined {
	const { changes } = transaction;
	let removed = false;
	changes.iterChangedRanges((from, to) => { if (from <= range.from && to >= range.to) removed = true; });
	if (removed) return null;
	const from = changes.mapPos(range.from, 1);
	const to = changes.mapPos(range.to, -1);
	const mapped = fenceContaining(diagramFences(transaction.state), from);
	if (mapped) return mapped.from === from && mapped.to === to ? mapped : undefined;
	if (preserveBodyWhileParsing && syntaxTree(transaction.state).length < to) {
		return mapFenceBody(transaction.newDoc, changes, range);
	}
	return undefined;
}

export interface InlineExtension {
	extension: Extension; toggle(checking?: boolean, editor?: Editor): boolean; render(checking?: boolean, editor?: Editor): boolean;
	refresh(): void; remeasure(): void; destroy(): void; openAt(file: string, line: number | (() => number), element?: HTMLElement): boolean;
}

export function createInlineExtension(app: App, settings: () => AdvancedMermaidSettings, fullScreen?: FullScreenEditor): InlineExtension {
	const views = new Set<EditorView>();
	const sessions = new Map<EditorView, { id: number; editor: LiveEditor; mount: HTMLElement }>();
	const editorFor = (view: EditorView): LiveEditor | undefined => sessions.get(view)?.editor;
	const destroySession = (view: EditorView): void => {
		const session = sessions.get(view);
		if (!session) return;
		sessions.delete(view);
		if (fullScreen?.has(session.editor)) fullScreen.sourceLost(session.editor);
		else session.editor.destroy();
		releaseInlineOwner(view.dom, session.id);
	};
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
				const range = mapFence(active.range, transaction, true);
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
	const loseSession = (view: EditorView, editor: LiveEditor): void => {
		const session = sessions.get(view);
		if (session?.editor !== editor) return;
		destroySession(view);
		if (views.has(view) && view.state.field(state, false)?.id === session.id) view.dispatch({ effects: open.of(null) });
	};
	const chooseMode = (view: EditorView, from: number, mode: 'static' | 'live' | 'rendered'): void => {
		if (!settings().liveEditor.enabled || !view.state.field(editorLivePreviewField, false)) return;
		if (editorFor(view)?.canClose() === false) return;
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
		constructor(readonly mode: 'static' | 'live' | 'rendered') { super(); }
		eq(other: ModeWidget): boolean { return other.mode === this.mode; }
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
			const existing = sessions.get(view);
			if (existing?.id === this.id) return existing.mount;
			destroySession(view);
			const info = view.state.field(editorInfoField, false);
			const file = info?.file;
			let origin: MarkdownView | undefined;
			const bridge = sourceBridge(view, () => {
				const active = view.state.field(state, false);
				if (origin && (origin.getMode() !== 'source' || origin.leaf.view !== origin || origin.editor !== info?.editor)) return;
				return views.has(view) && active?.id === this.id && view.state.field(editorInfoField, false)?.file === file ? active.range : undefined;
			});
			const active = view.state.field(state);
			if (active?.id === this.id) publishOwnership(view, active);
			const mount = createDetachedEl(view.dom.ownerDocument, 'div');
			const editor = new LiveEditor(app, settings, bridge, () => file?.path ?? '',
				() => fullScreen?.has(editor) ? fullScreen.close(editor) : requestClose(view),
				fullScreen && (() => {
					if (fullScreen.has(editor)) { fullScreen.close(editor); return; }
					if (!settings().liveEditor.fullScreen || !bridge.range()) return;
					app.workspace.iterateAllLeaves(leaf => {
						if (leaf.view instanceof MarkdownView && leaf.view.editor === info?.editor) origin = leaf.view;
					});
					if (!origin) return;
					const current = () => !!bridge.range() && editorFor(view) === editor;
					void fullScreen.open(editor, origin.leaf, current, () => {
						mount.append(editor.element);
						editor.setFullScreen(false);
					}, () => loseSession(view, editor));
				}));
			sessions.set(view, { id: this.id, editor, mount });
			mount.append(editor.element);
			view.dom.ownerDocument.defaultView!.queueMicrotask(() => { if (editorFor(view) === editor) editor.focus(); });
			return mount;
		}
		ignoreEvent(): boolean { return true; }
		destroy(dom: HTMLElement): void {
			for (const [view, session] of sessions) if (session.mount === dom) {
				if (!fullScreen?.has(session.editor)) destroySession(view);
				break;
			}
		}
	}
	const decorationContext = (current: EditorState): DecorationContext | null => {
		if (!current.field(editorLivePreviewField, false)) return null;
		const active = current.field(state);
		const parsed = diagramFences(current);
		const fences = active && !fenceContaining(parsed, active.range.from)
			? [...parsed, active.range].sort((first, second) => first.from - second.from)
			: parsed;
		const selected = new Set<FenceRange>();
		for (const { from, to } of current.selection.ranges) {
			for (const fence of fencesBetween(fences, from, to)) selected.add(fence);
		}
		const { enabled, style } = settings().liveEditor;
		return { fences, selected, active, enabled, styleKey: enabled ? JSON.stringify(style) : '',
			file: current.field(editorInfoField, false)?.file?.path ?? '' };
	};
	const decorateFence = (current: EditorState, context: DecorationContext, fence: FenceRange) => {
		const { active, selected, enabled, file } = context;
		const isActive = active?.range.from === fence.from;
		const isSelected = selected.has(fence);
		const ranges = [];
		if (enabled) {
			const mode = isActive ? 'live' : isSelected ? 'static' : 'rendered';
			const widget = new ModeWidget(mode);
			ranges.push(Decoration.widget({ block: true, side: -1, widget }).range(fence.from));
		}
		if (isActive) {
			ranges.push(Decoration.replace({ block: true, widget: new InlineWidget(active.id) }).range(fence.from, fence.to));
		} else if (!isSelected) {
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
				const session = sessions.get(view);
				const editor = session?.editor;
				const active = view.state.field(state);
				const file = view.state.field(editorInfoField, false)?.file?.path;
				if (update.docChanged || active !== update.startState.field(state) || file !== update.startState.field(editorInfoField, false)?.file?.path) {
					publishOwnership(view, active);
				}
				if (update.docChanged) editor?.syncFromParent(update);
				if (editor && fullScreen?.has(editor) && (active?.id !== session.id || !editor.sourceAvailable())) {
					view.dom.ownerDocument.defaultView!.queueMicrotask(() => loseSession(view, editor));
				}
				if (update.state.tabSize !== update.startState.tabSize ||
					update.state.facet(indentUnit) !== update.startState.facet(indentUnit)) editor?.syncIndentation();
				if (update.transactions.some(transaction => transaction.effects.some(effect => effect.is(refresh)))) {
					// Refresh paint without replacing a mode bar and its adjacent live editor.
					for (const bar of Array.from(view.dom.querySelectorAll<HTMLElement>('.advanced-mermaid-editor-mode'))) applyEditorStyle(bar, settings().liveEditor.style);
					editor?.refresh();
				}
				if (update.selectionSet && settings().liveEditor.activation === 'focused-block' && !switching) {
					const target = fenceAt(view.state, view.state.selection.main.head);
					if (target && active && target.from !== active.range.from && !isStatic(view.state, target.from)) {
						switching = true;
						view.dom.ownerDocument.defaultView!.queueMicrotask(() => {
							switching = false;
							if (!views.has(view) || !settings().liveEditor.enabled || editorFor(view)?.canClose() === false) return;
							const current = fenceAt(view.state, view.state.selection.main.head);
								if (current && current.from !== view.state.field(state)?.range.from && !isStatic(view.state, current.from)) view.dispatch({ effects: open.of(current.from) });
						});
					}
				}
			},
			docViewUpdate() { previews.mountPending(view); },
			destroy() { views.delete(view); destroySession(view); setInlineOwner(view.dom); },
		};
	});
	const focused = (editor?: Editor): EditorView | undefined => [...views].find(view => editor ? view.state.field(editorInfoField, false)?.editor === editor : view.hasFocus || editorFor(view)?.hasFocus());
	return {
		extension: [staticBlocks, state, decorations, lifecycle, EditorView.scrollHandler.of(view => editorFor(view)?.hasFocus() ?? false)],
		toggle(checking = false, editor) {
			const view = focused(editor); if (!view || !settings().liveEditor.enabled || !view.state.field(editorLivePreviewField, false)) return false;
			const active = view.state.field(state); const range = fenceAt(view.state, view.state.selection.main.head);
			if (!range) return false;
			if (!checking && (!active || editorFor(view)?.canClose() !== false)) {
				const current = fenceAt(view.state, view.state.selection.main.head);
				if (current) chooseMode(view, current.from, active?.range.from === current.from ? 'rendered' : 'live');
			}
			return true;
		},
		render(checking = false, context) { const view = focused(context); const editor = view && editorFor(view); if (!editor) return false; if (!checking) editor.renderNow(); return true; },
		refresh() {
			for (const [view, { editor }] of sessions) {
				if (!settings().liveEditor.fullScreen && fullScreen?.has(editor)) fullScreen.close(editor);
				if (views.has(view)) editor.flush();
			}
			for (const view of views) view.dispatch({ effects: refresh.of(null) });
			previews.refresh();
		},
		remeasure() { for (const { editor } of sessions.values()) editor.remeasure(); },
		destroy() {
			for (const view of sessions.keys()) destroySession(view);
			for (const view of views) setInlineOwner(view.dom);
			previews.destroy(); views.clear();
		},
		openAt(file, line, element) {
			if (!settings().liveEditor.enabled) return false;
			for (const view of views) {
				if (element && !view.dom.contains(element)) continue;
				if (view.state.field(editorInfoField, false)?.file?.path !== file || !view.state.field(editorLivePreviewField, false)) continue;
				if (editorFor(view)?.canClose() === false) return false;
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
