export class LocalStyleError extends Error {
	constructor(message: string, readonly line: number, readonly column = 1) { super(message); this.name = 'LocalStyleError'; }
}

/** Find a real leading YAML delimiter, ignoring quoted multiline scalar text. */
export function frontmatterEnd(source: string, strict: boolean): number {
	const offset = /^(?:[ \t]*\r?\n)*/.exec(source)![0].length;
	source = source.slice(offset);
	if (!/^---\r?\n/.test(source)) return offset;
	const lines = [...source.matchAll(/[^\n]*(?:\n|$)/g)];
	let quote = ''; let flowDepth = 0;
	for (const line of lines.slice(1)) {
		const text = line[0].replace(/\r?\n$/, '');
		if (!quote && flowDepth === 0 && /^(?:---|\.\.\.)\s*$/.test(text)) return offset + line.index + line[0].length;
		let previous = '';
		for (let index = 0; index < text.length; index++) {
			const char = text[index]!;
			const before = previous;
			if (!/\s/.test(char)) previous = char;
			if (quote) {
				if (quote === '"' && char === '\\') { index++; continue; }
				if (char === quote) { if (quote === "'" && text[index + 1] === "'") index++; else quote = ''; }
				continue;
			}
			if (char === '#' && (index === 0 || /\s/.test(text[index - 1]!))) break;
			const start = !before || /[:[,{?-]/.test(before);
			if ((char === '"' || char === "'") && start) quote = char;
			else if ((char === '{' || char === '[') && start) flowDepth++;
			else if ((char === '}' || char === ']') && flowDepth > 0) flowDepth--;
		}
	}
	if (strict) throw new LocalStyleError('Complete the YAML frontmatter before adding local styles.', 1);
	return offset + source.length;
}
