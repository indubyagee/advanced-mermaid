import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supports, detectType, parse, render } from 'pele';
import { DIAGRAM_SYNTAX } from '../src/editor/syntax/catalog';
import { flowchartComponents, agentflowComponents, swimlaneComponents } from '../src/editor/syntax/graph-components';
import { sequenceComponents, stateComponents, hierarchyComponents, workflowComponents } from '../src/editor/syntax/structured-components';
import { chartComponents } from '../src/editor/syntax/chart-components';
import { otherComponents, railroadComponents } from '../src/editor/syntax/other-components';
import { diagramDeclaration, initializeDiagram, insertComponent } from '../src/editor/syntax/source';
import { selectedDiagram } from '../src/editor/syntax/catalog';
import { insertConfiguration } from '../src/editor/syntax/configuration-insertion';
import { parseFrontmatter } from '../src/styles/frontmatter';
import { frontmatterEnd } from '../src/styles/local-codec';
import { diagramComponents } from '../src/editor/syntax/components';
import { syntaxBodies } from './syntax-fixtures';

void test('diagram choices cover every pinned renderer family and use recognized declarations', () => {
	assert.equal(new Set(DIAGRAM_SYNTAX.map(choice => choice.type)).size, 33);
	assert.equal(new Set(DIAGRAM_SYNTAX.map(choice => choice.declaration)).size, DIAGRAM_SYNTAX.length);
	for (const diagram of DIAGRAM_SYNTAX) {
		assert.equal(supports(diagram.declaration), true, diagram.declaration);
		assert.equal(detectType(diagram.declaration), diagram.type, diagram.declaration);
	}
});

void test('every selected diagram variant renders with its generated configuration and representative body', () => {
	for (const diagram of DIAGRAM_SYNTAX) {
		const body = diagram.type === 'railroad' ? diagramComponents(diagram)[0]!.text : syntaxBodies[diagram.type];
		const source = insertConfiguration(diagram.declaration + '\n' + body, diagram).source;
		const rendered = render(source, { images: false });
		assert.ok(rendered.width > 0 && rendered.height > 0, diagram.declaration);
		assert.match(rendered.svg, /<svg\b/);
		assert.equal(insertConfiguration(source, diagram).source, source, diagram.declaration);
	}
});

void test('configuration generation preserves authored values, body, comments and CRLF without duplication', () => {
	const diagram = DIAGRAM_SYNTAX.find(choice => choice.declaration === 'flowchart TB')!;
	const body = '%% Keep this comment\r\nflowchart TB\r\n A-->B';
	const source = '---\r\n# Header comment\r\ntitle: Authored\r\nconfig:\r\n  # Family comment\r\n  flowchart:\r\n    rankSpacing: 77 # Keep this value\r\n    useMaxWidth: false\r\n  sequence:\r\n    actorMargin: 0\r\n---\r\n' + body;
	const inserted = insertConfiguration(source, diagram);
	const metadata = parseFrontmatter(inserted.source.slice(0, frontmatterEnd(inserted.source, true)));
	assert.equal(metadata.title, 'Authored');
	assert.equal((metadata.config as { flowchart: { rankSpacing: number; useMaxWidth: boolean; nodeSpacing: number } }).flowchart.rankSpacing, 77);
	assert.equal((metadata.config as { flowchart: { useMaxWidth: boolean } }).flowchart.useMaxWidth, false);
	assert.equal((metadata.config as { flowchart: { nodeSpacing: number } }).flowchart.nodeSpacing, 50);
	for (const comment of ['# Header comment', '# Family comment', '# Keep this value']) assert.ok(inserted.source.includes(comment));
	assert.ok(inserted.source.endsWith(body)); assert.ok(!/(?<!\r)\n/.test(inserted.source));
	assert.equal(insertConfiguration(inserted.source, diagram).source, inserted.source);
	assert.equal((inserted.source.match(/^config:/gm) ?? []).length, 1);
	assert.equal((inserted.source.match(/^---/gm) ?? []).length, 2);
});

void test('configuration safely extends flow-style YAML, preserves explicit nulls, and rejects invalid documents', () => {
	const diagram = DIAGRAM_SYNTAX.find(choice => choice.type === 'sequence')!;
	for (const yaml of ['config: {sequence: {actorMargin: 0}, extra: [1, 2]}', 'config: {sequence: null}', 'config: null', '{"title":"Title","config":{"sequence":{"actorMargin":0}}}']) {
		const source = '---\n' + yaml + '\n---\nsequenceDiagram\n A->>B: Message';
		const inserted = insertConfiguration(source, diagram);
		const metadata = parseFrontmatter(inserted.source.slice(0, frontmatterEnd(inserted.source, true)));
		const previous = parseFrontmatter(yaml);
		if (previous.config === null) assert.equal(metadata.config, null);
		else if ((previous.config as { sequence: unknown }).sequence === null) assert.equal((metadata.config as { sequence: unknown }).sequence, null);
		else assert.equal((metadata.config as { sequence: { actorMargin: number } }).sequence.actorMargin, 0);
		assert.equal(insertConfiguration(inserted.source, diagram).source, inserted.source);
	}
	for (const yaml of ['config: [', 'config: []', 'config: {__proto__: {polluted: true}}', 'config: &a {self: *a}']) {
		assert.throws(() => insertConfiguration('---\n' + yaml + '\n---\nsequenceDiagram', diagram));
	}
	assert.throws(() => insertConfiguration('---\nconfig: {sequence: {actorMargin: 0}} # Keep\n---\nsequenceDiagram', diagram), /keeping existing comments/);
	assert.throws(() => insertConfiguration("---\ntitle: Earth's map\nconfig: {} # Keep\n---\nsequenceDiagram", diagram), /keeping existing comments/);
});

