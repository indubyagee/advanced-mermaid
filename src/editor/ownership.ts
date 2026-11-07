interface Ownership { file: string; fromLine: number; toLine: number; source?: string }
const owners = new Map<HTMLElement, Ownership>();
const listeners = new Set<() => void>();
export function setInlineOwner(editor: HTMLElement, ownership?: Ownership): void {
	const previous = owners.get(editor);
	if (previous === ownership || previous && ownership && previous.file === ownership.file && previous.fromLine === ownership.fromLine && previous.toLine === ownership.toLine && previous.source === ownership.source) return;
	if (ownership) owners.set(editor, ownership); else owners.delete(editor);
	for (const listener of listeners) listener();
}
export function inlineOwns(element: HTMLElement, file: string, line: number): boolean {
	return inlineOwner(element, file, line) !== undefined;
}
export function inlineOwner(element: HTMLElement, file: string, line: number): Ownership | undefined {
	for (const [editor, owner] of owners) if (owner.file === file && owner.fromLine <= line && owner.toLine >= line && editor.contains(element)) return owner;
	return undefined;
}
export function observeOwnership(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
