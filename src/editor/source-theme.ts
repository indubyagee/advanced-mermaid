import { EditorView } from '@codemirror/view';

export const sourceTheme = EditorView.theme({
	'&': {
		minHeight: '180px',
		maxHeight: '70vh',
		border: '1px solid var(--background-modifier-border)',
		borderRadius: 'var(--radius-m, 6px)',
		overflow: 'hidden',
		backgroundColor: 'var(--advanced-mermaid-source-background)',
	},
	'.cm-scroller': {
		overflow: 'auto',
		fontFamily: 'var(--font-monospace, monospace)',
		fontSize: 'var(--advanced-mermaid-editor-font-size, inherit)',
	},
	'.cm-content': {
		minHeight: '180px',
		color: 'var(--advanced-mermaid-source-text)',
		caretColor: 'currentColor',
	},
	'.cm-line': { padding: '0 8px' },
	'.am-source-declaration, .cm-declaration': { color: 'var(--advanced-mermaid-source-token-color, var(--am-highlight-declaration))', fontWeight: 'bold' },
	'.am-source-keyword, .cm-keyword': { color: 'var(--advanced-mermaid-source-token-color, var(--am-highlight-keyword))' },
	'.am-source-operator, .cm-operator': { color: 'var(--advanced-mermaid-source-token-color, var(--am-highlight-operator))' },
	'.am-source-string, .cm-string': { color: 'var(--advanced-mermaid-source-token-color, var(--am-highlight-string))' },
	'.am-source-comment, .cm-comment': { color: 'var(--advanced-mermaid-source-token-color, var(--am-highlight-comment))', fontStyle: 'italic' },
	'.am-source-frontmatter, .cm-frontmatter': { color: 'var(--advanced-mermaid-source-token-color, var(--am-highlight-frontmatter))' },
	'.am-source-directive, .cm-directive': { color: 'var(--advanced-mermaid-source-token-color, var(--am-highlight-directive))' },
	'.am-source-number, .am-source-property, .cm-number, .cm-atom, .cm-property': { color: 'var(--advanced-mermaid-source-token-color, var(--am-highlight-number))' },
	'.cm-content ::selection, .cm-content::selection': { backgroundColor: 'var(--text-selection, #b3d4fc)' },
	'.am-indent-guides': {
		backgroundImage: 'repeating-linear-gradient(to right, var(--advanced-mermaid-indent-guide) 0 1px, transparent 1px var(--am-indent-step))',
		backgroundSize: 'var(--am-indent-width) var(--am-indent-height)',
		backgroundPosition: '8px 0',
		backgroundRepeat: 'no-repeat',
	},
	'.cm-foldGutter .cm-gutterElement': { color: 'var(--advanced-mermaid-fold-arrow)', cursor: 'pointer' },
	'.cm-foldPlaceholder': {
		color: 'var(--advanced-mermaid-fold-arrow)', backgroundColor: 'var(--advanced-mermaid-source-background)',
		borderColor: 'var(--advanced-mermaid-indent-guide)',
	},
	'.cm-gutters': {
		zIndex: 200,
		backgroundColor: 'var(--advanced-mermaid-source-background)',
	},
});
