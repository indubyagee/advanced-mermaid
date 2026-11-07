import { detectType } from 'pele';
import { SEMANTIC_CONTROLS } from './semantic-controls';

/** Contract for the pinned renderer; declaration recognition is not syntax validation. */
export const STYLE_RENDERER_VERSION = '1.12.0';

export const DIAGRAM_CATEGORIES = [
	'agentflow', 'eventmodeling', 'flowchart', 'gantt', 'gitGraph', 'ishikawa',
	'kanban', 'mindmap', 'radar', 'sequence', 'state', 'swimlane', 'timeline',
	'treemap', 'treeView', 'journey',
] as const;
export type DiagramCategory = typeof DIAGRAM_CATEGORIES[number];

export const DIAGRAM_REGISTRY: Readonly<Record<DiagramCategory, {
	readonly label: string;
	readonly declarations: readonly string[];
}>> = {
	agentflow: { label: 'Agentflow', declarations: ['agentflow-beta'] },
	eventmodeling: { label: 'Event Modeling', declarations: ['eventmodeling'] },
	flowchart: { label: 'Flowchart', declarations: ['flowchart', 'graph', 'flowchart-elk'] },
	gantt: { label: 'Gantt', declarations: ['gantt'] },
	gitGraph: { label: 'GitGraph', declarations: ['gitGraph'] },
	ishikawa: { label: 'Ishikawa', declarations: ['ishikawa', 'ishikawa-beta'] },
	kanban: { label: 'Kanban', declarations: ['kanban'] },
	mindmap: { label: 'Mindmap', declarations: ['mindmap'] },
	radar: { label: 'Radar', declarations: ['radar-beta'] },
	sequence: { label: 'Sequence', declarations: ['sequenceDiagram'] },
	state: { label: 'State', declarations: ['stateDiagram', 'stateDiagram-v2'] },
	swimlane: { label: 'Swimlanes', declarations: ['swimlane-beta'] },
	timeline: { label: 'Timeline', declarations: ['timeline'] },
	treemap: { label: 'Treemap', declarations: ['treemap', 'treemap-beta'] },
	treeView: { label: 'TreeView', declarations: ['treeView-beta'] },
	journey: { label: 'User Journey', declarations: ['journey'] },
};

export function isDiagramCategory(value: unknown): value is DiagramCategory {
	return typeof value === 'string' && (DIAGRAM_CATEGORIES as readonly string[]).includes(value);
}

/** Always pass the complete source to Pele, including frontmatter and comments. */
export function diagramCategory(source: string): DiagramCategory | null {
	const type = detectType(source);
	return isDiagramCategory(type) ? type : null;
}

export const COLOR_TOKENS = {
	background: '--pele-bg', text: '--pele-fg', muted: '--pele-muted',
	line: '--pele-line', surface: '--pele-surface', surfaceAlt: '--pele-surface-alt',
	border: '--pele-border', accent: '--pele-accent', error: '--pele-error',
	foregroundOnLight: '--pele-fg-on-light', foregroundOnDark: '--pele-fg-on-dark',
	series1: '--pele-series-1', series2: '--pele-series-2', series3: '--pele-series-3',
	series4: '--pele-series-4', series5: '--pele-series-5', series6: '--pele-series-6',
	series7: '--pele-series-7', series8: '--pele-series-8',
} as const;
export type ColorToken = keyof typeof COLOR_TOKENS;

/** Existing plugin aliases, retained for migration, rather than new upstream tokens.
 * New semantic controls require the fixture gates in specification section 4.7.
 */
export const COMPATIBILITY_CONTROLS = {
	nodeFill: { variable: '--pele-node-bg', kind: 'color', refresh: 'paint' },
	nodeBorder: { variable: '--pele-node-border', kind: 'color', refresh: 'paint' },
	nodeText: { variable: '--pele-node-text', kind: 'color', refresh: 'paint' },
	edgeLabelFill: { variable: '--pele-edge-label-bg', kind: 'color', refresh: 'paint' },
	edgeLabelText: { variable: '--pele-edge-label-text', kind: 'color', refresh: 'paint' },
	edgeLabelBorder: { variable: '--pele-edge-label-border', kind: 'color', refresh: 'paint' },
	subgraphFill: { variable: '--pele-cluster-bg', kind: 'color', refresh: 'paint' },
	subgraphBorder: { variable: '--pele-cluster-border', kind: 'color', refresh: 'paint' },
	subgraphText: { variable: '--pele-cluster-text', kind: 'color', refresh: 'paint' },
	nodeBorderWidth: { variable: '--pele-node-width', kind: 'width', refresh: 'layout' },
	edgeWidth: { variable: '--pele-edge-width', kind: 'width', refresh: 'layout' },
	edgeLabelBorderWidth: { variable: '--pele-edge-label-width', kind: 'width', refresh: 'layout' },
	subgraphBorderWidth: { variable: '--pele-cluster-width', kind: 'width', refresh: 'layout' },
} as const;
export const ELEMENT_CONTROLS = { ...COMPATIBILITY_CONTROLS, ...SEMANTIC_CONTROLS } as const;
export type ElementControlId = keyof typeof ELEMENT_CONTROLS;

export type ThemeMode = 'light' | 'dark';
export type ColorPair = Partial<Record<ThemeMode, string>>;
export type FontWeight = 400 | 500 | 600 | 700 | 800 | 900;

export interface StyleProfile {
	colors: Partial<Record<ColorToken, ColorPair>>;
	font?: string;
	monospace?: string;
	radiusPx?: number;
	titleWeight?: FontWeight;
	headingWeight?: FontWeight;
	boldWeight?: FontWeight;
	labelSizePx?: number;
	elements: Partial<Record<ElementControlId, ColorPair | number>>;
}

export interface TypeStyleProfile {
	useGlobal: boolean;
	overrides: StyleProfile;
	frontmatter?: DiagramFrontmatter;
}

export interface DiagramFrontmatter {
	enabled: boolean;
	yaml: string;
}

export function emptyStyleProfile(): StyleProfile {
	return { colors: {}, elements: {} };
}
