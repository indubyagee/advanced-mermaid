export interface SyntaxSnippet {
	readonly label: string;
	readonly text: string;
	readonly group: string;
}

export function snippets(group: string, entries: readonly (string | readonly [label: string, text: string])[]): SyntaxSnippet[] {
	return entries.map(entry => typeof entry === 'string' ? { group, label: entry, text: entry } : { group, label: entry[0], text: entry[1] });
}
