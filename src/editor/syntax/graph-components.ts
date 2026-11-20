import { snippets } from './snippet';

const classic = snippets('Classic nodes', [
	['Rectangle', 'A["node"]'], ['Rounded rectangle', 'A("node")'], ['Stadium', 'A(["node"])'],
	['Subprocess', 'A[["node"]]'], ['Database', 'A[("node")]'], ['Circle', 'A(("node"))'],
	['Asymmetric node', 'A>"node"]'], ['Decision', 'A{"node"}'], ['Hexagon', 'A{{"node"}}'],
	['Parallelogram', 'A[/"node"/]'], ['Reverse parallelogram', 'A[\\"node"\\]'],
	['Trapezoid', 'A[/"node"\\]'], ['Inverted trapezoid', 'A[\\"node"/]'], ['Double circle', 'A((("node")))'],
]);
const shapes = [
	['rect', 'Process (rectangle)'], ['rounded', 'Event (rounded rectangle)'], ['stadium', 'Terminal point (stadium)'],
	['fr-rect', 'Subprocess (framed rectangle)'], ['cyl', 'Database (cylinder)'], ['circle', 'Start (circle)'],
	['odd', 'Asymmetric node'], ['diam', 'Decision (diamond)'], ['hex', 'Preparation (hexagon)'],
	['lean-r', 'Data input or output (lean right)'], ['lean-l', 'Data input or output (lean left)'],
	['trap-b', 'Priority action (trapezoid)'], ['trap-t', 'Manual operation (inverted trapezoid)'],
	['dbl-circ', 'Stop (double circle)'], ['datastore', 'Data store'], ['text', 'Text block'],
	['notch-rect', 'Card (notched rectangle)'], ['lin-rect', 'Lined process'], ['sm-circ', 'Start (small circle)'],
	['fr-circ', 'Stop (framed circle)'], ['fork', 'Fork or join'], ['hourglass', 'Collate (hourglass)'],
	['brace', 'Comment (left brace)'], ['brace-r', 'Comment (right brace)'], ['braces', 'Comment (both braces)'],
	['bolt', 'Communication link (lightning bolt)'], ['doc', 'Document'], ['delay', 'Delay (half-rounded rectangle)'],
	['h-cyl', 'Direct access storage (horizontal cylinder)'], ['lin-cyl', 'Disk storage (lined cylinder)'],
	['curv-trap', 'Display (curved trapezoid)'], ['div-rect', 'Divided process'], ['tri', 'Extract (triangle)'],
	['win-pane', 'Internal storage (window pane)'], ['f-circ', 'Junction (filled circle)'],
	['lin-doc', 'Lined document'], ['notch-pent', 'Loop limit (trapezoidal pentagon)'],
	['flip-tri', 'Manual file (flipped triangle)'], ['sl-rect', 'Manual input (sloped rectangle)'],
	['docs', 'Multiple documents'], ['st-rect', 'Multiple processes'], ['flag', 'Paper tape (flag)'],
	['bow-rect', 'Stored data (bow tie rectangle)'], ['cross-circ', 'Summary (crossed circle)'],
	['tag-doc', 'Tagged document'], ['tag-rect', 'Tagged process'],
] as const;
const expanded = snippets('Expanded nodes', shapes.map(([shape, label]) => [label, `A@{ shape: ${shape}, label: process }`]));
const edges = snippets('Connections', [
	['Arrow', 'A --> B'], ['Line', 'A --- B'], ['Dotted arrow', 'A -.-> B'], ['Thick arrow', 'A ==> B'],
	['Invisible link', 'A ~~~ B'], ['Circle endpoint', 'A --o B'], ['Cross endpoint', 'A --x B'],
	['Bidirectional arrow', 'A <--> B'], ['Labelled arrow', 'A -->|label| B'], ['Chained arrows', 'A --> B --> C'],
	['Multiple endpoints', 'A & B --> C & D'], ['Arrow with ID', 'A e1@--> B'],
	['Edge metadata', 'A e1@--> B\ne1@{ curve: linear, animate: true }'],
]);
const structure = snippets('Structure and styling', [
	['Subgraph', 'subgraph group [Group]\n  A --> B\nend'],
	['Subgraph direction', 'direction LR'], ['Node style', 'style A fill:#ffffff,stroke:#333333'],
	['Define a class', 'classDef custom fill:#ffffff,stroke:#333333'], ['Assign a class', 'class A custom'],
	['Inline class', 'A:::custom'], ['Markdown label', 'A["`**node**`"]'], ['Comment', '%% Comment'],
	['Accessible title', 'accTitle: Diagram title'], ['Accessible description', 'accDescr: Diagram description'],
]);

export const flowchartComponents = [...classic, ...expanded, ...edges, ...structure];
export const swimlaneComponents = [
	...snippets('Lanes', [
		['Lane', 'subgraph lane [Lane]\n  A["Task"]\nend'],
		['Lane with a nested group', 'subgraph lane [Review]\n  subgraph phase [Drafting]\n    A["Draft"] --> B["Review"]\n  end\nend'],
	]),
	...flowchartComponents,
];
export const agentflowComponents = [
	...snippets('Workflow nodes', ([
		['task', 'Task'], ['tool', 'Tool'], ['input', 'Input'], ['decision', 'Decision'],
		['refdoc', 'Reference document'], ['action', 'Action'],
	] as const).map(([shape, label]) => [label, `A@{ shape: ${shape}, label: "Step" }`])),
	...snippets('Workflow structure', [
		['Flow', 'flow work [Work]\n  A["Task"]\nend'],
		['Global scope', 'global\n  A["Shared"]\nend'],
		['Connector', 'connector service ["Service"]'],
		['Node metadata', 'A@{ shape: task, label: "Task", description: "Description", model: "Model", instruction: "Instruction" }'],
		['Sequence edge', 'A --> B'], ['Reference edge', 'A -.- B'], ['Failure edge', 'A --x B'], ['Comment', '%% Comment'],
	]),
];
