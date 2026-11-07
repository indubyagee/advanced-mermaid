import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PeleError, render } from 'pele';
import { normalizeSettings } from '../src/settings';
import { DIAGRAM_CATEGORIES, DIAGRAM_REGISTRY, emptyStyleProfile } from '../src/styles/registry';
import { normalizeFrontmatter, originalSourceError, parseFrontmatter, resolveFrontmatter } from '../src/styles/frontmatter';

const profiles = (yaml: string, enabled = true) => ({ flowchart: { useGlobal: true, overrides: emptyStyleProfile(), frontmatter: { enabled, yaml } } });
const metadata = (source: string) => parseFrontmatter(source.slice(0, source.indexOf('\n---\n') + 5));

void test('frontmatter settings persist independently of style inheritance and remain isolated', () => {
	for (const category of DIAGRAM_CATEGORIES) {
		const yaml = `title: ${category}\nconfig:\n  theme: base`;
		const data = { style: { diagrams: { [category]: { useGlobal: true, frontmatter: { enabled: true, yaml } } } } };
		const before = JSON.stringify(data);
		const settings = normalizeSettings(data);
		assert.deepEqual(settings.style.diagrams[category]?.frontmatter, { enabled: true, yaml });
		assert.deepEqual(normalizeSettings(settings), settings);
		assert.equal(JSON.stringify(data), before);
		settings.style.diagrams[category].frontmatter.yaml = '';
		assert.equal(normalizeSettings(data).style.diagrams[category]?.frontmatter?.yaml, yaml);
	}
	assert.deepEqual(normalizeFrontmatter({ enabled: 'true', yaml: 'config: {}' }), { enabled: false, yaml: 'config: {}' });
	for (const invalid of [null, [], { enabled: true }, { enabled: true, yaml: ' '.repeat(50_001) }]) assert.deepEqual(normalizeFrontmatter(invalid), { enabled: false, yaml: '' });
});

void test('each family and declaration alias receives only its enabled frontmatter', () => {
	for (const category of DIAGRAM_CATEGORIES) for (const declaration of DIAGRAM_REGISTRY[category].declarations) {
		const yaml = `title: ${category}\nconfig: { theme: base }`;
		const diagrams = { [category]: { useGlobal: true, overrides: emptyStyleProfile(), frontmatter: { enabled: true, yaml } } };
		assert.equal(metadata(resolveFrontmatter(declaration, diagrams).source).title, category, declaration);
		diagrams[category]!.frontmatter.enabled = false;
		assert.deepEqual(resolveFrontmatter(declaration, diagrams), { source: declaration, lineOffset: 0 });
	}
	for (const source of ['pie\n "A": 1', 'sequenceDiagram\n A->>B: Hello', 'flowchart LR\n A-->B']) {
		assert.deepEqual(resolveFrontmatter(source, profiles('title: Default', false)), { source, lineOffset: 0 });
	}
	assert.equal(resolveFrontmatter('sequenceDiagram', profiles('title: Flow only')).source, 'sequenceDiagram');
});

void test('source frontmatter overrides individual defaults without losing nested siblings or changing the source', () => {
	const yaml = 'title: Default\nconfig:\n  flowchart:\n    nodeSpacing: 75\n    rankSpacing: 90\n    subGraphTitleMargin: { top: 4, bottom: 8 }\n  list: [1, 2]\n  enabled: true';
	const source = '---\r\ntitle: Local\r\nconfig:\r\n  flowchart:\r\n    nodeSpacing: 0\r\n    subGraphTitleMargin: { top: 0 }\r\n  list: []\r\n  enabled: false\r\n---\r\n%% advanced-mermaid: align=left\r\nflowchart LR\r\n A-->B\r\n';
	const diagrams = profiles(yaml); const before = JSON.stringify(diagrams);
	const configured = resolveFrontmatter(source, diagrams);
	assert.deepEqual(metadata(configured.source), { title: 'Local', config: { flowchart: { nodeSpacing: 0, rankSpacing: 90, subGraphTitleMargin: { top: 0, bottom: 8 } }, list: [], enabled: false } });
	assert.ok(configured.source.endsWith('%% advanced-mermaid: align=left\r\nflowchart LR\r\n A-->B\r\n'));
	assert.equal(JSON.stringify(diagrams), before);
	assert.ok(source.startsWith('---\r\ntitle: Local'));
	const cleared = metadata(resolveFrontmatter('---\nconfig: {flowchart: null}\n---\nflowchart LR', diagrams).source);
	assert.deepEqual(cleared.config, { flowchart: null, list: [1, 2], enabled: true });
});

