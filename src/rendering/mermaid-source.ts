/** A deliberately small native comparison subset, validated before the host can
 * perform layout. No source config, HTML, images, links, callbacks, or icons pass.
 */
export function safeMermaidSource(source: string): string {
	if (source.length > 50000) throw new Error('Native comparison source exceeds 50,000 characters.');
	if (/%%\{|^---\s*$|[<&@]|url\s*\(|https?:|data:/im.test(source)) throw new Error('Native comparison does not accept configuration, HTML, images, or external resources.');
	const lines = source.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('%%'));
	const header = lines.shift() ?? '';
	const label = '[\\p{L}\\p{N} _.,!?():/+-]+';
	const id = '[A-Za-z][A-Za-z0-9_]*';
	const node = `${id}(?:\\[${label}\\]|\\(${label}\\)|\\{${label}\\})?`;
	if (/^(?:flowchart|graph)\s+(LR|RL|TD|TB|BT)$/.test(header)) {
		const statement = new RegExp(`^${node}(?:\\s*(?:-->|---|==>|-\\.->)(?:\\|${label}\\|)?\\s*${node})*;?$`, 'u');
		if (lines.length > 200 || !lines.every(line => statement.test(line))) throw new Error('Native Flowchart comparison supports plain nodes and arrows only. Use Pele for other syntax.');
	} else if (header === 'sequenceDiagram') {
		const statement = new RegExp(`^(?:participant\\s+${id}(?:\\s+as\\s+${label})?|${id}\\s*(?:->>|-->>|->|-->)\\s*${id}\\s*:\\s*${label}|(?:activate|deactivate)\\s+${id}|Note\\s+(?:over|left of|right of)\\s+${id}(?:,${id})?\\s*:\\s*${label})$`, 'u');
		if (lines.length > 200 || !lines.every(line => statement.test(line))) throw new Error('Native Sequence comparison supports plain participants, messages, notes, and activations only.');
	} else throw new Error('Native comparison currently supports ordinary Flowchart and Sequence diagrams only.');
	return [header, ...lines].join('\n');
}
