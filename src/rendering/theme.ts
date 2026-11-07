import type { AdvancedMermaidSettings, ThemeField } from '../settings';

export const TOKENS: Record<ThemeField, string> = {
	text: '--pele-fg', background: '--pele-bg', accent: '--pele-accent',
	line: '--pele-line', font: '--pele-font', monospace: '--pele-font-mono',
	nodeFill: '--pele-node-bg', nodeBorder: '--pele-node-border', nodeText: '--pele-node-text',
	edgeLabelFill: '--pele-edge-label-bg', edgeLabelText: '--pele-edge-label-text', edgeLabelBorder: '--pele-edge-label-border',
	subgraphFill: '--pele-cluster-bg', subgraphBorder: '--pele-cluster-border', subgraphText: '--pele-cluster-text',
	nodeBorderWidth: '--pele-node-width', edgeWidth: '--pele-edge-width', edgeLabelBorderWidth: '--pele-edge-label-width', subgraphBorderWidth: '--pele-cluster-width',
	labelSize: '--pele-label-size',
};

export function applyTheme(element: HTMLElement, theme: AdvancedMermaidSettings['theme']): void {
	for (const field of Object.keys(TOKENS) as ThemeField[]) {
		const value = theme[field];
		if (value) element.style.setProperty(TOKENS[field], value);
		else element.style.removeProperty(TOKENS[field]);
	}
	element.classList.toggle('advanced-mermaid-custom-cluster-fill', !!theme.subgraphFill);
}
