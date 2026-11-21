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
	'.cm-line': { '--am-fold-center': '6px', padding: '0 8px 0 12px' },
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
		'--am-indent-guide-image': 'linear-gradient(var(--advanced-mermaid-indent-guide), var(--advanced-mermaid-indent-guide))',
		backgroundSize: '1px 100%',
		backgroundRepeat: 'no-repeat',
	},
	'.am-fold-anchor': { display: 'inline-block', position: 'relative', width: '0', height: '0', verticalAlign: 'top' },
	'.am-fold-arrow': {
		display: 'grid', placeItems: 'center', position: 'absolute', left: '-12px', top: '0',
		width: '12px', height: '1lh', border: '0', padding: '0', background: 'transparent',
		color: 'var(--advanced-mermaid-fold-arrow)', font: 'inherit', cursor: 'pointer',
	},
	'.am-fold-arrow::before': {
		content: '""', width: '5px', height: '5px', borderRight: '1.5px solid', borderBottom: '1.5px solid',
		transform: 'rotate(-45deg)',
	},
	'.am-fold-arrow[aria-expanded="true"]::before': { transform: 'translateY(-1px) rotate(45deg)' },
	'.am-fold-arrow:focus-visible': { outline: '1px solid currentColor', outlineOffset: '-1px' },
	'.cm-foldPlaceholder': {
		color: 'var(--advanced-mermaid-fold-arrow)', backgroundColor: 'var(--advanced-mermaid-source-background)',
		borderColor: 'var(--advanced-mermaid-indent-guide)',
	},
	'.cm-gutters': {
		zIndex: 200,
		backgroundColor: 'var(--advanced-mermaid-source-background)',
	},
	'.cm-lineNumbers .cm-gutterElement': { padding: '0 4px 0 3px', minWidth: '0' },
});
