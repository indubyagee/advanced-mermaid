import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasExport, createCanvasSaver } from '../src/export/canvas';
import { MAX_CANVAS_EDGES, MAX_CANVAS_NODES } from '../src/export/canvas-graph';

interface Node {
	id: string;
	type: 'text' | 'file' | 'group';
	x: number;
	y: number;
	width: number;
	height: number;
	text?: string;
	label?: string;
	basename?: string;
	markdown?: string;
	file?: string;
}
interface Edge {
	id: string;
	fromNode: string;
	toNode: string;
	fromEnd: string;
	toEnd: string;
	fromSide: string;
	toSide: string;
	label?: string;
}

function convert(source: string): { nodes: readonly Node[]; edges: readonly Edge[] } {
	return createCanvasExport(source);
}

function inside(child: Node, group: Node): boolean {
	return child.x >= group.x && child.y >= group.y
		&& child.x + child.width <= group.x + group.width && child.y + child.height <= group.y + group.height;
}

void test('Canvas export uses the parsed family and direction, with stable positive integer geometry', () => {
	for (const [header, axis, sign] of [
		['flowchart TD', 'y', 1], ['graph LR', 'x', 1], ['flowchart-elk BT', 'y', -1], ['flowchart RL', 'x', -1],
	] as const) {
		const source = '---\ntitle: Test\n---\n%% advanced-mermaid: align=left\n' + header + '\n A["Start Ω"] --> B';
		const { nodes, edges } = convert(source);
		assert.deepEqual(nodes.map(node => node.text), ['Start Ω', 'B']);
		assert.equal(Math.sign(nodes[1]![axis] - nodes[0]![axis]), sign);
		assert.ok(nodes.every(node => [node.x, node.y, node.width, node.height].every(Number.isInteger) && node.width > 0 && node.height > 0));
		assert.equal(edges[0]?.fromNode, nodes[0]?.id);
		assert.equal(edges[0]?.toNode, nodes[1]?.id);
		assert.equal(edges[0]?.toEnd, 'arrow');
		assert.deepEqual(createCanvasExport(source), createCanvasExport(source));
	}
});

void test('Canvas export accepts either Agentflow declaration with the same configured graph', () => {
	const prefix = '---\ntitle: Agentflow export\n---\n%% Before the declaration\n';
	const body = ' LR\n  A@{shape: input, label: "Intake"} --> B[Review]';
	assert.deepEqual(convert(prefix + 'agentflow' + body), convert(prefix + 'agentflow-beta' + body));
});

void test('groups contain their members, and complex links retain their endpoints and individual IDs', () => {
	const { nodes, edges } = convert([
		'flowchart TB',
		'subgraph outer [Outer]',
		'  subgraph inner [Inner]',
		'    direction RL',
		'    A[Alpha] -->|Next| B[Beta]',
		'    A -->|Alternate| B',
		'    B -->|Loop| B',
		'  end',
		'  Q[Unconnected]',
		'end',
		'inner --> C[Gamma]',
		'C <--> D[Delta]',
		'C --- D',
		'C --x D',
		'C ~~~ Z[Hidden link]',
	].join('\n'));
	const [outer, inner] = nodes;
	assert.deepEqual(nodes.filter(node => node.type === 'group').map(node => node.label), ['Outer', 'Inner']);
	const a = nodes.find(node => node.text === 'Alpha')!;
	const b = nodes.find(node => node.text === 'Beta')!;
	const c = nodes.find(node => node.text === 'Gamma')!;
	const d = nodes.find(node => node.text === 'Delta')!;
	const z = nodes.find(node => node.text === 'Hidden link')!;
	assert.ok(inside(inner!, outer!) && inside(a, inner!) && inside(b, inner!) && a.x > b.x);
	assert.ok(inside(nodes.find(node => node.text === 'Unconnected')!, outer!));
	assert.ok(c.y >= outer!.y + outer!.height && z.y > c.y);
	assert.equal(edges.length, 7);
	assert.equal(new Set([...nodes, ...edges].map(item => item.id)).size, nodes.length + edges.length);
	const parallels = edges.filter(edge => edge.fromNode === a.id && edge.toNode === b.id);
	assert.deepEqual(parallels.map(edge => edge.label), ['Next', 'Alternate']);
	assert.notDeepEqual([parallels[0]!.fromSide, parallels[0]!.toSide], [parallels[1]!.fromSide, parallels[1]!.toSide]);
	const loop = edges.find(edge => edge.label === 'Loop')!;
	assert.equal(loop.fromNode, b.id);
	assert.equal(loop.toNode, b.id);
	assert.notEqual(loop.fromSide, loop.toSide);
	assert.ok(edges.some(edge => edge.fromNode === inner!.id && edge.toNode === c.id));
	assert.deepEqual(edges.filter(edge => edge.fromNode === c.id && edge.toNode === d.id).map(edge => [edge.fromEnd, edge.toEnd]),
		[['arrow', 'arrow'], ['none', 'none'], ['none', 'none']]);
	assert.ok(edges.every(edge => edge.toNode !== z.id && edge.fromNode !== z.id));
});

