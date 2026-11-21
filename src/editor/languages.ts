import { StreamLanguage, syntaxHighlighting, HighlightStyle, type StringStream } from '@codemirror/language';
import * as hostLanguage from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import { DIAGRAM_SYNTAX } from './syntax/catalog';

const declarations = new Set([...DIAGRAM_SYNTAX.map(item => item.declaration.toLowerCase()),
	'graph', 'flowchart-elk', 'xychart', 'sankey', 'block', 'packet', 'architecture', 'radar',
	'treemap', 'treeview', 'venn', 'cynefin', 'wardley', 'swimlane', 'ishikawa', 'usecase',
]);
const keywords = new Set(('participant actor activate deactivate create destroy as subgraph end classDef style class click linkStyle direction ' +
	'Note note left right of over loop alt else opt par and critical option break box rect autonumber ' +
	'state title accTitle accDescr section dateFormat axisFormat excludes includes todayMarker tickInterval ' +
	'commit branch checkout switch merge cherry-pick reset id tag type order showData ' +
	'requirement functionalRequirement interfaceRequirement performanceRequirement physicalRequirement designConstraint element ' +
	'text risk verifymethod contains copies derives satisfies verifies refines traces ' +
	'x-axis y-axis line bar quadrant-1 quadrant-2 quadrant-3 quadrant-4 columns space ' +
	'group service junction in out icon label pos value target root module rule axis curve showLegend ' +
	'Person Person_Ext System System_Ext Container Component Rel Boundary System_Boundary Container_Boundary Deployment_Node ' +
	'LR TD TB BT RL horizontal vertical').split(/\s+/));

function quoted(stream: StringStream, state: { quote: string | null }): string {
	while (!stream.eol()) {
		const char = stream.next();
		if (char === '\\') stream.next();
		else if (char === state.quote) { state.quote = null; break; }
	}
	return 'string';
}

const mermaid = StreamLanguage.define({
	startState: () => ({ firstLine: true, frontmatter: false, directive: false, quote: null as string | null }),
	blankLine(state) { state.firstLine = false; },
	tokenTable: { declaration: tags.typeName, frontmatter: tags.meta, directive: tags.processingInstruction },
	token(stream, state) {
		if (state.firstLine) {
			state.firstLine = false;
			if (stream.match(/^\uFEFF?---\s*$/)) { state.frontmatter = true; return 'frontmatter'; }
		}
		if (state.quote) return quoted(stream, state);
		if (state.frontmatter && stream.sol() && stream.match(/^(?:---|\.\.\.)\s*$/)) { state.frontmatter = false; return 'frontmatter'; }
		if (stream.eatSpace()) return null;
		if (state.directive || stream.match('%%{')) {
			state.directive = !stream.match(/^.*?}%%/);
			if (state.directive) stream.skipToEnd();
			return 'directive';
		}
		if (stream.match('%%')) { stream.skipToEnd(); return 'comment'; }
		if (state.frontmatter && stream.match('#')) { stream.skipToEnd(); return 'comment'; }
		if (stream.peek() === '"' || stream.peek() === "'") { state.quote = stream.next()!; return quoted(stream, state); }
		if (state.frontmatter) { stream.match(/[^\s"'#]+/); return 'frontmatter'; }
		if (stream.match(/(?:[<|}]+|[ox*](?=[-=.]{2}))?[-=.]+(?:[>|ox*{]+|\))?/)) return 'operator';
		// Consume identifiers whole so a node such as `weekend` is not a keyword suffix.
		const word = stream.match(/^[\p{L}_][\p{L}\p{N}_]*(?:-[\p{L}\p{N}_]+)*/u);
		if (word && typeof word !== 'boolean') {
			const value = word[0];
			return declarations.has(value.toLowerCase()) ? 'declaration' : keywords.has(value) ? 'keyword' : null;
		}
		if (stream.match(/[{}[\]()|:;,]/)) return 'operator';
		if (stream.match(/\d+(?:\.\d+)?/)) return 'number';
		stream.next(); return null;
	},
});
const css = StreamLanguage.define({
	startState: () => ({ comment: false }),
	token(stream, state) {
		if (state.comment) { if (stream.match(/^.*?\*\//)) state.comment = false; else stream.skipToEnd(); return 'comment'; }
		if (stream.eatSpace()) return null;
		if (stream.match('/*')) { state.comment = true; return 'comment'; }
		if (stream.match(/"[^"\n]*"|'[^'\n]*'/)) return 'string';
		if (stream.match(/--[a-zA-Z0-9-]+/)) return 'property';
		if (stream.match(/#[\da-f]+/i)) return 'atom';
		if (stream.match(/\d+(?:\.\d+)?(?:px)?/)) return 'number';
		if (stream.match(/\.[a-z-]+/)) return 'keyword';
		stream.next(); return null;
	},
});
const sourceHighlightStyle = HighlightStyle.define([
	{ tag: tags.typeName, class: 'am-source-declaration' },
	{ tag: tags.keyword, class: 'am-source-keyword' },
	{ tag: tags.operator, class: 'am-source-operator' },
	{ tag: tags.string, class: 'am-source-string' },
	{ tag: tags.comment, class: 'am-source-comment' },
	{ tag: tags.meta, class: 'am-source-frontmatter' },
	{ tag: tags.processingInstruction, class: 'am-source-directive' },
	{ tag: [tags.number, tags.atom], class: 'am-source-number' },
	{ tag: tags.propertyName, class: 'am-source-property' },
]);

export function sourceLanguage(mode: 'mermaid' | 'css'): Extension {
	// Obsidian's StreamLanguage emits legacy cm-* tokens instead of Lezer tags.
	const legacyHighlighting = Reflect.get(hostLanguage, 'lineHighlighter') as Extension | undefined;
	return [mode === 'css' ? css : mermaid, syntaxHighlighting(sourceHighlightStyle), legacyHighlighting ?? []];
}
