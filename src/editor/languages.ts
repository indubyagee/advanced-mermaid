import { StreamLanguage, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import type { Extension } from '@codemirror/state';

const mermaid = StreamLanguage.define({
	token(stream) {
		if (stream.eatSpace()) return null;
		if (stream.match('%%')) { stream.skipToEnd(); return 'comment'; }
		if (stream.match(/"[^"\n]*"|'[^'\n]*'/)) return 'string';
		if (stream.match(/(?:flowchart|graph|sequenceDiagram|stateDiagram-v2|mindmap|participant|activate|deactivate|subgraph|end|classDef|style|class|Note|LR|TD|TB|BT|RL)\b/)) return 'keyword';
		if (stream.match(/[-=]+[>.]?|[{}[\]()|:]/)) return 'operator';
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
export function sourceLanguage(mode: 'mermaid' | 'css'): Extension {
	return [mode === 'css' ? css : mermaid, syntaxHighlighting(defaultHighlightStyle, { fallback: true })];
}
