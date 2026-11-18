import { parseCanvasGraph, type CanvasEnd } from './canvas-graph';
import { layOutCanvas, type CanvasRect } from './canvas-layout';
import { createUniqueExport, documentBasename, exportFolder, type ExportVault } from './files';

type Side = 'top' | 'right' | 'bottom' | 'left';
type CanvasNode = CanvasRect & { id: string } & (
	| { type: 'text'; text: string }
	| { type: 'file'; basename: string; markdown: string }
	| { type: 'group'; label: string }
);
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
export interface CanvasExport {
	nodes: readonly CanvasNode[];
	edges: readonly CanvasEdge[];
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

export function createCanvasExport(source: string): CanvasExport {
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
		} else if (vertex.type === 'file') {
			cards.push({ ...position, id, type: 'file', basename: documentBasename(vertex.title, key), markdown: literalMarkdown(vertex.text) + '\n' });
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
	return { nodes: [...groups, ...cards], edges };
}

type CanvasVault = Pick<ExportVault, 'adapter' | 'getAbstractFileByPath' | 'create'>;
interface SavedDocument { path: string; file: unknown }

/** Keep notes created during this dialog available for retry after a failed save. */
export function createCanvasSaver(vault: CanvasVault, basename: string, canvas: CanvasExport):
	(folder: string, current: () => boolean) => Promise<string> {
	const documents = canvas.nodes.filter(node => node.type === 'file');
	const byFolder = new Map<string, Map<string, SavedDocument>>();
	const exists = (document: SavedDocument): boolean => vault.getAbstractFileByPath(document.path) === document.file;
	return async (folder, current) => {
		const destination = exportFolder(folder);
		let saved = byFolder.get(destination);
		if (!saved) {
			saved = new Map();
			byFolder.set(destination, saved);
		}
		try {
			for (const note of documents) {
				const existing = saved.get(note.id);
				if (existing && exists(existing)) continue;
				const created = await createUniqueExport(vault, destination, note.basename, 'md', current,
					path => vault.create(path, note.markdown));
				saved.set(note.id, created);
			}
			const paths = saved;
			const nodes = canvas.nodes.map(node => {
				if (node.type !== 'file') return node;
				const { id, type, x, y, width, height } = node;
				return { id, type, x, y, width, height, file: paths.get(id)!.path };
			});
			const content = JSON.stringify({ nodes, edges: canvas.edges }, null, 2) + '\n';
			const ready = (): boolean => {
				if (!current()) return false;
				if ([...paths.values()].some(note => !exists(note))) {
					throw new Error('A generated note moved or was removed. Select Save to try again.');
				}
				return true;
			};
			const result = await createUniqueExport(vault, destination, basename, 'canvas', ready,
				path => vault.create(path, content));
			return result.path;
		} catch (error) {
			const count = [...saved.values()].filter(exists).length;
			if (count === 0) throw error;
			const reason = error instanceof Error ? error.message : String(error);
			const remaining = count === 1 ? 'note remains' : 'notes remain';
			throw new Error(reason + ' ' + count + ' generated Markdown ' + remaining + ' in ' + (destination || 'the vault root') + '.');
		}
	};
}
