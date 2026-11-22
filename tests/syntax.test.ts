import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supports, parse, render, PeleError } from 'pele';
import { DIAGRAM_SYNTAX } from '../src/editor/syntax/catalog';
import { flowchartComponents, agentflowComponents, swimlaneComponents } from '../src/editor/syntax/graph-components';
import { sequenceComponents, stateComponents, hierarchyComponents, workflowComponents } from '../src/editor/syntax/structured-components';
import { chartComponents } from '../src/editor/syntax/chart-components';
import { otherComponents, railroadComponents } from '../src/editor/syntax/other-components';
import { diagramDeclaration, diagramOrientation, initializeDiagram, insertComponent } from '../src/editor/syntax/source';
import { selectedDiagram } from '../src/editor/syntax/catalog';
import { insertConfiguration } from '../src/editor/syntax/configuration-insertion';
import { parseFrontmatter } from '../src/styles/frontmatter';
import { frontmatterEnd } from '../src/styles/local-codec';
import { diagramComponents } from '../src/editor/syntax/components';
import { diagramCategory } from '../src/styles/registry';
import { detectDiagramType, preparePeleSource } from '../src/rendering/pele-source';
import { MAX_DIAGRAM_SOURCE_LENGTH } from '../src/rendering/source-budget';
import { syntaxBodies } from './syntax-fixtures';

void test('diagram choices cover every pinned renderer family and use recognized declarations', () => {
	assert.equal(new Set(DIAGRAM_SYNTAX.map(choice => choice.type)).size, 33);
	assert.equal(new Set(DIAGRAM_SYNTAX.map(choice => choice.declaration)).size, DIAGRAM_SYNTAX.length);
	for (const diagram of DIAGRAM_SYNTAX) {
		assert.equal(supports(preparePeleSource(diagram.declaration).source), true, diagram.declaration);
		assert.equal(detectDiagramType(diagram.declaration), diagram.type, diagram.declaration);
	}
});

void test('every selected diagram variant renders with its generated configuration and representative body', () => {
	for (const diagram of DIAGRAM_SYNTAX) {
		const body = diagram.type === 'railroad' ? diagramComponents(diagram)[0]!.text : syntaxBodies[diagram.type];
		const source = insertConfiguration(diagram.declaration + '\n' + body, diagram).source;
		const prepared = preparePeleSource(source);
		const rendered = render(prepared.source, { images: false, limit: prepared.limit });
		assert.ok(rendered.width > 0 && rendered.height > 0, diagram.declaration);
		assert.match(rendered.svg, /<svg\b/);
		assert.equal(insertConfiguration(source, diagram).source, source, diagram.declaration);
	}
});

void test('configuration generation preserves authored values, body, comments and CRLF without duplication', () => {
	const diagram = DIAGRAM_SYNTAX.find(choice => choice.declaration === 'flowchart')!;
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
	const diagram = selectedDiagram('flowchart')!;
	assert.equal(initializeDiagram('', diagram, 'TD').source, 'flowchart TD\n');
	assert.equal(initializeDiagram('', selectedDiagram('sequenceDiagram')!).source, 'sequenceDiagram\n');
	assert.throws(() => initializeDiagram('', diagram), /orientation/);
	const prefix = '---\r\ntitle: "first\r\n---\r\nlast"\r\n---\r\n%% Comment\r\n%%{init: {\r\n "theme":"base"\r\n}}%%\r\n';
	const source = prefix + 'graph  LR; A-->B\r\n B-->C';
	const updated = initializeDiagram(source, diagram, 'TB');
	assert.equal(updated.source, prefix + 'graph  TB; A-->B\r\n B-->C');
	assert.equal(diagramDeclaration(source).diagram, diagram);
	assert.equal(diagramOrientation(source, diagramDeclaration(source)), 'LR');
	assert.equal(diagramOrientation('graph\n A-->B', diagramDeclaration('graph\n A-->B')), undefined);
	assert.equal(initializeDiagram(prefix + 'gitGraph LR :\r\n  commit', selectedDiagram('gitGraph')!, 'BT').source,
		prefix + 'gitGraph BT :\r\n  commit');
	assert.equal(initializeDiagram('gitGraph:\ncommit', selectedDiagram('gitGraph')!, 'TB').source, 'gitGraph TB:\ncommit');
	assert.equal(initializeDiagram('xychart horizontal\nx-axis [A]\nbar [1]', selectedDiagram('xychart-beta')!, 'vertical').source,
		'xychart vertical\nx-axis [A]\nbar [1]');
	assert.equal(diagramDeclaration('%% comment\n\n').text, '');
	assert.throws(() => initializeDiagram('---\ntitle: unfinished', diagram, 'TB'), /frontmatter/);
	assert.throws(() => initializeDiagram('unknown\nImportant text', diagram, 'TB'), /unrecognized/);
});

void test('body directions update the root without rewriting comments, text or nested directions', () => {
	const state = selectedDiagram('stateDiagram-v2')!;
	const body = '%% direction BT\r\nstate Outer {\r\n direction RL\r\n First --> Second\r\n}\r\n'
		+ 'note right of Outer\r\n direction TB\r\nend note\r\n Outer --> After';
	const nestedOnly = 'stateDiagram-v2\r\n' + body;
	assert.equal(diagramOrientation(nestedOnly, diagramDeclaration(nestedOnly)), undefined);
	assert.equal(initializeDiagram(nestedOnly, state, 'LR').source, 'stateDiagram-v2\r\n  direction LR\r\n' + body);

	const er = 'erDiagram\n  direction TB %% Root\nsubgraph Outer\n  direction BT\n  First ||--|| Second : pairs\nend';
	assert.equal(diagramOrientation(er, diagramDeclaration(er)), 'TB');
	assert.equal(initializeDiagram(er, selectedDiagram('erDiagram')!, 'LR').source, er.replace('TB %% Root', 'LR %% Root'));

	const classes = 'classDiagram\n  note "Quoted {\n direction TB\n}"\n  First --> Second : carries {\n  class Third; direction RL';
	assert.equal(diagramOrientation(classes, diagramDeclaration(classes)), 'RL');
	assert.equal(initializeDiagram(classes, selectedDiagram('classDiagram')!, 'TB').source, classes.replace('; direction RL', '; direction TB'));
});

