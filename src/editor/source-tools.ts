import { Prec, countColumn, type EditorState, type Extension } from '@codemirror/state';
import { foldGutter, foldKeymap, foldService, getIndentUnit } from '@codemirror/language';
import { Decoration, ViewPlugin, keymap, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';

function indentation(text: string, tabSize: number): number {
	return countColumn(/^[\t ]*/.exec(text)![0], tabSize);
}
function trivia(text: string): boolean { return /^(?:\s*|\s*(?:%%(?!\{)|#|\/\/).*)$/.test(text); }
function closing(text: string): boolean { return /^(?:end(?:[ \t]+note)?[ \t]*;?[ \t]*(?:%%.*)?$|[}\])]+(?:[;,]|\s|$))/.test(text.trimStart()); }

/** Indentation owns the children; a dedent or closing statement stays visible. */
export function indentFold(state: EditorState, lineStart: number, lineEnd: number): { from: number; to: number } | null {
	const header = state.doc.lineAt(lineStart);
	if (trivia(header.text) || closing(header.text)) return null;
	const indent = indentation(header.text, state.tabSize);
	let to = lineEnd;
	for (let number = header.number + 1; number <= state.doc.lines; number++) {
		const child = state.doc.line(number);
		if (trivia(child.text)) continue;
		if (indentation(child.text, state.tabSize) <= indent) break;
		to = child.to;
	}
	return to > lineEnd ? { from: lineEnd, to } : null;
}

function guides(view: EditorView): DecorationSet {
	const ranges = [];
	const seen = new Set<number>();
	const width = view.defaultCharacterWidth;
	const step = getIndentUnit(view.state) * width;
	for (const visible of view.visibleRanges) {
		for (let pos = view.state.doc.lineAt(visible.from).from; pos <= visible.to;) {
			const line = view.state.doc.lineAt(pos);
			const columns = indentation(line.text, view.state.tabSize);
			if (columns && line.text.trim() && !seen.has(line.from)) ranges.push(Decoration.line({
				class: 'am-indent-guides',
				// Restrict paint to leading whitespace on the first visual row of a logical line.
				attributes: { style: `--am-indent-width:${columns * width}px;--am-indent-step:${step}px;--am-indent-height:${view.defaultLineHeight}px` },
			}).range(line.from));
			seen.add(line.from);
			pos = line.to + 1;
		}
	}
	return Decoration.set(ranges, true);
}

const indentGuides = ViewPlugin.fromClass(class {
	decorations: DecorationSet;
	constructor(view: EditorView) { this.decorations = guides(view); }
	update(update: ViewUpdate): void {
		if (update.docChanged || update.viewportChanged || update.geometryChanged) this.decorations = guides(update.view);
	}
}, { decorations: value => value.decorations });

// Keep folding state outside the presentation compartment so appearance refreshes retain folds.
export const sourceTools: Extension = [
	foldService.of(indentFold), foldGutter(),
	Prec.high(keymap.of(foldKeymap.map(binding => ({ ...binding, stopPropagation: true })))), indentGuides,
];
