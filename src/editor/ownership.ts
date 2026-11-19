interface Ownership { id: number; file: string; fromLine: number; toLine: number; source?: string }
export interface InlineOwner { editor: HTMLElement; ownership: Ownership }
export interface OwnershipChange { editor: HTMLElement; previous?: Ownership; current?: Ownership }

const owners = new Map<HTMLElement, Ownership>();
const listeners = new Set<(change: OwnershipChange) => void>();

export function setInlineOwner(editor: HTMLElement, current?: Ownership): void {
	const previous = owners.get(editor);
	if (previous === current || previous && current && previous.id === current.id && previous.file === current.file &&
		previous.fromLine === current.fromLine && previous.toLine === current.toLine && previous.source === current.source) return;
	if (current) owners.set(editor, current); else owners.delete(editor);
	const change = { editor, previous, current };
	for (const listener of listeners) listener(change);
}

export function releaseInlineOwner(editor: HTMLElement, id: number): void {
	if (owners.get(editor)?.id === id) setInlineOwner(editor);
}

export function coversBlock(owner: Ownership, file: string, line: number | undefined): boolean {
	return owner.file === file && line !== undefined && owner.fromLine <= line && line <= owner.toLine;
}

export function inlineOwner(element: HTMLElement, file: string, line: number | undefined): InlineOwner | undefined {
	for (const [editor, ownership] of owners) {
		if (coversBlock(ownership, file, line) && editor.contains(element)) return { editor, ownership };
	}
	return undefined;
}

export function observeOwnership(listener: (change: OwnershipChange) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