void test('custom frontmatter changes real renderer layout and source YAML or init directives take precedence', () => {
	const source = 'flowchart LR\n A-->B';
	const yaml = 'title: Default\nconfig:\n  flowchart:\n    nodeSpacing: 75\n    rankSpacing: 160';
	const diagrams = profiles(yaml);
	const configured = resolveFrontmatter(source, diagrams);
	const actual = render(configured.source, { images: false });
	assert.ok(actual.width > render(source, { images: false }).width + 50);
	assert.match(actual.svg, /Default/);
	for (const prefix of ['---\nconfig: {flowchart: {rankSpacing: 20}}\n---\n', '%%{init: {"flowchart":{"rankSpacing":20}}}%%\n']) {
		const local = render(resolveFrontmatter(prefix + source, diagrams).source, { images: false });
		const expected = render('---\ntitle: Default\nconfig: {flowchart: {nodeSpacing: 75, rankSpacing: 20}}\n---\n' + source, { images: false });
		assert.equal(local.width, expected.width); assert.equal(local.height, expected.height);
	}
});

void test('source Gantt displayMode overrides the top-level frontmatter alias', () => {
	const source = '---\nconfig: {gantt: {displayMode: ""}}\n---\ngantt\n dateFormat YYYY-MM-DD\n section Work\n First: a, 2026-01-01, 2d\n Second: b, 2026-01-04, 2d';
	const diagrams = { gantt: { useGlobal: true, overrides: emptyStyleProfile(), frontmatter: { enabled: true, yaml: 'displayMode: compact' } } };
	const configured = render(resolveFrontmatter(source, diagrams).source, { images: false });
	const expected = render(source, { images: false });
	assert.equal(configured.height, expected.height);
});

void test('frontmatter accepts optional delimiters and rejects malformed, unsafe or unbounded data', () => {
	const expected = { title: 'Test', config: { flowchart: { rankSpacing: 80 } } };
	for (const text of ['title: Test\nconfig: { flowchart: { rankSpacing: 80 } }', '---\ntitle: Test\nconfig: { flowchart: { rankSpacing: 80 } }\n---']) assert.deepEqual(parseFrontmatter(text), expected);
	for (const text of ['[]', 'plain text', 'config: []', 'config: [', '---\ntitle: Test\n---\nflowchart LR', 'config: &a { self: *a }', 'config: { __proto__: { polluted: true } }', 'config: { constructor: {} }', 'config: { prototype: {} }', 'config: { value: .inf }', ' '.repeat(50_001)]) assert.throws(() => parseFrontmatter(text), text.slice(0, 60));
	assert.throws(() => parseFrontmatter('config: ' + '['.repeat(40) + '1' + ']'.repeat(40)), /deeply nested/);
	assert.throws(() => resolveFrontmatter('flowchart LR', profiles('config: [')), /Custom frontmatter for Flowchart/);
});

void test('rendering diagnostics point to original body lines with or without authored frontmatter', () => {
	for (const prefix of ['', '---\r\ntitle: Local\r\nconfig:\r\n  flowchart:\r\n    nodeSpacing: 80\r\n---\r\n']) {
		const source = prefix + 'flowchart LR\n A[unclosed';
		const configured = resolveFrontmatter(source, profiles('config: {flowchart: {rankSpacing: 90}}'));
		assert.throws(() => render(configured.source), error => {
			const mapped = originalSourceError(error, configured.lineOffset);
			assert.ok(mapped instanceof PeleError); assert.equal(mapped.line, source.split('\n').length);
			assert.equal(mapped.column, (error as PeleError).column); assert.match(mapped.snippet, /unclosed/);
			return true;
		});
	}
});
