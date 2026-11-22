import type { ChangeDesc, EditorState, Line, Text } from '@codemirror/state';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { Tree } from '@lezer/common';

export interface FenceRange { from: number; to: number; bodyFrom: number; bodyTo: number; empty: boolean; language: 'pele' | 'mermaid' }

interface OpeningFence { line: Line; marker: string; language: FenceRange['language'] }

const indexes = new WeakMap<Text, WeakMap<Tree, readonly FenceRange[]>>();
// An explicit lookup can advance the parse before CodeMirror publishes it to the state.
const extendedTrees = new WeakMap<EditorState, Tree>();

function openingFence(line: Line): OpeningFence | undefined {
	const match = /^ {0,3}(`{3,}|~{3,})\s*(pele|mermaid)\s*$/.exec(line.text);
	if (match) return { line, marker: match[1]!, language: match[2] as FenceRange['language'] };
	return undefined;
}

function closesFence(marker: string, line: Line): boolean {
	const end = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line.text)?.[1];
	return end !== undefined && end[0] === marker[0] && end.length >= marker.length;
}

function fenceRange({ line, language }: OpeningFence, closing: Line): FenceRange {
	const bodyFrom = line.to + 1;
	return { from: line.from, to: closing.to, bodyFrom,
		bodyTo: Math.max(bodyFrom, closing.from - 1), empty: closing.from === bodyFrom, language };
}

/** Preserve an already validated fence while Markdown parsing catches up to a body edit. */
export function mapFenceBody(doc: Text, changes: ChangeDesc, range: FenceRange): FenceRange | undefined {
	const from = changes.mapPos(range.from, 1);
	const to = changes.mapPos(range.to, -1);
	const opening = openingFence(doc.lineAt(from));
	const closing = doc.lineAt(to);
	if (!opening || opening.line.from !== from || opening.language !== range.language ||
		closing.from <= from || closing.to !== to || !closesFence(opening.marker, closing)) return undefined;

	let intact = true;
	changes.iterChangedRanges((oldFrom, oldTo, newFrom, newTo) => {
		if (oldFrom < range.bodyFrom || oldTo > range.bodyTo) { intact = false; return; }
		const last = Math.min(doc.lineAt(newTo).number, closing.number - 1);
		for (let number = doc.lineAt(newFrom).number; intact && number <= last; number++) {
			intact = !closesFence(opening.marker, doc.line(number));
		}
	});
	return intact ? fenceRange(opening, closing) : undefined;
}

/** Collect complete top-level blocks using the parser's fence markers. */
function collectFences(doc: Text, tree: Tree): readonly FenceRange[] {
	const fences: FenceRange[] = [];
	const closeFence = (opening: OpeningFence, closing: Line): void => {
		if (closing.from > opening.line.from && closesFence(opening.marker, closing)) fences.push(fenceRange(opening, closing));
	};

	let opening: OpeningFence | undefined;
	tree.iterate({ enter(node) {
		const { name, from } = node;
		if (/Blockquote|List|Callout/i.test(name)) return false;
		if (name === 'FencedCode') {
			// Lezer Markdown keeps both marks inside the same block node.
			opening = undefined;
			const start = openingFence(doc.lineAt(from));
			const end = node.node.lastChild;
			if (start && end?.name === 'CodeMark') closeFence(start, doc.lineAt(end.from));
			return false;
		}
		// Obsidian's HyperMD exposes opening and closing tokens in document order.
		if (name.includes('codeblock-begin')) opening = openingFence(doc.lineAt(from));
		else if (name.includes('codeblock-end') && opening) {
			closeFence(opening, doc.lineAt(from));
			opening = undefined;
		}
		return undefined;
	} });
	return fences;
}

function currentTree(state: EditorState): Tree {
	return extendedTrees.get(state) ?? syntaxTree(state);
}

export function diagramFences(state: EditorState): readonly FenceRange[] {
	const tree = currentTree(state);
	let byTree = indexes.get(state.doc);
	if (!byTree) indexes.set(state.doc, byTree = new WeakMap());
	let fences = byTree.get(tree);
	if (!fences) byTree.set(tree, fences = collectFences(state.doc, tree));
	return fences;
}

function firstFenceEndingAtOrAfter(fences: readonly FenceRange[], position: number): number {
	let low = 0;
	let high = fences.length;
	while (low < high) {
		const middle = (low + high) >>> 1;
		if (fences[middle]!.to < position) low = middle + 1;
		else high = middle;
	}
	return low;
}

export function fenceContaining(fences: readonly FenceRange[], position: number): FenceRange | undefined {
	const fence = fences[firstFenceEndingAtOrAfter(fences, position)];
	return fence && fence.from <= position ? fence : undefined;
}

export function* fencesBetween(fences: readonly FenceRange[], from: number, to: number): Generator<FenceRange> {
	for (let index = firstFenceEndingAtOrAfter(fences, from); index < fences.length; index++) {
		const fence = fences[index]!;
		if (fence.from > to) break;
		yield fence;
	}
}

export function fenceAt(state: EditorState, position: number): FenceRange | undefined {
	const known = fenceContaining(diagramFences(state), position);
	if (known) return known;
	const parsed = ensureSyntaxTree(state, Math.min(state.doc.length, position + 10000), 50);
	if (parsed && parsed !== currentTree(state)) {
		extendedTrees.set(state, parsed);
		return fenceContaining(diagramFences(state), position);
	}
	return undefined;
}
