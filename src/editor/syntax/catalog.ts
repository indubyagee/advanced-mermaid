import { detectType, type DiagramType } from 'pele';

export interface DiagramSyntax {
	readonly type: DiagramType;
	readonly label: string;
	readonly declaration: string;
}

/** Separate from the style registry: Pele also renders families without type-specific styles. */
const declarations: Record<DiagramType, readonly [label: string, ...declarations: string[]]> = {
	flowchart: ['Flowchart', ...['TB', 'TD', 'BT', 'LR', 'RL'].map(direction => `flowchart ${direction}`)],
	sequence: ['Sequence', 'sequenceDiagram'],
	class: ['Class', 'classDiagram'],
	state: ['State', 'stateDiagram-v2', 'stateDiagram'],
	er: ['Entity relationship', 'erDiagram'],
	pie: ['Pie', 'pie'],
	gantt: ['Gantt', 'gantt'],
	gitGraph: ['Git graph', 'gitGraph LR:', 'gitGraph TB:', 'gitGraph BT:'],
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
	agentflow: ['Agentflow', ...['TB', 'TD', 'BT', 'LR', 'RL'].map(direction => `agentflow-beta ${direction}`)],
	usecase: ['Use case', 'usecase-beta'],
	railroad: ['Railroad', 'railroad-beta', 'railroad-ebnf-beta', 'railroad-abnf-beta', 'railroad-peg-beta'],
	treeView: ['Tree view', 'treeView-beta'],
	venn: ['Venn', 'venn-beta'],
	cynefin: ['Cynefin', 'cynefin-beta'],
	wardley: ['Wardley map', 'wardley-beta'],
	swimlane: ['Swimlanes', ...['TB', 'TD', 'BT', 'LR', 'RL'].map(direction => `swimlane-beta ${direction}`)],
	ishikawa: ['Ishikawa', 'ishikawa-beta'],
	eventmodeling: ['Event modeling', 'eventmodeling'],
};

export const DIAGRAM_SYNTAX: readonly DiagramSyntax[] = Object.entries(declarations).flatMap(([type, [label, ...variants]]) => variants.map(declaration => ({
	type: type as DiagramType, declaration,
	label: variants.length === 1 ? label : type === 'c4' || type === 'railroad' || type === 'state' ? declaration : label + ' ' + declaration.split(' ')[1]!.replace(':', ''),
}))).sort((left, right) => left.label.localeCompare(right.label));

/** Declaration recognition works while the diagram body is incomplete. */
export function selectedDiagram(declaration: string): DiagramSyntax | undefined {
	let type: DiagramType | null;
	try { type = detectType(declaration); } catch { return undefined; }
	const choices = DIAGRAM_SYNTAX.filter(choice => choice.type === type);
	const exact = choices.find(choice => choice.declaration.toLowerCase() === declaration.toLowerCase());
	if (exact) return exact;
	const direction = /\b(TB|TD|BT|LR|RL)\b/i.exec(declaration)?.[1]?.toUpperCase();
	return choices.find(choice => direction && choice.declaration.includes(' ' + direction)) ?? choices.find(choice => type && choice.declaration === declarations[type][1]);
}
