import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectType, supports } from 'pele';
import { DIAGRAM_CATEGORIES, DIAGRAM_REGISTRY, diagramCategory, emptyStyleProfile } from '../src/styles/registry';
import { validateStyleProfile, validStyleColor, validStyleFont } from '../src/styles/validate';
import { resolveDiagramStyle, resolveStyleProfile } from '../src/styles/resolve';

void test('all 21 requested aliases map through the pinned Pele detector to 16 categories', () => {
	assert.equal(DIAGRAM_CATEGORIES.length, 16);
	let count = 0;
	for (const category of DIAGRAM_CATEGORIES) {
		for (const declaration of DIAGRAM_REGISTRY[category].declarations) {
			count++;
			for (const prefix of ['', '---\ntitle: Test\n---\n', '%% ordinary comment\n', '%%{init: {"theme":"base"}}%%\n',
				'---\r\ntitle: Test\r\n---\r\n%% ordinary comment\r\n']) {
				const source = prefix + declaration;
				assert.equal(detectType(source), category, source);
				assert.equal(diagramCategory(source), category, source);
				assert.ok(supports(source), source);
			}
		}
	}
	assert.equal(count, 21);
	assert.equal(diagramCategory('pie\n "First": 40'), null);
	assert.equal(diagramCategory('not a diagram'), null);
	assert.equal(diagramCategory(''), null);
	// Detection is deliberately independent of syntax validity.
	assert.equal(diagramCategory('flowchart LR\n A[unclosed'), 'flowchart');
});

void test('profile validation retains sparse mode values, zero widths, and alpha without mutating input', () => {
	const input = {
		colors: { background: { light: ' #ABC0 ', dark: '#12345678' }, text: { dark: '#fff' }, accent: { light: '' } },
		font: ' "Arial", sans-serif ', monospace: 'monospace', radiusPx: 0, labelSizePx: 128,
		titleWeight: 400, headingWeight: 900, boldWeight: 600,
		elements: { nodeFill: { light: '#0000' }, edgeWidth: 0, subgraphBorderWidth: 20 },
	};
	const original = JSON.stringify(input);
	const result = validateStyleProfile(input);
	assert.deepEqual(result.issues, []);
	assert.deepEqual(result.profile.colors, { background: { light: '#ABC0', dark: '#12345678' }, text: { dark: '#fff' } });
	assert.equal(result.profile.font, '"Arial", sans-serif');
	assert.equal(result.profile.radiusPx, 0);
	assert.equal(result.profile.elements.edgeWidth, 0);
	assert.equal(JSON.stringify(input), original);
	assert.notEqual(result.profile.colors.background, input.colors.background);
	assert.deepEqual(validateStyleProfile(result.profile), result);
});

void test('malformed fields produce diagnostics independently and cannot inject CSS', () => {
	const result = validateStyleProfile({
		colors: { text: { light: '#abc', dark: 'url(https://example.com)' }, '--_s': { light: '#fff' }, background: { system: '#fff' } },
		elements: { edgeWidth: '1px', nodeFill: '#fff', selector: '.anything' },
		font: 'Arial; color: red', radiusPx: Infinity, labelSizePx: 3, boldWeight: 650, unknown: true,
	});
	assert.deepEqual(result.profile, { colors: { text: { light: '#abc' } }, elements: {} });
	assert.equal(result.issues.length, 11);
	assert.ok(result.issues.some(issue => issue.path === 'colors.text.dark'));
	for (const value of ['red', 'rgb(0,0,0)', 'var(--bad)', '#12', '#12345', '#123456789', '#123; color:red']) assert.ok(!validStyleColor(value));
	for (const value of ['#123', '#1234', '#ABCDEF', '#12345600']) assert.ok(validStyleColor(value));
	for (const value of ['Arial/*comment*/', 'url(remote)', '@font-face', 'Arial{color:red}', 'Arial,,serif', '']) assert.ok(!validStyleFont(value));
});

void test('hostile records and mutable defaults cannot contaminate other profiles', () => {
	for (const value of [[], 'text', Object.create({ font: 'Arial' }), { get font() { throw new Error('Accessor executed'); } }]) {
		assert.equal(validateStyleProfile(value).issues.length, 1);
	}
	const hostile: unknown = JSON.parse('{"__proto__":{"polluted":true},"colors":{"constructor":{"light":"#fff"}},"elements":{"toString":2}}');
	const result = validateStyleProfile(hostile);
	assert.equal(result.issues.length, 3);
	assert.deepEqual(result.profile, emptyStyleProfile());
	const first = validateStyleProfile(undefined).profile;
	first.colors.text = { light: '#000' };
	assert.deepEqual(validateStyleProfile(null).profile, emptyStyleProfile());
	for (const value of [NaN, -1, 33, '4', '4px', 'calc(4px)']) assert.ok(validateStyleProfile({ radiusPx: value }).issues.length);
});

