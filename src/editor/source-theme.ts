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
	},
	'.cm-line': { padding: '0 8px' },
	'.cm-gutters': {
		zIndex: 200,
		backgroundColor: 'var(--advanced-mermaid-source-background)',
	},
});
