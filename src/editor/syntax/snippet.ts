export interface SyntaxSnippet {
	readonly label: string;
	readonly text: string;
	readonly group: string;
}

export function snippets(group: string, entries: readonly (readonly [label: string, text: string])[]): SyntaxSnippet[] {
	return entries.map(([label, text]) => ({ group, label, text }));
}
