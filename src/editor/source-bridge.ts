import { Annotation, Transaction, type ChangeSpec } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import { isolateHistory } from '@codemirror/commands';
import type { FenceRange } from './fences';

export const nestedOrigin = Annotation.define<boolean>();
const forwardedOrigin = Annotation.define<symbol>();

export interface SourceChange { from: number; to: number; insert: string }

/** One contiguous replacement that preserves the shared prefix and suffix. */
export function sourceChange(previous: string, next: string): SourceChange | undefined {
	if (previous === next) return undefined;
	let from = 0;
	while (from < previous.length && from < next.length && previous[from] === next[from]) from++;
	let to = previous.length;
	let nextEnd = next.length;
	while (to > from && nextEnd > from && previous[to - 1] === next[nextEnd - 1]) {
		to--;
		nextEnd--;
	}
	return { from, to, insert: next.slice(from, nextEnd) };
}

export interface SourceBridge {
	parent: EditorView; range(): FenceRange | undefined; source(): string;
	commit(source: string, selection?: { from: number; to: number }): boolean; forward(update: ViewUpdate): void;
	isForwarded(update: ViewUpdate): boolean;
}
export function sourceBridge(parent: EditorView, range: () => FenceRange | undefined): SourceBridge {
	const forwarded = forwardedOrigin.of(Symbol());
	const replaceBody = (block: FenceRange, source: string, selection?: { from: number; to: number }, origin?: Annotation<symbol>): void => {
		const annotations: Annotation<unknown>[] = [Transaction.userEvent.of('input'), isolateHistory.of('full')];
		if (origin) annotations.push(origin);
		parent.dispatch({
			changes: { from: block.bodyFrom, to: block.bodyTo, insert: source + (block.empty && source ? '\n' : '') },
			...(selection ? { selection: { anchor: block.bodyFrom + selection.from, head: block.bodyFrom + selection.to } } : {}),
			effects: parent.scrollSnapshot(), annotations,
		});
	};
	return {
		parent, range,
		source: () => { const block = range(); return block ? parent.state.sliceDoc(block.bodyFrom, block.bodyTo) : ''; },
		commit(source, selection) {
			const block = range(); if (!block) return false;
			replaceBody(block, source, selection);
			return true;
		},
		forward(update) {
			const block = range(); if (!block) return;
			if (block.empty) { replaceBody(block, update.state.doc.toString(), undefined, forwarded); return; }
			const changes: ChangeSpec[] = [];
			update.changes.iterChanges((from, to, _newFrom, _newTo, inserted) => changes.push({ from: block.bodyFrom + from, to: block.bodyFrom + to, insert: inserted }));
			const event = update.transactions.map(transaction => transaction.annotation(Transaction.userEvent)).find(Boolean) ?? 'input.type';
			parent.dispatch({ changes, effects: parent.scrollSnapshot(), annotations: [forwarded, Transaction.userEvent.of(event)] });
		},
		isForwarded(update) {
			return update.transactions.every(transaction => !transaction.docChanged || transaction.annotation(forwardedOrigin) === forwarded.value);
		},
	};
}
