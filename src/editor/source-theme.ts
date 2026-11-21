import { EditorView } from '@codemirror/view';
import { SOURCE_HIGHLIGHTS, SOURCE_HIGHLIGHT_TOKENS } from '../styles/source-highlight';

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
	'.cm-scroller:has(.cm-lineNumbers)': {
		// Reserve enough line height for larger numbers without increasing source text size.
		lineHeight: 'max(1.4em, var(--advanced-mermaid-line-number-font-size, 0px))',
	},
	'.cm-content': {
		minHeight: '180px',
		color: 'var(--advanced-mermaid-source-text)',
		caretColor: 'currentColor',
	},
	'.cm-line': { '--am-fold-center': '8px', padding: '0 8px 0 16px' },
	...Object.fromEntries(SOURCE_HIGHLIGHT_TOKENS.map(token => {
		const style = SOURCE_HIGHLIGHTS[token];
		return [style.selector, {
			color: `var(--am-highlight-${token})`,
			fontWeight: `var(--am-highlight-${token}-weight, ${'weight' in style ? style.weight : 'inherit'})`,
			...('italic' in style ? { fontStyle: 'italic' } : {}),
		}];
	})),
	'.cm-content ::selection, .cm-content::selection': { backgroundColor: 'var(--text-selection, #b3d4fc)' },
	'.am-indent-guides': {
		'--am-indent-guide-image': 'linear-gradient(var(--advanced-mermaid-indent-guide), var(--advanced-mermaid-indent-guide))',
		backgroundSize: '1px 100%',
		backgroundRepeat: 'no-repeat',
	},
	'.am-fold-anchor': { display: 'inline-block', position: 'relative', width: '0', height: '0', verticalAlign: 'top' },
	'.am-fold-arrow': {
		display: 'grid', placeItems: 'center', position: 'absolute', left: '-14px', top: '0',
		width: '12px', height: '1lh', border: '0', padding: '0', background: 'transparent',
		color: 'var(--advanced-mermaid-fold-arrow)', font: 'inherit', cursor: 'pointer',
	},
	'.am-fold-arrow::before': {
		content: '""', width: '4px', height: '4px', borderRight: '1.5px solid', borderBottom: '1.5px solid',
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
	'.cm-lineNumbers .cm-gutterElement': {
		padding: '0 4px 0 3px', minWidth: '0',
		fontSize: 'var(--advanced-mermaid-line-number-font-size, inherit)',
		color: 'var(--advanced-mermaid-line-number-text)',
	},
});
