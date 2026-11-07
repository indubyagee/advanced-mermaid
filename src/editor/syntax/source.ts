import { detectType } from 'pele';
import { frontmatterEnd } from '../../styles/local-codec';
import { checkDiagramSource } from '../../rendering/source-budget';
import type { DiagramSyntax } from './catalog';

export interface SourceInsertion { source: string; from: number; to: number }
export interface DeclarationRange { from: number; to: number; text: string }
export const sourceEol = (source: string): string => source.includes('\r\n') ? '\r\n' : '\n';

/** Skip YAML, ordinary comments and complete (possibly multiline) init directives. */
export function diagramDeclaration(source: string): DeclarationRange {
	let from = frontmatterEnd(source, true);
	while (from < source.length) {
		const whitespace = /^\s*/.exec(source.slice(from))![0]; from += whitespace.length;
		if (!source.startsWith('%%', from)) break;
		if (source.startsWith('%%{', from)) {
			const end = source.indexOf('}%%', from + 3);
			if (end < 0) throw new Error('Complete the Mermaid directive before selecting a diagram.');
			from = end + 3;
		} else {
			const end = source.indexOf('\n', from); from = end < 0 ? source.length : end + 1;
		}
	}
	const line = source.slice(from).split(/\r?\n/, 1)[0] ?? '';
	// Semicolons or trailing statements belong to the body, including inline nodes.
	const declaration = /^(?:(?:flowchart-elk|flowchart|graph|agentflow-beta|swimlane-beta|gitGraph|timeline)\b(?:[ \t]+(?:TB|TD|BT|LR|RL)\b)?:?|[\w-]+)/i.exec(line)?.[0] ?? '';
	return { from, to: from + declaration.length, text: declaration };
}

function inserted(source: string, from: number, to: number, text: string, selectionFrom = from, selectionTo = from + text.length): SourceInsertion {
	const updated = source.slice(0, from) + text + source.slice(to); checkDiagramSource(updated);
	return { source: updated, from: selectionFrom, to: selectionTo };
}

export function initializeDiagram(source: string, diagram: DiagramSyntax): SourceInsertion {
	const declaration = diagramDeclaration(source); const eol = sourceEol(source);
	let recognized = false;
	try { recognized = detectType(declaration.text) !== null; } catch { /* Keep an unrecognized draft intact. */ }
	if (declaration.text && !recognized) throw new Error('Select or clear the unrecognized diagram declaration before choosing a diagram.');
	const prefix = declaration.from && !/\s$/.test(source.slice(0, declaration.from)) ? eol : '';
	const suffix = declaration.to === source.length ? eol : '';
	const text = prefix + diagram.declaration + suffix;
	const cursor = declaration.from + text.length;
	return inserted(source, declaration.from, declaration.to, text, cursor, cursor);
}

/** Insert literally at the editor selection; add line breaks only at statement boundaries. */
export function insertComponent(source: string, from: number, to: number, text: string): SourceInsertion {
	const declaration = diagramDeclaration(source);
	if (from < declaration.to) throw new Error('Place the cursor in the diagram body before inserting a component.');
	const eol = sourceEol(source); const normalized = text.replace(/\r?\n/g, eol);
	const before = source.slice(source.lastIndexOf('\n', from - 1) + 1, from);
	const lineEnd = source.indexOf('\n', to); const after = source.slice(to, lineEnd < 0 ? source.length : lineEnd).replace(/\r$/, '');
	const prefix = from === declaration.to || /\S/.test(before) && from === to ? eol : '';
	const suffix = /\S/.test(after) && from === to ? eol : '';
	// Keep the snippet's relative indentation when inserting in a nested block.
	const indent = /^\s*$/.test(before) ? before : '';
	const body = normalized.split(eol).join(eol + indent);
	const cursor = from + prefix.length + body.length;
	return inserted(source, from, to, prefix + body + suffix, cursor, cursor);
}
