import { detectType, PeleError, type DiagramType } from 'pele';
import { frontmatterEnd } from '../styles/frontmatter-boundary';
import { MAX_DIAGRAM_SOURCE_LENGTH } from './source-budget';

/** Skip the preamble without parsing the possibly incomplete diagram body. */
export function diagramStart(source: string): number {
	let from = frontmatterEnd(source, true);
	while (from < source.length) {
		from += /^\s*/.exec(source.slice(from))![0].length;
		if (!source.startsWith('%%', from)) break;
		if (source.startsWith('%%{', from)) {
			const end = source.indexOf('}%%', from + 3);
			if (end < 0) throw new Error('Complete the Mermaid directive before selecting a diagram.');
			from = end + 3;
		} else {
			const end = source.indexOf('\n', from);
			from = end < 0 ? source.length : end + 1;
		}
	}
	return from;
}

const bareAgentflow = /\bagentflow(?=[ \t\r\n;]|$)/;
const agentflowDeclaration = /^agentflow(?=[ \t\r\n;]|$)/;
const betaSuffix = '-beta';

interface PeleSource {
	source: string;
	limit?: number;
	restoreError?: (error: unknown) => unknown;
}

/** Adapt the declaration at the renderer boundary. The note retains its spelling. */
export function preparePeleSource(source: string): PeleSource {
	if (!bareAgentflow.test(source)) return { source };
	let from: number;
	try { from = diagramStart(source); } catch { return { source }; }
	const match = agentflowDeclaration.exec(source.slice(from));
	if (!match) return { source };
	const insertion = from + match[0].length;
	return {
		source: source.slice(0, insertion) + betaSuffix + source.slice(insertion),
		// Preserve the authored input budget after inserting the renderer keyword suffix.
		limit: source.length <= MAX_DIAGRAM_SOURCE_LENGTH ? MAX_DIAGRAM_SOURCE_LENGTH + betaSuffix.length : undefined,
		restoreError: error => restoreAgentflowError(error, source, insertion),
	};
}

export function detectDiagramType(source: string): DiagramType | null {
	return detectType(preparePeleSource(source).source);
}

function restoreAgentflowError(error: unknown, source: string, insertion: number): unknown {
	if (!(error instanceof PeleError) || error.line <= 0 || error.column <= 0) return error;
	const line = source.slice(0, insertion).split('\n').length;
	if (error.line !== line) return error;
	const lineStart = source.lastIndexOf('\n', insertion - 1) + 1;
	const insertionColumn = insertion - lineStart + 1;
	const column = error.column > insertionColumn ? Math.max(insertionColumn, error.column - betaSuffix.length) : error.column;
	const [text, pointer] = error.snippet.split('\n');
	if (!text || !pointer || text.slice(insertionColumn - 1, insertionColumn - 1 + betaSuffix.length) !== betaSuffix) {
		return new PeleError(error.message, error.code, { ...error, column });
	}
	const snippet = text.slice(0, insertionColumn - 1) + text.slice(insertionColumn - 1 + betaSuffix.length) + '\n' + '-'.repeat(column - 1) + '^';
	return new PeleError(error.message.replace(error.snippet, () => snippet), error.code, { ...error, column, snippet });
}
