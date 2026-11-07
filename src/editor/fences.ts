import type { EditorState } from '@codemirror/state';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';

export interface FenceRange { from: number; to: number; bodyFrom: number; bodyTo: number; empty: boolean; language: 'pele' | 'mermaid' }

/** Read parsed fence nodes, never search the document for matching source text. */
export function diagramFences(state: EditorState): FenceRange[] {
	const tree = syntaxTree(state); const candidates = new Set<number>();
	tree.iterate({ enter(node) {
		if (node.name === 'FencedCode' || node.name.includes('codeblock-begin')) candidates.add(state.doc.lineAt(node.from).from);
	} });
	const result: FenceRange[] = [];
	for (const from of candidates) {
		const opening = state.doc.lineAt(from);
		const match = /^( {0,3})(`{3,}|~{3,})\s*(pele|mermaid)\s*$/.exec(opening.text);
		if (!match) continue;
		const resolved = tree.resolveInner(opening.to, -1);
		let nested = false;
		for (let node = resolved.parent; node; node = node.parent) if (/Blockquote|List|Callout/i.test(node.name)) nested = true;
		if (nested) continue;
		// Closing positions also come from the syntax tree, including Obsidian's
		// public HyperMD token nodes and the standard Lezer Markdown parser.
		let closingFrom: number | undefined;
		tree.iterate({ from: opening.to, enter(node) {
			if (closingFrom !== undefined) return false;
			if (node.name === 'FencedCode' && node.from === from) return;
			if (node.name === 'CodeMark' || node.name.includes('codeblock-end')) {
				const line = state.doc.lineAt(node.from);
				const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line.text);
				if (line.from > from && close && close[1] && close[1][0] === match[2]![0] && close[1].length >= match[2]!.length) closingFrom = line.from;
			}
			if (node.name === 'FencedCode' && node.from > from) return false;
			return undefined;
		} });
		if (closingFrom === undefined) continue;
		const closing = state.doc.lineAt(closingFrom);
		const bodyFrom = opening.to + 1;
		result.push({ from, to: closing.to, bodyFrom, bodyTo: Math.max(bodyFrom, closing.from - 1), empty: closing.from === bodyFrom, language: match[3] as 'pele' | 'mermaid' });
	}
	return result;
}
export function fenceAt(state: EditorState, position: number): FenceRange | undefined {
	ensureSyntaxTree(state, Math.min(state.doc.length, position + 10000), 50);
	return diagramFences(state).find(block => position >= block.from && position <= block.to);
}
