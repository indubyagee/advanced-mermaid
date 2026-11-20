import { diagramStart } from '../../rendering/pele-source';
import { checkDiagramSource } from '../../rendering/source-budget';
import { selectedDiagram, type DiagramSyntax } from './catalog';

export interface SourceInsertion { source: string; from: number; to: number }
interface OrientationRange { from: number; to: number; value: string }
export interface DeclarationRange {
	from: number;
	to: number;
	text: string;
	keyword: string;
	diagram?: DiagramSyntax;
	orientation?: OrientationRange;
}
export const sourceEol = (source: string): string => source.includes('\r\n') ? '\r\n' : '\n';

/** Skip YAML, ordinary comments and complete (possibly multiline) init directives. */
export function diagramDeclaration(source: string): DeclarationRange {
	const from = diagramStart(source);
	const line = /^[^\r\n]*/.exec(source.slice(from))![0];
	const keyword = /^[\w-]+/.exec(line)?.[0] ?? '';
	const diagram = selectedDiagram(keyword);
	const rule = diagram?.orientation;
	let length = keyword.length;
	let orientation: OrientationRange | undefined;
	if (rule && rule.placement !== 'body') {
		const suffix = /^([ \t]+)([a-z]+)(?=$|[ \t:;]|%%)/i.exec(line.slice(length));
		const value = rule.values.find(option => option.toLowerCase() === suffix?.[2]?.toLowerCase());
		if (value && suffix) {
			const start = from + length + suffix[1]!.length;
			length += suffix[0].length;
			orientation = { from: start, to: from + length, value };
		}
		if (rule.placement === 'gitGraph') length += /^[ \t]*:/.exec(line.slice(length))?.[0].length ?? 0;
	}
	return { from, to: from + length, text: line.slice(0, length), keyword, diagram, orientation };
}

/** Read only statements in the diagram's root, retaining the source offset for edits. */
function bodyOrientation(source: string, declaration: DeclarationRange): OrientationRange | undefined {
	const diagram = declaration.diagram;
	if (diagram?.orientation?.placement !== 'body') return undefined;
	const newline = source.indexOf('\n', declaration.to);
	if (newline < 0) return undefined;
	const start = newline + 1;
	// Blank comments and quoted text without moving source offsets or line boundaries.
	const body = source.slice(start).replace(/"(?:\\[\s\S]|[^"\\])*(?:"|$)|%%(?:\{[\s\S]*?(?:\}%%|$)|[^\n]*)/g,
		text => text.replace(/[^\r\n]/g, ' '));
	let braces = 0;
	let groups = 0;
	let note = false;
	let orientation: OrientationRange | undefined;
	const statements = diagram.type === 'usecase' ? /[^\r\n]+/g : /[^;\r\n]+/g;
	for (const match of body.matchAll(statements)) {
		const line = match[0];
		if (diagram.type === 'state') {
			if (/^\s*end[ \t]+note\b/i.test(line)) { note = false; continue; }
			if (note) continue;
			if (/^\s*note\b[^:]*$/i.test(line)) { note = true; continue; }
		}
		if (diagram.type === 'er' || diagram.type === 'usecase') {
			const open = diagram.type === 'er' ? /^\s*subgraph[ \t]+/ : /^\s*systemBoundary[ \t]+/;
			if (open.test(line)) groups++;
			if (/^\s*end[ \t]*;?\s*$/.test(line)) groups = Math.max(0, groups - 1);
		}
		if (braces === 0 && groups === 0) {
			const statement = /^(\s*direction[ \t]+)([a-z]+)[ \t]*$/i.exec(line);
			const value = diagram.orientation.values.find(option => option.toLowerCase() === statement?.[2]?.toLowerCase());
			if (value && statement) {
				const from = start + match.index + statement[1]!.length;
				orientation = { from, to: from + statement[2]!.length, value };
			}
		}
		// State descriptions and relation labels can contain literal braces.
		const colon = line.indexOf(':');
		const beforeColon = colon < 0 ? '' : line.slice(0, colon);
		const stateDescription = diagram.type === 'state' && /^\s*(?!accDescr\s*$)[\w.[\]*-]+\s*$/.test(beforeColon);
		const code = stateDescription || /--|\.\./.test(beforeColon) ? beforeColon : line;
		for (const brace of code.matchAll(/[{}]/g)) braces = Math.max(0, braces + (brace[0] === '{' ? 1 : -1));
	}
	return orientation;
}

export function diagramOrientation(source: string, declaration: DeclarationRange): string | undefined {
	return (declaration.orientation ?? bodyOrientation(source, declaration))?.value;
}

function inserted(source: string, from: number, to: number, text: string, selectionFrom = from, selectionTo = from + text.length): SourceInsertion {
	const updated = source.slice(0, from) + text + source.slice(to); checkDiagramSource(updated);
	return { source: updated, from: selectionFrom, to: selectionTo };
}

export function initializeDiagram(source: string, diagram: DiagramSyntax, orientation?: string): SourceInsertion {
	checkDiagramSource(source);
	const declaration = diagramDeclaration(source);
	const { from, to } = declaration;
	if (declaration.text && !declaration.diagram) throw new Error('Select or clear the unrecognized diagram declaration before choosing a diagram.');
	const rule = diagram.orientation;
	if (rule && (!orientation || !rule.values.includes(orientation))) throw new Error('Select an orientation for this diagram.');
	const eol = sourceEol(source);
	const prefix = from && !/\s/.test(source[from - 1]!) ? eol : '';
	const sameVariant = declaration.diagram === diagram;
	const keyword = sameVariant ? declaration.keyword : diagram.declaration;

	if (rule?.placement === 'body' && orientation) {
		const existing = bodyOrientation(source, declaration);
		if (existing) {
			const text = prefix + keyword + source.slice(to, existing.from) + orientation;
			return inserted(source, from, existing.to, text, from + text.length);
		}
		const newline = source.indexOf('\n', to);
		const lineEnd = newline < 0 ? source.length : newline + 1;
		const tail = source.slice(to, lineEnd);
		// Put a direction after a header comment, or before statements on the old header line.
		const headerTail = /^[ \t]*(?:%%[^\r\n]*)?(?:\r?\n)?$/.test(tail) ? tail : '';
		const text = prefix + keyword + headerTail + (headerTail.endsWith('\n') ? '' : eol) + '  direction ' + orientation + eol;
		return inserted(source, from, to + headerTail.length, text, from + text.length);
	}

	if (sameVariant && declaration.orientation && orientation) {
		const { from: start, to: end } = declaration.orientation;
		return inserted(source, start, end, orientation, start + orientation.length);
	}
	const direction = rule && orientation ? ' ' + orientation + (rule.placement === 'gitGraph' ? ':' : '') : '';
	const text = prefix + keyword + direction + (to === source.length ? eol : '');
	return inserted(source, from, to, text, from + text.length);
}

/** Insert literally at the editor selection; add line breaks only at statement boundaries. */
export function insertComponent(source: string, from: number, to: number, text: string, placeholder?: string): SourceInsertion {
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
	const start = from + prefix.length;
	const slot = placeholder === undefined ? -1 : body.indexOf(placeholder);
	const selectionFrom = start + (slot < 0 ? body.length : slot);
	const selectionTo = selectionFrom + (slot < 0 ? 0 : placeholder!.length);
	return inserted(source, from, to, prefix + body + suffix, selectionFrom, selectionTo);
}
