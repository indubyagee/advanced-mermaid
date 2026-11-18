import { parse } from 'pele';
import { checkDiagramSource } from '../rendering/source-budget';

export const MAX_CANVAS_NODES = 300;
export const MAX_CANVAS_EDGES = 1_000;

export type CanvasDirection = 'TB' | 'BT' | 'LR' | 'RL';
export type CanvasEnd = 'arrow' | 'none';
export type CanvasVertex =
	| { type: 'text'; text: string }
	| { type: 'group'; label: string; members: readonly string[]; direction?: CanvasDirection };
export interface CanvasConnection {
	from: string;
	to: string;
	fromEnd: CanvasEnd;
	toEnd: CanvasEnd;
	label?: string;
	invisible: boolean;
}
export interface CanvasGraph {
	direction: CanvasDirection;
	vertices: ReadonlyMap<string, CanvasVertex>;
	connections: readonly CanvasConnection[];
}

const roles = { action: 'Action', connector: 'Connector', decision: 'Decision', input: 'Input', refdoc: 'Reference document', task: 'Task', tool: 'Tool' };
const fields = { description: 'Description', model: 'Model', instruction: 'Instruction', connectorRef: 'Connector reference' } as const;
const entities = new Map([['amp', '&'], ['apos', "'"], ['gt', '>'], ['lt', '<'], ['nbsp', '\u00a0'], ['quot', '"']]);

function direction(value?: string): CanvasDirection | undefined {
	switch (value?.toUpperCase()) {
		case 'TD': case 'TB': return 'TB';
		case 'BT': return 'BT';
		case 'LR': return 'LR';
		case 'RL': return 'RL';
		default: return undefined;
	}
}

function labelText(value: string): string {
	return value.replace(/\r\n?|<br\s*\/?>/gi, '\n')
		// Pele 1.12 marks Mermaid #entity; escapes in the parsed label.
		.replace(/&?ﬂ°(°?\w+)¶ß|&(#x[\da-f]+|#\d+|\w+);/gi, (match: string, mermaid: string | undefined, html: string | undefined) => {
			const entity = mermaid ?? html ?? '';
			const numeric = /^(?:°|#)(\d+)$|^#x([\da-f]+)$/i.exec(entity);
			if (numeric) {
				const codePoint = numeric[1] ? Number(numeric[1]) : Number.parseInt(numeric[2]!, 16);
				if (codePoint > 0 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff)) return String.fromCodePoint(codePoint);
			}
			return entities.get(entity.toLowerCase()) ?? (mermaid ? match.replace(/ﬂ°°?/, '#').replace('¶ß', ';') : match);
		});
}

export function parseCanvasGraph(source: string): CanvasGraph {
	checkDiagramSource(source);
	const model = parse(source);
	if (model.type !== 'flowchart' && model.type !== 'agentflow') throw new Error('Choose a Flowchart or Agentflow to save as a canvas.');
	const semantic = model.type === 'agentflow' ? model.semanticModel() : undefined;
	const diagnostic = semantic?.diagnostics.find(issue => issue.severity === 'error');
	if (diagnostic) throw new Error(diagnostic.message);

	const vertices = new Map<string, CanvasVertex>();
	for (const group of model.subgraphs) {
		if (vertices.has(group.id)) throw new Error('Assign a distinct ID to each diagram group before exporting.');
		vertices.set(group.id, { type: 'group', label: labelText(group.title), members: group.nodes, direction: direction(group.dir) });
	}
	const agents = new Map(semantic?.vertices.map(vertex => [vertex.id, vertex] as const));
	const nodes = model.type === 'agentflow' ? new Map([...model.nodes, ...model.connectors]) : model.nodes;
	for (const [id, node] of nodes) {
		// Pele can create an implicit node with the same ID as a group endpoint.
		if (vertices.has(id)) continue;
		const parts = [labelText(node.text ?? id)];
		const agent = agents.get(id);
		if (model.type === 'agentflow') {
			const role = model.connectors.has(id) ? 'connector' : agent?.vertexKind;
			if (role) parts.push(roles[role]);
			for (const field of Object.keys(fields) as (keyof typeof fields)[]) {
				const value = agent?.metadata?.[field];
				if (typeof value === 'string' && value.trim()) parts.push(fields[field] + '\n' + labelText(value));
			}
		}
		vertices.set(id, { type: 'text', text: parts.join('\n\n') });
	}
	if (!vertices.size) throw new Error('Add a node or group before saving the diagram as a canvas.');
	if (vertices.size > MAX_CANVAS_NODES || model.edges.length > MAX_CANVAS_EDGES) {
		throw new Error('Canvas export supports up to ' + MAX_CANVAS_NODES + ' nodes and groups and ' + MAX_CANVAS_EDGES + ' connections.');
	}

	const connections = model.edges.map((edge): CanvasConnection => {
		if (!vertices.has(edge.start) || !vertices.has(edge.end)) throw new Error('A diagram connection refers to a missing node or group.');
		const connection: CanvasConnection = {
			from: edge.start, to: edge.end, fromEnd: 'none', toEnd: 'none',
			label: edge.text ? labelText(edge.text) : undefined, invisible: edge.stroke === 'invisible',
		};
		const semantic = 'edgeSemantic' in edge ? edge.edgeSemantic : undefined;
		if (semantic === 'reference' || semantic === 'failure') {
			const kind = semantic === 'reference' ? 'Reference' : 'Failure';
			connection.label = connection.label ? kind + ' · ' + connection.label : kind;
			connection.toEnd = semantic === 'failure' ? 'arrow' : 'none';
			return connection;
		}
		switch (edge.type) {
			case 'double_arrow_point':
				connection.fromEnd = 'arrow';
				connection.toEnd = 'arrow';
				break;
			case 'arrow_point':
				connection.toEnd = 'arrow';
				break;
			case 'arrow_open': case 'arrow_circle': case 'double_arrow_circle': case 'arrow_cross': case 'double_arrow_cross':
				break;
			default:
				throw new Error('A diagram connection uses an endpoint marker that could not be converted.');
		}
		return connection;
	});
	return { vertices, connections, direction: direction(model.direction) ?? 'TB' };
}
