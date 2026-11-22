import { syntaxBodies } from '../tests/syntax-fixtures.ts';

export const referenceFamilies = {
	flowchart: ['flowchart LR', 'graph TD', 'flowchart-elk LR'],
	swimlane: ['swimlane-beta LR', 'swimlane-beta TB'],
	sequence: ['sequenceDiagram'],
	state: ['stateDiagram', 'stateDiagram-v2'],
	journey: ['journey'],
	gantt: ['gantt'],
	gitGraph: ['gitGraph LR:', 'gitGraph TB:', 'gitGraph BT:'],
	mindmap: ['mindmap'],
	timeline: ['timeline'],
	radar: ['radar-beta'],
	treemap: ['treemap', 'treemap-beta'],
	kanban: ['kanban'],
	eventmodeling: ['eventmodeling'],
	ishikawa: ['ishikawa', 'ishikawa-beta'],
	treeView: ['treeView-beta'],
	agentflow: ['agentflow LR', 'agentflow-beta LR'],
	class: ['classDiagram'],
	er: ['erDiagram'],
	requirement: ['requirementDiagram'],
	packet: ['packet', 'packet-beta'],
	block: ['block', 'block-beta'],
	usecase: ['usecase-beta'],
	sankey: ['sankey', 'sankey-beta'],
	pie: ['pie'],
	quadrantChart: ['quadrantChart'],
	xychart: ['xychart', 'xychart-beta', 'xychart horizontal'],
	venn: ['venn-beta'],
};

export const referenceCases = Object.entries(referenceFamilies).flatMap(([family, declarations]) =>
	declarations.map(declaration => ({ family, declaration, source: declaration + '\n' + syntaxBodies[family] })));

const step = 'flowchart LR\n  A[Start] first@--> B[Review]\n  B second@--> C[Finish]';
const mindmap = 'mindmap\n  Root((Root))\n    First[First]\n      Child[Child]\n    Second[Second]\n      Leaf[Leaf]';
const agent = 'agentflow-beta LR\n  a[/Incoming/] --> b[Review]';
const sw = 'swimlane-beta TB\n  subgraph lane [Intake]\n    subgraph group [Review group]\n      A[Review]\n    end\n  end\n  subgraph other [Publish lane]\n    B[Publish]\n  end\n  A --> B';
const relationships = 'A ||--o{ B : includes\nB ||--o{ C : contains';
export const referenceDeltas = [
	{ name: 'Flowchart numbered steps', source: '---\nconfig:\n  flowchart:\n    stepDuration: 2\n    stepNumbers: true\n---\n' + step + '\n  first@{ step: 1 }\n  second@{ step: 2 }', control: step, selector: '.edge-step-badge' },
	{ name: 'Flowchart BPMN start node', source: 'flowchart LR\n  A@{ shape: bpmn-start, label: Start } --> B[Finish]', selector: '.bpmn-event-ring' },
	{ name: 'Flowchart circle link', source: 'flowchart LR\n  A --o B', control: 'flowchart LR\n  A --- B', selector: 'path[marker-end*="circle" i], circle.pele-marker' },
	{ name: 'Mindmap depth colors', source: '---\nconfig:\n  mindmap:\n    colorBy: depth\n---\n' + mindmap, control: mindmap, labels: ['First', 'Child', 'Second', 'Leaf'] },
	{ name: 'Agentflow input shorthand', source: agent, control: agent.replace('a[/Incoming/]', 'a@{ shape: input, label: Incoming }'), labels: ['Incoming'] },
	{ name: 'Swimlane nested subgraph', source: sw, selector: 'g.cluster, .pele-cluster', clusters: true },
	{ name: 'Swimlane BPMN start node', source: sw.replace('A[Review]', 'A@{ shape: bpmn-start, label: Review }'), selector: '.bpmn-event-ring' },
	{ name: 'ER left-to-right', source: 'erDiagram\n  direction LR\n  ' + relationships, control: 'erDiagram\n  direction TB\n  ' + relationships, labels: ['A', 'B', 'C'] },
	{ name: 'ER nested subgraph', source: 'erDiagram\n  direction LR\n  subgraph inventory\n    direction TB\n    A ||--o{ B : includes\n  end\n  B ||--o{ C : contains', selector: 'g.cluster, .pele-cluster', clusters: true },
];

// The timed sources use the same authored diagrams on either branch revision.
export const previewSamples = {
	Flowchart: 'flowchart LR\n  A[Sample 00] --> B[Review] --> C[Publish]',
	Agentflow: 'agentflow-beta LR\n  flow p["Publishing"]\n    A[Sample 00] --> B[Review] --> C[Publish]\n  end',
	Pie: 'pie\n  "Sample 00": 12\n  "Remaining": 6',
};