void test('Agentflow cards retain readable roles and selected metadata alongside actual workflow edges', () => {
	const { nodes, edges } = convert([
		'agentflow-beta LR', 'connector service["Service"]', 'service@{ endpoint: "https://example.test" }',
		'global', 'Policy@{ shape: refdoc, label: "Policy", description: "Approved rules" }', 'end',
		'flow outer [Outer]', 'flow work [Work]',
		'Prompt@{ shape: input, label: "Question" }',
		'Answer@{ shape: tool, label: "Call", description: "Work", model: "Local", instruction: "Inspect data", connectorRef: "service.lookup" }',
		'Prompt -->|Request| Answer', 'Policy -.- Answer', 'Answer --x|Retry| Fail', 'Answer --> service',
		'end', 'end',
	].join('\n'));
	const answer = nodes.find(node => node.text?.startsWith('Call'))!;
	const service = nodes.find(node => node.text?.startsWith('Service'))!;
	assert.equal(nodes.filter(node => node.text?.startsWith('Service')).length, 1);
	assert.match(service.text!, /Connector/);
	assert.doesNotMatch(service.text!, /example/);
	assert.match(answer.text!, /Tool[\s\S]*Description[\s\S]*Work[\s\S]*Model[\s\S]*Local[\s\S]*Instruction[\s\S]*Inspect data/);
	assert.ok(answer.text!.includes('service\\.lookup'));
	const outer = nodes.find(node => node.label === 'Outer')!;
	const work = nodes.find(node => node.label === 'Work')!;
	assert.ok(inside(work, outer) && inside(answer, work));
	const policy = nodes.find(node => node.basename === 'Policy')!;
	assert.equal(policy.type, 'file');
	assert.match(policy.markdown!, /^Policy[\s\S]*Reference document[\s\S]*Approved rules/);
	assert.ok(!inside(policy, outer));
	assert.deepEqual(edges.map(edge => [edge.label, edge.toEnd]), [
		['Request', 'arrow'], ['Reference', 'none'], ['Failure · Retry', 'arrow'], [undefined, 'arrow'],
	]);
	assert.ok(edges.some(edge => edge.fromNode === answer.id && edge.toNode === service.id));
	assert.ok(edges.some(edge => edge.fromNode === policy.id && edge.toNode === answer.id && edge.label === 'Reference'));
});

void test('Flowchart document shapes and aliases create one note per node using a safe label-based name', () => {
	const shapes = ['doc', 'document', 'lin-doc', 'lined-document', 'docs', 'documents', 'st-doc', 'stacked-document', 'tag-doc', 'tagged-document'];
	const declarations = shapes.map((shape, index) => 'N' + index + '@{ shape: ' + shape + ', label: "Note ' + index + '" }');
	const { nodes } = convert([
		'flowchart LR',
		...declarations,
		'Safe@{ shape: doc, label: "CON.md" }',
		'Path@{ shape: tag-doc, label: "Plans/Notes.md<br/>More detail" }',
		'Text["docs"]',
	].join('\n'));
	const notes = nodes.filter(node => node.type === 'file');
	assert.deepEqual(notes.map(note => note.basename), [...shapes.map((_, index) => 'Note ' + index), 'Safe', 'Plans-Notes']);
	assert.equal(notes.at(-1)?.markdown, 'Plans\\/Notes\\.md  \nMore detail\n');
	assert.deepEqual(nodes.filter(node => node.type === 'text').map(node => node.text), ['docs']);
});