void test('every offered orientation is used by the pinned renderer', () => {
	const relation = 'First --> Second';
	const requirement = (id: number, name: string) => `requirement ${name} {\n id: ${id}\n text: "${name}"\n risk: low\n verifymethod: test\n}`;
	const bodies = {
		flowchart: relation, agentflow: relation, swimlane: `subgraph One\n${relation}\nend`,
		gitGraph: 'commit id: "First"\ncommit id: "Second"', timeline: 'First : One\nSecond : Two',
		xychart: 'x-axis ["First", "Second"]\nbar [10, 10]', class: relation, state: relation,
		er: 'First ||--|| Second : connects',
		requirement: requirement(1, 'First') + '\n' + requirement(2, 'Second') + '\nFirst - traces -> Second',
		usecase: 'actor First\nSecond("Second")\nFirst --> Second',
	};
	for (const diagram of DIAGRAM_SYNTAX) {
		if (!diagram.orientation) continue;
		const body = bodies[diagram.type as keyof typeof bodies];
		assert.ok(body, diagram.declaration);
		const aspects = new Map<string, number>();
		for (const orientation of diagram.orientation.values) {
			const source = initializeDiagram('', diagram, orientation).source + body;
			const label = diagram.declaration + ' ' + orientation;
			assert.equal(diagramOrientation(source, diagramDeclaration(source)), orientation, label);
			const model = parse(source);
			const actual = 'direction' in model ? model.direction : 'orientation' in model ? model.orientation : undefined;
			const normalized = actual === 'TB' && orientation === 'TD' && diagram.type !== 'timeline' ? 'TD' : actual;
			assert.equal(normalized, orientation, label);
			const svg = render(source, { images: false });
			aspects.set(orientation, svg.width / svg.height);
			if (diagram.type === 'xychart') {
				const bars = [...svg.svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="[^"]+" height="[^"]+"\/>/g)];
				assert.equal(bars.length, 2, label);
				const vertical = orientation === 'vertical';
				assert.equal(bars[0]![1] === bars[1]![1], !vertical, label);
				assert.equal(bars[0]![2] === bars[1]![2], vertical, label);
			}
		}
		if (diagram.type === 'timeline') {
			assert.notEqual(aspects.get('LR'), aspects.get('TD'), diagram.declaration);
		} else if (diagram.type !== 'xychart') {
			for (const [orientation, aspect] of aspects) {
				const horizontal = orientation === 'LR' || orientation === 'RL';
				assert.equal(aspect > aspects.get(horizontal ? 'TB' : 'LR')!, horizontal, diagram.declaration + ' ' + orientation);
			}
		}
	}
});

void test('Agentflow declarations share selection and styles with existing beta source', () => {
	const prefix = '---\r\ntitle: agentflow example\r\n---\r\n%% agentflow mention\r\n%%{init: {"theme":"base"}}%%\r\n';
	for (const keyword of ['agentflow', 'agentflow-beta']) {
		const source = prefix + keyword + ' LR\r\n A[Start] --> B[Review]';
		const declaration = diagramDeclaration(source);
		assert.equal(declaration.text, keyword + ' LR');
		assert.equal(declaration.from, prefix.length);
		assert.equal(selectedDiagram(declaration.text)?.declaration, 'agentflow-beta');
		assert.equal(diagramOrientation(source, declaration), 'LR');
		assert.equal(initializeDiagram(source, declaration.diagram!, 'TB').source, source.replace(keyword + ' LR', keyword + ' TB'));
		assert.equal(diagramCategory(source), 'agentflow');
	}
	assert.equal(diagramCategory('agentflow-unrecognized LR\n A --> B'), null);
	assert.equal(diagramCategory('%% agentflow LR\nflowchart LR\n A["agentflow"] --> B'), 'flowchart');
});

void test('the Agentflow alias preserves the source limit and inline diagnostic position', () => {
	const source = 'agentflow LR\n A --> B\n%% ';
	const longest = source + 'x'.repeat(MAX_DIAGRAM_SOURCE_LENGTH - source.length);
	const prepared = preparePeleSource(longest);
	assert.equal(render(prepared.source, { limit: prepared.limit }).type, 'agentflow');
	const tooLong = preparePeleSource(longest + 'x');
	assert.throws(() => render(tooLong.source, { limit: tooLong.limit }), { code: 'limit' });

	const invalid = '---\r\ntitle: Example\r\n---\r\n%% comment\r\nagentflow LR; @';
	const bad = preparePeleSource(invalid);
	assert.throws(() => {
		try { render(bad.source); }
		catch (error) { throw bad.restoreError?.(error) ?? error; }
	}, error => {
		assert.ok(error instanceof PeleError);
		assert.equal(error.line, 5);
		assert.equal(error.column, 15);
		assert.match(error.snippet, /^agentflow LR; @\n-{14}\^$/);
		assert.ok(!error.message.includes('agentflow-beta'));
		return true;
	});
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
