import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasExport } from '../src/export/canvas';
import { MAX_CANVAS_EDGES, MAX_CANVAS_NODES } from '../src/export/canvas-graph';

interface Node {
	id: string;
	type: 'text' | 'group';
	x: number;
	y: number;
	width: number;
	height: number;
	text?: string;
	label?: string;
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

function convert(source: string): { nodes: Node[]; edges: Edge[] } {
	return JSON.parse(createCanvasExport(source)) as { nodes: Node[]; edges: Edge[] };
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
		assert.equal(createCanvasExport(source), createCanvasExport(source));
	}
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
		'global', 'Policy@{ shape: refdoc, label: "Policy" }', 'end',
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
	assert.ok(!inside(nodes.find(node => node.text?.startsWith('Policy'))!, outer));
	assert.deepEqual(edges.map(edge => [edge.label, edge.toEnd]), [
		['Request', 'arrow'], ['Reference', 'none'], ['Failure · Retry', 'arrow'], [undefined, 'arrow'],
	]);
	assert.ok(edges.some(edge => edge.fromNode === answer.id && edge.toNode === service.id));
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
	const [a, b, c] = nodes as [Node, Node, Node];
	assert.ok(b.height > a.height && b.width > a.width);
	for (const [one, other] of [[a, b], [b, c], [a, c]] as const) {
		assert.ok(one.x + one.width <= other.x || other.x + other.width <= one.x
			|| one.y + one.height <= other.y || other.y + other.height <= one.y);
	}
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