void test('Canvas cards retain literal labels, line breaks and Unicode while escaping Markdown constructs', () => {
	const { nodes } = convert('flowchart TD\nA["![[Private]] [link](https://example.test) <i>tag</i> &amp; #9829;<br/>Ω"]');
	const content = nodes[0]!.text!;
	assert.ok(content.includes('\\!\\[\\[Private\\]\\]'));
	assert.ok(content.includes('\\[link\\]\\(https\\:\\/\\/example\\.test\\)'));
	assert.ok(content.includes('\\<i\\>tag\\<\\/i\\> \\& ♥  \nΩ'));
});

void test('disconnected nodes are packed separately and long labels receive taller cards', () => {
	const { nodes } = convert('flowchart TD\nA[Short]\nB["' + 'wide text '.repeat(30) + '"]\nC[Another]');
	const [a, b, c] = nodes as readonly [Node, Node, Node];
	assert.ok(b.height > a.height && b.width > a.width);
	for (const [one, other] of [[a, b], [b, c], [a, c]] as const) {
		assert.ok(one.x + one.width <= other.x || other.x + other.width <= one.x
			|| one.y + one.height <= other.y || other.y + other.height <= one.y);
	}
});

void test('saving document cards creates unique files before the canvas and keeps their connections', async () => {
	const canvas = createCanvasExport('flowchart LR\nA@{ shape: docs, label: "Policy" } --> B@{ shape: tag-doc, label: "Policy" }');
	const folder = 'Notes/Exports';
	const files = new Map([[folder + '/Policy.md', { content: 'Existing note' }]]);
	const writes: string[] = [];
	const save = createCanvasSaver({
		getAbstractFileByPath: path => files.get(path),
		create: (path, content) => {
			const file = { content };
			files.set(path, file);
			writes.push(path);
			return Promise.resolve(file);
		},
	}, 'diagram', canvas);
	const path = await save(folder, () => true);
	assert.deepEqual(writes, [folder + '/Policy-2.md', folder + '/Policy-3.md', folder + '/diagram.canvas']);
	assert.equal(files.get(folder + '/Policy.md')?.content, 'Existing note');
	assert.equal(files.get(folder + '/Policy-2.md')?.content, 'Policy\n');
	const data = JSON.parse(files.get(path)!.content) as { nodes: Node[]; edges: Edge[] };
	assert.deepEqual(data.nodes.map(node => [node.type, node.file]), [
		['file', folder + '/Policy-2.md'], ['file', folder + '/Policy-3.md'],
	]);
	assert.ok(data.nodes.every(node => !('basename' in node) && !('markdown' in node) && !('text' in node)));
	assert.equal(data.edges[0]?.fromNode, data.nodes[0]?.id);
	assert.equal(data.edges[0]?.toNode, data.nodes[1]?.id);
});

void test('a stale conversion or failed canvas write keeps completed notes available for a retry', async () => {
	const canvas = createCanvasExport('flowchart LR\nA@{ shape: doc, label: "First" } --> B@{ shape: doc, label: "Second" }');
	const files = new Map<string, { content: string }>();
	let canvasBlocked = true;
	const save = createCanvasSaver({
		getAbstractFileByPath: path => files.get(path),
		create: (path, content) => {
			if (path.endsWith('.canvas') && canvasBlocked) return Promise.reject(new Error('Write failed.'));
			const file = { content };
			files.set(path, file);
			return Promise.resolve(file);
		},
	}, 'diagram', canvas);
	await assert.rejects(save('', () => files.size === 0), /diagram changed.*1 generated Markdown note remains/);
	assert.deepEqual([...files.keys()], ['First.md']);
	await assert.rejects(save('', () => true), /Write failed.*2 generated Markdown notes remain/);
	assert.deepEqual([...files.keys()], ['First.md', 'Second.md']);
	files.get('First.md')!.content = 'User edit';
	canvasBlocked = false;
	assert.equal(await save('', () => true), 'diagram.canvas');
	assert.deepEqual([...files.keys()], ['First.md', 'Second.md', 'diagram.canvas']);
	assert.equal(files.get('First.md')?.content, 'User edit');
});

