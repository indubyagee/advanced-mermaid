import { StreamLanguage, syntaxHighlighting, HighlightStyle, type StringStream } from '@codemirror/language';
import * as hostLanguage from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { Tag, tags } from '@lezer/highlight';
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

function quoted(stream: StringStream, state: { quote: string | null }, yaml = false): void {
	while (!stream.eol()) {
		const char = stream.next();
		if (char === '\\' && (!yaml || state.quote === '"')) stream.next();
		else if (char === state.quote) {
			if (yaml && char === "'" && stream.eat("'")) continue;
			state.quote = null;
			break;
		}
	}
}

interface FrontmatterState {
	quote: string | null;
	flowDepth: number;
	keyAllowed: boolean;
	indent: number;
	blockIndent: number | null;
}

// Highlight editable YAML without requiring the frontmatter to parse successfully.
function frontmatterToken(stream: StringStream, state: FrontmatterState): string | null {
	if (state.quote) { quoted(stream, state, true); return 'frontmatter-value'; }
	if (stream.sol()) {
		state.indent = stream.indentation();
		if (state.blockIndent !== null && state.indent > state.blockIndent) {
			stream.skipToEnd();
			return 'frontmatter-value';
		}
		state.blockIndent = null;
		if (!state.flowDepth) state.keyAllowed = true;
	}
	if (stream.eatSpace()) return null;
	if (stream.match('#')) { stream.skipToEnd(); return 'comment'; }
	if (state.keyAllowed && stream.match(/^-(?=[ \t]|$)/)) return null;
	if (state.keyAllowed && stream.match(/^(?:(?:"(?:\\.|[^"\\])*"|'(?:''|[^'])*')[ \t]*:|[^\s"'#[\]{},:][^#[\]{},:]*:(?=[ \t[\]{},]|$))/)) {
		if (!state.flowDepth) state.indent = stream.column();
		state.keyAllowed = false;
		return 'frontmatter-key';
	}
	const next = stream.peek();
	if (next === '{' || next === '[') {
		stream.next();
		state.flowDepth++;
		state.keyAllowed = next === '{';
		return null;
	}
	if (state.flowDepth && (next === '}' || next === ']' || next === ',')) {
		stream.next();
		if (next !== ',') state.flowDepth--;
		state.keyAllowed = next === ',';
		return null;
	}
	state.keyAllowed = false;
	if (!state.flowDepth && stream.match(/^[|>](?:[1-9][+-]?|[+-][1-9]?)?(?=[ \t]|$)/)) {
		state.blockIndent = state.indent;
	} else if (next === '"' || next === "'") {
		state.quote = stream.next()!;
		quoted(stream, state, true);
	} else if (!stream.match(state.flowDepth ? /^[^\s,[\]{}]+/ : /^\S+/)) {
		stream.next();
	}
	return 'frontmatter-value';
}

const frontmatterKeyTag = Tag.define();
const frontmatterValueTag = Tag.define();

const mermaid = StreamLanguage.define({
	startState: () => ({ preamble: true, frontmatter: null as FrontmatterState | null, directive: false, quote: null as string | null }),
	copyState: state => ({ ...state, frontmatter: state.frontmatter && { ...state.frontmatter } }),
	tokenTable: { declaration: tags.typeName, 'frontmatter-key': frontmatterKeyTag, 'frontmatter-value': frontmatterValueTag, directive: tags.processingInstruction },
	token(stream, state) {
		if (state.preamble) {
			if (stream.match(/^[ \t]+$/)) return null;
			state.preamble = false;
			if (stream.match(/^\uFEFF?---\s*$/)) {
				state.frontmatter = { quote: null, flowDepth: 0, keyAllowed: true, indent: 0, blockIndent: null };
				return null;
			}
		}
		if (state.frontmatter) {
			if (stream.sol() && !state.frontmatter.quote && stream.match(/^(?:---|\.\.\.)\s*$/)) {
				state.frontmatter = null;
				return null;
			}
			return frontmatterToken(stream, state.frontmatter);
		}
		if (state.quote) { quoted(stream, state); return 'string'; }
		if (stream.eatSpace()) return null;
		if (state.directive || stream.match('%%{')) {
			state.directive = !stream.match(/^.*?}%%/);
			if (state.directive) stream.skipToEnd();
			return 'directive';
		}
		if (stream.match('%%')) { stream.skipToEnd(); return 'comment'; }
		if (stream.peek() === '"' || stream.peek() === "'") { state.quote = stream.next()!; quoted(stream, state); return 'string'; }
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
	{ tag: frontmatterKeyTag, class: 'am-source-frontmatter-key' },
	{ tag: frontmatterValueTag, class: 'am-source-frontmatter-value' },
	{ tag: tags.processingInstruction, class: 'am-source-directive' },
	{ tag: [tags.number, tags.atom], class: 'am-source-number' },
	{ tag: tags.propertyName, class: 'am-source-property' },
]);

export function sourceLanguage(mode: 'mermaid' | 'css'): Extension {
	// Obsidian's StreamLanguage emits legacy cm-* tokens instead of Lezer tags.
	const legacyHighlighting = Reflect.get(hostLanguage, 'lineHighlighter') as Extension | undefined;
	return [mode === 'css' ? css : mermaid, syntaxHighlighting(sourceHighlightStyle), legacyHighlighting ?? []];
}