void test('type and local patches inherit every missing field and each color mode independently', () => {
	const global = validateStyleProfile({
		colors: { text: { light: '#111', dark: '#eee' }, border: { light: '#123' } },
		font: 'Arial', labelSizePx: 18, radiusPx: 8,
		elements: { nodeFill: { light: '#abc', dark: '#def' }, edgeWidth: 2 },
	}).profile;
	const type = { useGlobal: false, overrides: validateStyleProfile({
		colors: { text: { light: '#222' } }, radiusPx: 0,
		elements: { nodeFill: { dark: '#000' }, edgeWidth: 0 },
	}).profile };
	const local = validateStyleProfile({ colors: { text: { dark: '#fff' } }, font: 'serif' }).profile;
	const before = JSON.stringify({ global, type, local });
	const resolved = resolveStyleProfile(global, type, local);
	assert.deepEqual(resolved.colors.text, { light: '#222', dark: '#fff' });
	assert.deepEqual(resolved.colors.border, { light: '#123' });
	assert.deepEqual(resolved.elements.nodeFill, { light: '#abc', dark: '#000' });
	assert.equal(resolved.elements.edgeWidth, 0);
	assert.equal(resolved.radiusPx, 0);
	assert.equal(resolved.labelSizePx, 18);
	assert.equal(resolved.font, 'serif');
	assert.equal(JSON.stringify({ global, type, local }), before);
	resolved.colors.text.light = '#999';
	assert.deepEqual(global.colors.text, { light: '#111', dark: '#eee' });
	assert.deepEqual(type.overrides.colors.text, { light: '#222' });
	global.labelSizePx = 24;
	assert.equal(resolveStyleProfile(global, type).labelSizePx, 24);
	assert.deepEqual(resolveStyleProfile(global, { ...type, useGlobal: true }), global);
	assert.deepEqual(resolveStyleProfile(global, { useGlobal: false, overrides: emptyStyleProfile() }), global);
});

void test('category resolution applies only the detected type and keeps global styles on null or other types', () => {
	const global = validateStyleProfile({ colors: { text: { light: '#123' } } }).profile;
	const flowchart = { useGlobal: false, overrides: validateStyleProfile({ colors: { text: { light: '#456' } } }).profile };
	for (const source of ['flowchart LR\n A-->B', 'graph LR\n A-->B', 'flowchart-elk LR\n A-->B']) {
		const resolved = resolveDiagramStyle(source, global, { flowchart });
		assert.equal(resolved.category, 'flowchart');
		assert.deepEqual(resolved.profile.colors.text, { light: '#456' });
	}
	for (const source of ['sequenceDiagram\n A->>B: Hello', 'pie\n "First": 40', 'bad', '']) {
		assert.deepEqual(resolveDiagramStyle(source, global, { flowchart }).profile, global);
	}
	const local = validateStyleProfile({ colors: { text: { dark: '#fff' } } }).profile;
	assert.deepEqual(resolveDiagramStyle('bad', global, { flowchart }, local).profile.colors.text, { light: '#123', dark: '#fff' });
});

void test('empty and undefined overrides normalize to inheritance while numeric boundaries remain exact', () => {
	for (const value of [undefined, null, {}, { colors: {}, elements: {} }, {
		font: '  ', monospace: '', colors: { text: { light: ' ', dark: undefined }, border: undefined },
		elements: { nodeFill: {}, edgeWidth: undefined }, radiusPx: undefined,
	}]) assert.deepEqual(validateStyleProfile(value), { profile: emptyStyleProfile(), issues: [] });
	for (const weight of [400, 500, 600, 700, 800, 900]) assert.equal(validateStyleProfile({ titleWeight: weight }).profile.titleWeight, weight);
	for (const weight of [399, 450, 901, '700', Infinity, NaN]) assert.equal(validateStyleProfile({ titleWeight: weight }).issues.length, 1);
	for (const width of [-1, 20.1, NaN, Infinity, '2px']) assert.equal(validateStyleProfile({ elements: { edgeWidth: width } }).issues.length, 1);
	for (const size of [4, 128]) assert.equal(validateStyleProfile({ labelSizePx: size }).profile.labelSizePx, size);
	for (const size of [3.99, 128.01, '16px', NaN]) assert.equal(validateStyleProfile({ labelSizePx: size }).issues.length, 1);
});
