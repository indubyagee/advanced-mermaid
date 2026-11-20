import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse, type DiagramType } from 'pele';
import { categoryPalette, insertCategoryPalette, insertPresetClass, supportsPresetAlias } from '../src/editor/syntax/style-insertion';
import { diagramDeclaration } from '../src/editor/syntax/source';
import { parseFrontmatter } from '../src/styles/frontmatter';
import { defaultPresets, PRESET_CATEGORIES } from '../src/styles/presets';

void test('preset snippets select their editable target and parse in every supported family', () => {
	const fixtures = {
		flowchart: ['flowchart TB\nNODE_ID[Review]\n  ', 'class NODE_ID Review', 'NODE_ID'],
		state: ['stateDiagram-v2\n[*] --> NODE_ID\n  ', 'class NODE_ID Review', 'NODE_ID'],
		agentflow: ['agentflow-beta TB\n  ', 'NODE_ID["Task"]:::Review', 'NODE_ID'],
		mindmap: ['mindmap\r\n  Root((Root))\r\n    ', 'branch[Branch]\r\n      :::Review', 'Branch'],
		treeView: ['treeView-beta\nroot/\n  ', 'file.txt :::Review', 'file.txt'],
		treemap: ['treemap-beta\n"Group"\n  ', '"Item": 10:::Review', 'Item'],
	} as const;
	for (const type of PRESET_CATEGORIES) {
		const [source, snippet, placeholder] = fixtures[type];
		const result = insertPresetClass(source, type, source.length, source.length, 'Review');
		assert.equal(result.source, source + snippet, type);
		assert.equal(result.source.slice(result.from, result.to), placeholder, type);
		assert.doesNotThrow(() => parse(result.source), type);
	}
	assert.throws(() => insertPresetClass('pie\n', 'pie', 4, 4, 'Review'), /saved preset class/);
	assert.throws(() => insertPresetClass('flowchart LR\n', 'flowchart', 13, 13, 'injected alias'), /saved preset class/);
	assert.equal(supportsPresetAlias('flowchart', 'node-group'), true);
	assert.equal(supportsPresetAlias('flowchart', 'end'), false);
	assert.equal(supportsPresetAlias('treemap', 'node-group'), false);
});

function themeVariables(source: string): unknown {
	const prefix = source.slice(0, diagramDeclaration(source).from);
	return (parseFrontmatter(prefix).config as { themeVariables?: unknown }).themeVariables;
}

void test('category fills populate all eight Pele palette mappings in slot order', () => {
	const presets = defaultPresets();
	const colors = categoryPalette(presets)!;
	const cases: readonly (readonly [DiagramType, string, string, number])[] = [
		['gitGraph', 'gitGraph LR:\ncommit', 'git', 0],
		['mindmap', 'mindmap\n Root\n  Branch', 'cScale', 1],
		['timeline', 'timeline\n 2026 : Event', 'cScale', 0],
		['radar', 'radar-beta\n axis A, B, C\n curve Series{1,2,3}', 'cScale', 0],
		['treemap', 'treemap\n"Group"\n  "Leaf": 10', 'cScale', 0],
		['pie', 'pie\n "Slice": 10', 'pie', 1],
		['xychart', 'xychart\n x-axis [A, B]\n bar [1, 2]', '', 0],
		['venn', 'venn-beta\nset A["Set"]: 10', 'venn', 1],
	];
	assert.equal(colors.length, 8);
	for (const [type, body, prefix, start] of cases) {
		const result = insertCategoryPalette(body, type, presets);
		const expected = prefix ? Object.fromEntries(colors.map((color, index) => [prefix + (start + index), color]))
			: { xyChart: { plotColorPalette: colors.join(', ') } };
		assert.deepEqual(themeVariables(result.source), expected, type);
		assert.ok(result.source.endsWith(body), type);
		assert.equal(insertCategoryPalette(result.source, type, presets).source, result.source, type);
	}
});

void test('palette insertion keeps authored scalars and comments and requires valid category colors', () => {
	const presets = defaultPresets();
	const source = '---\r\n# Keep title\r\ntitle: Sample\r\nconfig:\r\n  themeVariables:\r\n    pie1: "#112233" # Keep color\r\n  pie:\r\n    textPosition: 0\r\n---\r\npie\r\n "A": 10';
	const inserted = insertCategoryPalette(source, 'pie', presets).source;
	assert.match(inserted, /pie1: "#112233" # Keep color/);
	assert.match(inserted, /# Keep title\r\ntitle: Sample/);
	assert.match(inserted, /pie:\r\n {4}textPosition: 0/);
	assert.doesNotMatch(inserted, /(?<!\r)\n/);
	assert.equal((themeVariables(inserted) as { pie1: string }).pie1, '#112233');
	const xy = '---\nconfig:\n  themeVariables:\n    xyChart:\n      plotColorPalette: "#112233, #334455"\n---\nxychart\n bar [1]';
	assert.equal(insertCategoryPalette(xy, 'xychart', presets).source, xy);
	assert.equal(categoryPalette(presets.filter(preset => preset.alias !== 'CATEGORY8')), undefined);
	assert.equal(categoryPalette([{ alias: 'CATEGORY1', fill: 'not a color' }, ...presets.filter(p => p.alias !== 'CATEGORY1')]), undefined);
	assert.throws(() => insertCategoryPalette('pie\n', 'pie', []), /category preset/);
	assert.throws(() => insertCategoryPalette('---\nconfig: []\n---\npie\n', 'pie', presets));
});