void test('diagram selection initializes empty sources and preserves YAML, directives and inline body text', () => {
	const diagram = DIAGRAM_SYNTAX.find(choice => choice.declaration === 'flowchart TB')!;
	assert.equal(initializeDiagram('', diagram).source, 'flowchart TB\n');
	const prefix = '---\r\ntitle: "first\r\n---\r\nlast"\r\n---\r\n%% Comment\r\n%%{init: {\r\n "theme":"base"\r\n}}%%\r\n';
	const source = prefix + 'graph LR; A-->B\r\n B-->C';
	const updated = initializeDiagram(source, diagram);
	assert.equal(updated.source, prefix + 'flowchart TB; A-->B\r\n B-->C');
	assert.equal(selectedDiagram(diagramDeclaration(source).text)?.declaration, 'flowchart LR');
	assert.equal(diagramDeclaration('%% comment\n\n').text, '');
	assert.throws(() => initializeDiagram('---\ntitle: unfinished', diagram), /frontmatter/);
	assert.throws(() => initializeDiagram('unknown\nImportant text', diagram), /unrecognized/);
});

void test('component insertion follows selections, line endings, indentation and source bounds', () => {
	const source = 'flowchart TB\r\n  A[Old]\r\n  B[Kept]';
	const from = source.indexOf('A['); const to = from + 'A[Old]'.length;
	assert.equal(insertComponent(source, from, to, 'A["node"]').source, source.replace('A[Old]', 'A["node"]'));
	const end = insertComponent('flowchart TB', 12, 12, 'A["node"]');
	assert.equal(end.source, 'flowchart TB\nA["node"]'); assert.equal(end.from, end.source.length);
	const middle = insertComponent(source, from + 2, from + 2, 'C[New]');
	assert.ok(middle.source.includes('A[\r\nC[New]\r\nOld]'));
	assert.throws(() => insertComponent(source, 0, 0, 'A'), /diagram body/);
	assert.throws(() => insertComponent('flowchart TB\n' + 'A'.repeat(49_987), 50_000, 50_000, 'B'), /50,000/);
});

void test('diagram-specific component snippets parse in their required structural context', () => {
	const groups = { sequence: sequenceComponents, state: stateComponents, ...hierarchyComponents, ...workflowComponents, ...chartComponents, ...otherComponents };
	const failures: string[] = [];
	for (const [type, components] of Object.entries(groups)) {
		const diagram = DIAGRAM_SYNTAX.find(choice => choice.type === type)!;
		for (const component of components) {
			let prefix = '';
			if (type === 'mindmap' && component.text.startsWith(' ')) prefix = 'root((Root))\n';
			if (type === 'kanban' && component.text.startsWith(' ')) prefix = 'column[Column]\n';
			if (type === 'treeView' && component.text.startsWith(' ')) prefix = 'root/\n';
			if (type === 'ishikawa' && component.text.startsWith(' ')) prefix = 'Problem\n';
			if (type === 'gantt' && component.text.includes('after task1')) prefix = 'First :task1, 2026-01-01, 1d\n';
			if (type === 'radar' && component.text.startsWith('curve')) prefix = 'axis A, B, C\n';
			try { parse(diagram.declaration + '\n' + prefix + component.text); }
			catch (error) { failures.push(diagram.label + ': ' + component.label + ': ' + String(error)); }
		}
	}
	assert.deepEqual(failures, []);
});

void test('railroad components use the selected grammar notation', () => {
	for (const [declaration, components] of Object.entries(railroadComponents)) {
		for (const component of components) assert.doesNotThrow(() => parse(declaration + '\n' + component.text), declaration + ': ' + component.label);
	}
});

void test('classic, expanded and workflow snippets parse with the pinned renderer', () => {
	for (const [declaration, components] of [['flowchart TB', flowchartComponents], ['agentflow-beta TB', agentflowComponents], ['swimlane-beta LR', swimlaneComponents]] as const) {
		for (const component of components) assert.doesNotThrow(() => parse(declaration + '\n' + component.text), declaration + ': ' + component.label);
	}
});
