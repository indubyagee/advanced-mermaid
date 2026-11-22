import { Prec, countColumn, type EditorState, type Extension, type Text } from '@codemirror/state';
import { codeFolding, foldedRanges, foldEffect, foldKeymap, foldService, unfoldEffect } from '@codemirror/language';
import { Decoration, ViewPlugin, WidgetType, keymap, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { createDetachedEl } from '../dom';

function indentation(text: string, tabSize: number): number {
	return countColumn(/^[\t ]*/.exec(text)![0], tabSize);
}
function trivia(text: string): boolean { return /^(?:\s*|\s*(?:%%(?!\{)|#|\/\/).*)$/.test(text); }
function closing(text: string): boolean { return /^(?:end(?:[ \t]+note)?[ \t]*;?[ \t]*(?:%%.*)?$|[}\])]+(?:[;,]|\s|$))/.test(text.trimStart()); }

interface IndentBlock {
	readonly from: number;
	readonly column: number;
	readonly header: number;
	readonly parent?: IndentBlock;
	to: number;
	lastLine: number;
}

const indexes = new WeakMap<Text, { tabSize: number; headers: Map<number, IndentBlock>; parents: (IndentBlock | undefined)[] }>();

// Compute block boundaries once per document and tab width. Each line remembers
// its nearest parent so visible lines can draw guides for offscreen headers.
function indentIndex({ doc, tabSize }: EditorState) {
	const cached = indexes.get(doc);
	if (cached?.tabSize === tabSize) return cached;
	const headers = new Map<number, IndentBlock>();
	const parents: (IndentBlock | undefined)[] = [];
	let active: IndentBlock | undefined;
	let lastContent = doc.line(1);
	const finish = (block: IndentBlock, closingLine?: number): void => {
		if (lastContent.number === block.header) return;
		block.to = lastContent.to;
		block.lastLine = closingLine ?? lastContent.number;
		headers.set(block.header, block);
	};
	for (let number = 1; number <= doc.lines; number++) {
		const line = doc.line(number);
		if (trivia(line.text)) {
			parents[number] = active;
			continue;
		}
		const column = indentation(line.text, tabSize);
		const closes = closing(line.text);
		let guide: IndentBlock | undefined;
		while (active && active.column >= column) {
			const matchingClose = closes && active.column === column;
			finish(active, matchingClose ? number : undefined);
			if (matchingClose && active.to > active.from) guide = active;
			active = active.parent;
		}
		parents[number] = guide ?? active;
		if (!closes) active = { from: line.to, to: line.to, header: number, column, lastLine: number, parent: active };
		lastContent = line;
	}
	while (active) {
		finish(active);
		active = active.parent;
	}
	const index = { tabSize, headers, parents };
	indexes.set(doc, index);
	return index;
}

export function indentFold(state: EditorState, lineStart: number, lineEnd: number): { from: number; to: number } | null {
	const block = indentIndex(state).headers.get(state.doc.lineAt(lineStart).number);
	return block && block.from === lineEnd ? { from: block.from, to: block.to } : null;
}

class FoldArrow extends WidgetType {
	constructor(private readonly expanded: boolean) { super(); }
	eq(other: FoldArrow): boolean { return this.expanded === other.expanded; }
	toDOM(view: EditorView): HTMLElement {
		const anchor = createDetachedEl(view.dom.ownerDocument, 'span', { cls: 'am-fold-anchor' });
		const label = this.expanded ? 'Fold line' : 'Unfold line';
		const button = anchor.createEl('button', { cls: 'am-fold-arrow', attr: {
			type: 'button', title: label, 'aria-label': label, 'aria-expanded': String(this.expanded),
		} });
		button.addEventListener('mousedown', event => event.preventDefault());
		button.addEventListener('click', () => {
			const line = view.state.doc.lineAt(view.posAtDOM(anchor));
			let folded: { from: number; to: number } | undefined;
			foldedRanges(view.state).between(line.to, line.to, (from, to) => {
				if (from === line.to) folded = { from, to };
			});
			const range = folded ?? indentFold(view.state, line.from, line.to);
			if (range) view.dispatch({ effects: folded ? unfoldEffect.of(range) : foldEffect.of(range) });
			view.focus();
		});
		return anchor;
	}
}

function sourceDecorations(view: EditorView): DecorationSet {
	const { state } = view;
	const { headers, parents } = indentIndex(state);
	const folded = foldedRanges(state);
	const collapsed = new Set<number>();
	folded.between(0, state.doc.length, from => { collapsed.add(from); });
	const ranges = [];
	const seen = new Set<number>();
	for (const visible of view.visibleRanges) {
		for (let pos = state.doc.lineAt(visible.from).from; pos <= visible.to;) {
			const line = state.doc.lineAt(pos);
			pos = line.to + 1;
			if (seen.has(line.from)) continue;
			seen.add(line.from);
			const positions = [];
			for (let block = parents[line.number]; block; block = block.parent) {
				if (line.number <= block.lastLine && !collapsed.has(block.from)) {
					positions.push(`calc(var(--am-fold-center) + ${block.column}ch) 0`);
				}
			}
			if (positions.length) ranges.push(Decoration.line({
				class: 'am-indent-guides',
				attributes: { style: `background-position:${positions.join(',')};background-image:${positions.map(() => 'var(--am-indent-guide-image)').join(',')}` },
			}).range(line.from));
			if (headers.has(line.number) || collapsed.has(line.to)) {
				const start = line.from + /^[\t ]*/.exec(line.text)![0].length;
				ranges.push(Decoration.widget({ widget: new FoldArrow(!collapsed.has(line.to)), side: -1 }).range(start));
			}
		}
	}
	return Decoration.set(ranges, true);
}

const sourcePresentation = ViewPlugin.fromClass(class {
	decorations: DecorationSet;
	constructor(view: EditorView) { this.decorations = sourceDecorations(view); }
	update(update: ViewUpdate): void {
		if (update.docChanged || update.viewportChanged || update.state.tabSize !== update.startState.tabSize ||
			foldedRanges(update.state) !== foldedRanges(update.startState)) this.decorations = sourceDecorations(update.view);
	}
}, { decorations: value => value.decorations });

// Keep folding state outside the presentation compartment so appearance refreshes retain folds.
export const sourceTools: Extension = [
	foldService.of(indentFold), codeFolding(),
	Prec.high(keymap.of(foldKeymap.map(binding => ({ ...binding, stopPropagation: true })))), sourcePresentation,
];
