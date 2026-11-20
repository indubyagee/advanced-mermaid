import type { DiagramType } from 'pele';
import { detectDiagramType } from '../../rendering/pele-source';

export interface DiagramSyntax {
	readonly type: DiagramType;
	readonly label: string;
	readonly declaration: string;
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
const declarations: Record<DiagramType, readonly [label: string, ...declarations: string[]]> = {
	flowchart: ['Flowchart', 'flowchart'],
	sequence: ['Sequence', 'sequenceDiagram'],
	class: ['Class', 'classDiagram'],
	state: ['State', 'stateDiagram-v2', 'stateDiagram'],
	er: ['Entity relationship', 'erDiagram'],
	pie: ['Pie', 'pie'],
	gantt: ['Gantt', 'gantt'],
	gitGraph: ['Git graph', 'gitGraph'],
	mindmap: ['Mindmap', 'mindmap'],
	timeline: ['Timeline', 'timeline'],
	journey: ['User journey', 'journey'],
	xychart: ['XY chart', 'xychart-beta'],
	quadrantChart: ['Quadrant chart', 'quadrantChart'],
	requirement: ['Requirement', 'requirementDiagram'],
	c4: ['C4', 'C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment'],
	sankey: ['Sankey', 'sankey-beta'],
	block: ['Block', 'block-beta'],
	packet: ['Packet', 'packet-beta'],
	kanban: ['Kanban', 'kanban'],
	architecture: ['Architecture', 'architecture-beta'],
	radar: ['Radar', 'radar-beta'],
	treemap: ['Treemap', 'treemap-beta'],
	info: ['Info', 'info'],
	agentflow: ['Agentflow', 'agentflow-beta'],
	usecase: ['Use case', 'usecase-beta'],
	railroad: ['Railroad', 'railroad-beta', 'railroad-ebnf-beta', 'railroad-abnf-beta', 'railroad-peg-beta'],
	treeView: ['Tree view', 'treeView-beta'],
	venn: ['Venn', 'venn-beta'],
	cynefin: ['Cynefin', 'cynefin-beta'],
	wardley: ['Wardley map', 'wardley-beta'],
	swimlane: ['Swimlanes', 'swimlane-beta'],
	ishikawa: ['Ishikawa', 'ishikawa-beta'],
	eventmodeling: ['Event modeling', 'eventmodeling'],
};

export const DIAGRAM_SYNTAX: readonly DiagramSyntax[] = Object.entries(declarations).flatMap(([type, [label, ...variants]]) => variants.map(declaration => ({
	type: type as DiagramType, declaration,
	label: variants.length === 1 ? label : declaration,
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
		?? DIAGRAM_SYNTAX.find(choice => type && choice.declaration === declarations[type][1]);
}
