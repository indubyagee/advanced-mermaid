import { snippets } from './snippet';

const classic = snippets('Classic nodes', [
	'A["node"]', 'A("node")', 'A(["node"])', 'A[["node"]]', 'A[("node")]', 'A(("node"))',
	'A>"node"]', 'A{"node"}', 'A{{"node"}}', 'A[/"node"/]', 'A[\\"node"\\]',
	'A[/"node"\\]', 'A[\\"node"/]', 'A((("node")))',
]);
const shapes = [
	'rect', 'rounded', 'stadium', 'fr-rect', 'cyl', 'circle', 'odd', 'diam', 'hex', 'lean-r', 'lean-l',
	'trap-b', 'trap-t', 'dbl-circ', 'datastore', 'text', 'notch-rect', 'lin-rect', 'sm-circ', 'fr-circ',
	'fork', 'hourglass', 'brace', 'brace-r', 'braces', 'bolt', 'doc', 'delay', 'h-cyl', 'lin-cyl',
	'curv-trap', 'div-rect', 'tri', 'win-pane', 'f-circ', 'lin-doc', 'notch-pent', 'flip-tri', 'sl-rect',
	'docs', 'st-rect', 'flag', 'bow-rect', 'cross-circ', 'tag-doc', 'tag-rect',
];
const expanded = snippets('Expanded nodes', shapes.map(shape => `A@{ shape: ${shape}, label: process }`));
const edges = snippets('Connections', [
	'A --> B', 'A --- B', 'A -.-> B', 'A ==> B', 'A ~~~ B', 'A --o B', 'A --x B', 'A <--> B',
	'A -->|label| B', 'A --> B --> C', 'A & B --> C & D', 'A e1@--> B',
	['Edge metadata', 'A e1@--> B\ne1@{ curve: linear, animate: true }'],
]);
const structure = snippets('Structure and styling', [
	['Subgraph', 'subgraph group [Group]\n  A --> B\nend'],
	'direction LR', 'style A fill:#ffffff,stroke:#333333',
	'classDef custom fill:#ffffff,stroke:#333333', 'class A custom', 'A:::custom',
	['Markdown label', 'A["`**node**`"]'], '%% Comment', 'accTitle: Diagram title', 'accDescr: Diagram description',
]);

export const flowchartComponents = [...classic, ...expanded, ...edges, ...structure];
export const swimlaneComponents = [
	...snippets('Lanes', [['Lane', 'subgraph lane [Lane]\n  A["Task"]\nend']]),
	...flowchartComponents,
];
export const agentflowComponents = [
	...snippets('Workflow nodes', ['task', 'tool', 'input', 'decision', 'refdoc', 'action'].map(shape => `A@{ shape: ${shape}, label: "Step" }`)),
	...snippets('Workflow structure', [
		['Flow', 'flow work [Work]\n  A["Task"]\nend'],
		['Global scope', 'global\n  A["Shared"]\nend'],
		'connector service ["Service"]',
		['Node metadata', 'A@{ shape: task, label: "Task", description: "Description", model: "Model", instruction: "Instruction" }'],
		'A --> B', 'A -.- B', 'A --x B', '%% Comment',
	]),
];
