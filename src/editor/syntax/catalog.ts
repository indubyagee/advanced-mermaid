import type { DiagramType } from 'pele';
import { detectDiagramType } from '../../rendering/pele-source';

export interface DiagramSyntax {
	readonly type: DiagramType;
	readonly label: string;
	readonly declaration: string;
	readonly syntaxDocs: string;
	readonly orientation?: OrientationSyntax;
}

export interface OrientationSyntax {
	readonly placement: 'header' | 'gitGraph' | 'body';
	readonly values: readonly string[];
}

const graphDirections = ['TB', 'TD', 'BT', 'LR', 'RL'];
const bodyDirections = ['TB', 'BT', 'LR', 'RL'];
const directionsInHeader: OrientationSyntax = { placement: 'header', values: graphDirections };
const directionsInBody: OrientationSyntax = { placement: 'body', values: bodyDirections };
const orientations: Partial<Record<DiagramType, OrientationSyntax>> = {
	flowchart: directionsInHeader,
	swimlane: directionsInHeader,
	agentflow: directionsInHeader,
	gitGraph: { placement: 'gitGraph', values: ['LR', 'TB', 'BT'] },
	timeline: { placement: 'header', values: ['LR', 'TD'] },
	xychart: { placement: 'header', values: ['horizontal', 'vertical'] },
	class: { placement: 'body', values: graphDirections },
	state: directionsInBody,
	er: directionsInBody,
	requirement: directionsInBody,
	usecase: { placement: 'body', values: graphDirections },
};

/** Separate from the style registry: Pele also renders families without type-specific styles. */
const declarations: Record<DiagramType, readonly [label: string, docsPage: string, declaration: string, ...variants: string[]]> = {
	flowchart: ['Flowchart', 'flowchart', 'flowchart'],
	sequence: ['Sequence', 'sequenceDiagram', 'sequenceDiagram'],
	class: ['Class', 'classDiagram', 'classDiagram'],
	state: ['State', 'stateDiagram', 'stateDiagram-v2', 'stateDiagram'],
	er: ['Entity relationship', 'entityRelationshipDiagram', 'erDiagram'],
	pie: ['Pie', 'pie', 'pie'],
	gantt: ['Gantt', 'gantt', 'gantt'],
	gitGraph: ['Git graph', 'gitgraph', 'gitGraph'],
	mindmap: ['Mindmap', 'mindmap', 'mindmap'],
	timeline: ['Timeline', 'timeline', 'timeline'],
	journey: ['User journey', 'userJourney', 'journey'],
	xychart: ['XY chart', 'xyChart', 'xychart-beta'],
	quadrantChart: ['Quadrant chart', 'quadrantChart', 'quadrantChart'],
	requirement: ['Requirement', 'requirementDiagram', 'requirementDiagram'],
	c4: ['C4', 'c4', 'C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment'],
	sankey: ['Sankey', 'sankey', 'sankey-beta'],
	block: ['Block', 'block', 'block-beta'],
	packet: ['Packet', 'packet', 'packet-beta'],
	kanban: ['Kanban', 'kanban', 'kanban'],
	architecture: ['Architecture', 'architecture', 'architecture-beta'],
	radar: ['Radar', 'radar', 'radar-beta'],
	treemap: ['Treemap', 'treemap', 'treemap-beta'],
	info: ['Info', 'https://pele.run/compatibility#diagram-types', 'info'],
	agentflow: ['Agentflow', 'agentflow', 'agentflow-beta'],
	usecase: ['Use case', 'usecase', 'usecase-beta'],
	railroad: ['Railroad', 'railroad', 'railroad-beta', 'railroad-ebnf-beta', 'railroad-abnf-beta', 'railroad-peg-beta'],
	treeView: ['Tree view', 'treeView', 'treeView-beta'],
	venn: ['Venn', 'venn', 'venn-beta'],
	cynefin: ['Cynefin', 'cynefin', 'cynefin-beta'],
	wardley: ['Wardley map', 'wardley', 'wardley-beta'],
	swimlane: ['Swimlanes', 'swimlanes', 'swimlane-beta'],
	ishikawa: ['Ishikawa', 'ishikawa', 'ishikawa-beta'],
	eventmodeling: ['Event modeling', 'eventmodeling', 'eventmodeling'],
};

export const DIAGRAM_SYNTAX: readonly DiagramSyntax[] = Object.entries(declarations).flatMap(([type, [label, docsPage, ...variants]]) => variants.map(declaration => ({
	type: type as DiagramType, declaration,
	label: variants.length === 1 ? label : declaration,
	syntaxDocs: docsPage.startsWith('https://') ? docsPage : 'https://mermaid.ai/open-source/syntax/' + docsPage + '.html',
	orientation: orientations[type as DiagramType],
}))).sort((left, right) => left.label.localeCompare(right.label));

/** Declaration recognition works while the diagram body is incomplete. */
export function selectedDiagram(declaration: string): DiagramSyntax | undefined {
	const keyword = /^[\w-]+/.exec(declaration)?.[0];
	if (!keyword) return undefined;
	const exact = DIAGRAM_SYNTAX.find(choice => choice.declaration === keyword);
	if (exact) return exact;
	let type: DiagramType | null;
	try { type = detectDiagramType(declaration); } catch { return undefined; }
	return DIAGRAM_SYNTAX.find(choice => choice.type === type && choice.declaration.toLowerCase() === keyword.toLowerCase())
		?? DIAGRAM_SYNTAX.find(choice => type && choice.declaration === declarations[type][2]);
}