void test('simultaneous exports reserve names and skip case-insensitive disk collisions', async () => {
	const files = new Map([['policy-2.md', { path: 'Policy-2.md', content: 'Existing note' }]]);
	const vault = {
		adapter: { exists: (path: string) => Promise.resolve(files.has(path.toLowerCase())) },
		getAbstractFileByPath: (path: string) => {
			const file = files.get(path.toLowerCase());
			return file?.path === path ? file : null;
		},
		create: async (path: string, content: string) => {
			await Promise.resolve(); // Models a host that may accept racing creates at the same path.
			const file = { path, content };
			files.set(path.toLowerCase(), file);
			return file;
		},
	};
	const first = createCanvasSaver(vault, 'diagram', createCanvasExport('flowchart LR\nA@{ shape: doc, label: "Policy" }'));
	const second = createCanvasSaver(vault, 'diagram', createCanvasExport('flowchart LR\nA@{ shape: doc, label: "policy" }'));
	const paths = await Promise.all([first('', () => true), second('', () => true)]);
	assert.deepEqual(new Set(paths), new Set(['diagram.canvas', 'diagram-2.canvas']));
	assert.equal(files.get('policy.md')?.content, 'Policy\n');
	assert.equal(files.get('policy-2.md')?.content, 'Existing note');
	assert.equal(files.get('policy-3.md')?.content, 'policy\n');
	const data = paths.map(path => JSON.parse(files.get(path)!.content) as { nodes: Node[] });
	assert.deepEqual(data.map(canvas => canvas.nodes[0]?.file), ['Policy.md', 'policy-3.md']);
});

void test('a single canvas can create more than one hundred notes with the same label', async () => {
	const source = ['flowchart LR', ...Array.from({ length: 101 }, (_, index) =>
		'N' + index + '@{ shape: doc, label: "Document" }')].join('\n');
	const files = new Map<string, { content: string }>();
	const save = createCanvasSaver({
		getAbstractFileByPath: path => files.get(path),
		create: (path, content) => {
			const file = { content };
			files.set(path, file);
			return Promise.resolve(file);
		},
	}, 'diagram', createCanvasExport(source));
	await save('', () => true);
	assert.equal(files.size, 102);
	assert.equal(files.get('Document-101.md')?.content, 'Document\n');
});

void test('Canvas export reports empty or unsupported diagrams and enforces node and connection budgets', () => {
	assert.throws(() => convert('flowchart TD'), /Add a node or group/);
	assert.throws(() => convert('sequenceDiagram\nA->>B: Hello'), /Choose a Flowchart or Agentflow/);
	assert.throws(() => convert('flowchart LR\nA["missing end'), /parse|lexical/i);
	const nodes = Array.from({ length: MAX_CANVAS_NODES }, (_, index) => 'N' + index);
	assert.equal(convert('flowchart TB\n' + nodes.join('\n')).nodes.length, MAX_CANVAS_NODES);
	assert.throws(() => convert('flowchart TB\n' + nodes.join('\n') + '\nExtra'), /up to 300 nodes/);
	const edges = 'A --> B\n'.repeat(MAX_CANVAS_EDGES);
	assert.equal(convert('flowchart LR\n' + edges).edges.length, MAX_CANVAS_EDGES);
	assert.throws(() => convert('flowchart LR\n' + edges + 'B --> C'), /1,?000 connections/);
});
