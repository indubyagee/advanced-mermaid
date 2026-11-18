import type { CanvasDirection, CanvasGraph } from './canvas-graph';

interface Size { width: number; height: number }
export interface CanvasRect extends Size { x: number; y: number }
interface Scope {
	children: string[];
	outgoing: Map<string, Set<string>>;
	neighbors: Map<string, Set<string>>;
}

const ITEM_GAP = 64;
const RANK_GAP = 112;
const GROUP_SIDE = 40;
const GROUP_TOP = 56;

function textWidth(text: string): number {
	let width = 0;
	for (const character of text) width += character.codePointAt(0)! >= 0x2e80 ? 17 : 9;
	return width;
}

function cardSize(text: string): Size {
	const lines = text.split('\n').map(textWidth);
	const width = Math.min(432, Math.max(224, 48 + lines.reduce((max, line) => Math.max(max, line), 0)));
	const rows = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line / (width - 48))), 0);
	return { width, height: Math.max(96, 52 + 24 * rows) };
}

function indexScopes(graph: CanvasGraph): Map<string | undefined, Scope> {
	const scopes = new Map<string | undefined, Scope>();
	const parents = new Map<string, string>();
	for (const [id, vertex] of graph.vertices) {
		if (vertex.type !== 'group') continue;
		for (const member of new Set(vertex.members)) {
			if (!graph.vertices.has(member) || parents.has(member)) throw new Error('A diagram group has invalid membership.');
			parents.set(member, id);
		}
	}

	const paths = new Map<string, string[]>();
	for (const id of graph.vertices.keys()) {
		const ancestry = new Set<string>();
		for (let member: string | undefined = id; member !== undefined; member = parents.get(member)) {
			if (ancestry.has(member)) throw new Error('A diagram group contains itself.');
			ancestry.add(member);
		}
		paths.set(id, [...ancestry].reverse());

		const parent = parents.get(id);
		let scope = scopes.get(parent);
		if (!scope) {
			scope = { children: [], outgoing: new Map(), neighbors: new Map() };
			scopes.set(parent, scope);
		}
		scope.children.push(id);
		scope.outgoing.set(id, new Set());
		scope.neighbors.set(id, new Set());
	}

	for (const { from, to } of graph.connections) {
		const start = paths.get(from)!;
		const end = paths.get(to)!;
		let depth = 0;
		while (depth < start.length && start[depth] === end[depth]) depth++;
		const left = start[depth];
		const right = end[depth];
		if (left === undefined || right === undefined) continue;
		// A cross-group edge positions the first two siblings below their shared parent.
		const scope = scopes.get(start[depth - 1])!;
		scope.outgoing.get(left)!.add(right);
		scope.neighbors.get(left)!.add(right);
		scope.neighbors.get(right)!.add(left);
	}
	return scopes;
}

function connectedComponents(scope: Scope): string[][] {
	const remaining = new Set(scope.children);
	const components: string[][] = [];
	for (const first of scope.children) {
		if (!remaining.delete(first)) continue;
		const component = [first];
		for (const id of component) {
			for (const neighbor of scope.neighbors.get(id)!) {
				if (remaining.delete(neighbor)) component.push(neighbor);
			}
		}
		components.push(component);
	}
	return components;
}

function layersFor(component: readonly string[], outgoing: Scope['outgoing']): string[][] {
	const order: string[] = [];
	const visited = new Set<string>();
	const visit = (id: string): void => {
		if (visited.has(id)) return;
		visited.add(id);
		for (const successor of outgoing.get(id)!) visit(successor);
		order.push(id);
	};
	for (const id of component) visit(id);

	// In a cycle, an edge to an already placed rank becomes a return connection.
	const placed = new Set<string>();
	const ranks = new Map<string, number>();
	for (const id of order.reverse()) {
		placed.add(id);
		const next = (ranks.get(id) ?? 0) + 1;
		for (const successor of outgoing.get(id)!) {
			if (!placed.has(successor)) ranks.set(successor, Math.max(next, ranks.get(successor) ?? 0));
		}
	}
	const layers: string[][] = [];
	for (const id of component) (layers[ranks.get(id) ?? 0] ??= []).push(id);
	return layers;
}

