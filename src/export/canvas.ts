import { parseCanvasGraph, type CanvasEnd } from './canvas-graph';
import { layOutCanvas, type CanvasRect } from './canvas-layout';

type Side = 'top' | 'right' | 'bottom' | 'left';
type CanvasNode = CanvasRect & { id: string } & ({ type: 'text'; text: string } | { type: 'group'; label: string });
interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	fromSide: Side;
	toSide: Side;
	fromEnd: CanvasEnd;
	toEnd: CanvasEnd;
	label?: string;
}

function literalMarkdown(text: string): string {
	// Backslash-escape ASCII punctuation to keep links, embeds, and markup inert.
	return text.split('\n').map(line => line.replace(/[!-/:-@[-\x60{-~]/g, '\\$&')).join('  \n');
}

function assertRectangle(rect: CanvasRect): void {
	if (![rect.x, rect.y, rect.width, rect.height].every(Number.isSafeInteger) || rect.width <= 0 || rect.height <= 0) {
		throw new Error('Could not position every Canvas card. Try a simpler diagram.');
	}
}

function contains(group: CanvasRect, child: CanvasRect): boolean {
	return child.x >= group.x && child.y >= group.y
		&& child.x + child.width <= group.x + group.width && child.y + child.height <= group.y + group.height;
}

function attachmentSides(from: CanvasRect, to: CanvasRect, parallel: number): [Side, Side] {
	if (from === to) {
		const sides = ['right', 'bottom', 'left', 'top'] as const;
		return [sides[parallel % 4]!, sides[(parallel + 3) % 4]!];
	}
	const dx = to.x + to.width / 2 - (from.x + from.width / 2);
	const dy = to.y + to.height / 2 - (from.y + from.height / 2);
	const horizontal = Math.abs(dx) >= Math.abs(dy);
	const [start, end]: [Side, Side] = horizontal
		? (dx >= 0 ? ['right', 'left'] : ['left', 'right'])
		: (dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom']);
	const [before, after]: [Side, Side] = horizontal ? ['top', 'bottom'] : ['left', 'right'];
	const pairs: [Side, Side][] = [[start, end], [before, before], [after, after], [end, start]];
	return pairs[parallel % pairs.length]!;
}

export function createCanvasExport(source: string): string {
	const graph = parseCanvasGraph(source);
	const positions = layOutCanvas(graph);
	const ids = new Map<string, string>();
	const groups: CanvasNode[] = [];
	const cards: CanvasNode[] = [];
	let next = 0;
	// These IDs are unique within this new file and independent of Mermaid IDs.
	const nextId = (): string => (++next).toString(16).padStart(16, '0');
	for (const [key, position] of positions) {
		assertRectangle(position);
		const vertex = graph.vertices.get(key)!;
		const id = nextId();
		ids.set(key, id);
		if (vertex.type === 'group') {
			for (const member of vertex.members) {
				const child = positions.get(member);
				if (!child || !contains(position, child)) throw new Error('Could not position every member inside its Canvas group.');
			}
			groups.push({ ...position, id, type: 'group', label: vertex.label });
		} else cards.push({ ...position, id, type: 'text', text: literalMarkdown(vertex.text) });
	}
	if (ids.size !== graph.vertices.size) throw new Error('Could not position every node and group on the canvas.');

	const parallels = new Map<string, number>();
	const edges: CanvasEdge[] = [];
	for (const connection of graph.connections) {
		if (connection.invisible) continue;
		const fromNode = ids.get(connection.from)!;
		const toNode = ids.get(connection.to)!;
		const pair = fromNode < toNode ? fromNode + toNode : toNode + fromNode;
		const parallel = parallels.get(pair) ?? 0;
		parallels.set(pair, parallel + 1);
		const [fromSide, toSide] = attachmentSides(positions.get(connection.from)!, positions.get(connection.to)!, parallel);
		edges.push({
			id: nextId(), fromNode, toNode, fromSide, toSide,
			fromEnd: connection.fromEnd, toEnd: connection.toEnd, label: connection.label,
		});
	}
	return JSON.stringify({ nodes: [...groups, ...cards], edges }, null, 2) + '\n';
}
