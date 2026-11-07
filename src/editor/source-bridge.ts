import { Annotation, Transaction, type ChangeSpec } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import { isolateHistory } from '@codemirror/commands';
import type { FenceRange } from './fences';

export const nestedOrigin = Annotation.define<boolean>();
export interface SourceBridge {
	parent: EditorView; range(): FenceRange | undefined; source(): string;
	commit(source: string, selection?: { from: number; to: number }): boolean; forward(update: ViewUpdate): void;
}
export function sourceBridge(parent: EditorView, range: () => FenceRange | undefined): SourceBridge {
	return {
		parent, range,
		source: () => { const block = range(); return block ? parent.state.sliceDoc(block.bodyFrom, block.bodyTo) : ''; },
		commit(source, selection) {
			const block = range(); if (!block) return false;
			parent.dispatch({ changes: { from: block.bodyFrom, to: block.bodyTo, insert: source + (block.empty && source ? '\n' : '') }, ...(selection ? { selection: { anchor: block.bodyFrom + selection.from, head: block.bodyFrom + selection.to } } : {}), effects: parent.scrollSnapshot(), annotations: [nestedOrigin.of(true), Transaction.userEvent.of('input'), isolateHistory.of('full')] });
			return true;
		},
		forward(update) {
			if (!update.docChanged || update.transactions.every(transaction => transaction.annotation(nestedOrigin))) return;
			const block = range(); if (!block) return;
			const changes: ChangeSpec[] = [];
			update.changes.iterChanges((from, to, _newFrom, _newTo, inserted) => changes.push({ from: block.bodyFrom + from, to: block.bodyFrom + to, insert: inserted }));
			if (block.empty) { this.commit(update.state.doc.toString()); return; }
			const event = update.transactions.map(transaction => transaction.annotation(Transaction.userEvent)).find(Boolean) ?? 'input.type';
			parent.dispatch({ changes, effects: parent.scrollSnapshot(), annotations: [nestedOrigin.of(true), Transaction.userEvent.of(event)] });
		},
	};
}