function placeComponent(layers: string[][], boxes: ReadonlyMap<string, CanvasRect>, direction: CanvasDirection): Size {
	const horizontal = direction === 'LR' || direction === 'RL';
	const reverse = direction === 'RL' || direction === 'BT';
	const along = horizontal ? 'width' : 'height';
	const across = horizontal ? 'height' : 'width';
	const rows = layers.map(layer => {
		const row = layer.map(id => boxes.get(id)!);
		return {
			boxes: row,
			thickness: Math.max(...row.map(box => box[along])),
			breadth: row.reduce((sum, box) => sum + box[across], (row.length - 1) * ITEM_GAP),
		};
	});
	const length = rows.reduce((sum, row) => sum + row.thickness, (rows.length - 1) * RANK_GAP);
	const breadth = Math.max(...rows.map(row => row.breadth));
	let rankOffset = 0;
	for (const row of rows) {
		let crossOffset = Math.floor((breadth - row.breadth) / 2);
		for (const box of row.boxes) {
			const forward = rankOffset + Math.floor((row.thickness - box[along]) / 2);
			box[horizontal ? 'x' : 'y'] = reverse ? length - forward - box[along] : forward;
			box[horizontal ? 'y' : 'x'] = crossOffset;
			crossOffset += box[across] + ITEM_GAP;
		}
		rankOffset += row.thickness + RANK_GAP;
	}
	return horizontal ? { width: length, height: breadth } : { width: breadth, height: length };
}

function placeScope(scope: Scope, boxes: Map<string, CanvasRect>, direction: CanvasDirection): Size {
	const components = connectedComponents(scope).map(ids => ({
		ids, ...placeComponent(layersFor(ids, scope.outgoing), boxes, direction),
	}));
	const area = components.reduce((sum, part) => sum + (part.width + ITEM_GAP) * (part.height + ITEM_GAP), 0);
	const wrapWidth = Math.max(Math.ceil(Math.sqrt(area)), ...components.map(part => part.width));
	let x = 0, y = 0, rowHeight = 0, width = 0;
	for (const part of components) {
		if (x && x + part.width > wrapWidth) {
			y += rowHeight + ITEM_GAP;
			x = 0;
			rowHeight = 0;
		}
		for (const id of part.ids) {
			const box = boxes.get(id)!;
			box.x += x;
			box.y += y;
		}
		width = Math.max(width, x + part.width);
		x += part.width + ITEM_GAP;
		rowHeight = Math.max(rowHeight, part.height);
	}
	return { width, height: y + rowHeight };
}

export function layOutCanvas(graph: CanvasGraph): Map<string, CanvasRect> {
	const scopes = indexScopes(graph);
	const relative = new Map<string, CanvasRect>();
	const place = (parent: string | undefined, direction: CanvasDirection): Size => {
		const scope = scopes.get(parent);
		if (!scope) return { width: 0, height: 0 };
		for (const id of scope.children) {
			const vertex = graph.vertices.get(id)!;
			let size: Size;
			if (vertex.type === 'group') {
				const content = place(id, vertex.direction ?? direction);
				size = {
					width: Math.max(content.width + 2 * GROUP_SIDE, textWidth(vertex.label) + 2 * GROUP_SIDE, 224),
					height: Math.max(content.height + GROUP_TOP + GROUP_SIDE, 112),
				};
			} else size = cardSize(vertex.text);
			relative.set(id, { x: 0, y: 0, ...size });
		}
		return placeScope(scope, relative, direction);
	};
	place(undefined, graph.direction);

	const positions = new Map<string, CanvasRect>();
	const offset = (parent: string | undefined, x: number, y: number): void => {
		for (const id of scopes.get(parent)?.children ?? []) {
			const box = relative.get(id)!;
			const rect = { ...box, x: x + box.x, y: y + box.y };
			positions.set(id, rect);
			offset(id, rect.x + GROUP_SIDE, rect.y + GROUP_TOP);
		}
	};
	offset(undefined, 0, 0);
	return positions;
}
