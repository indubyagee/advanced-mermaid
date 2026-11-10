import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, SETTINGS_SCHEMA_VERSION } from '../src/settings';
import { decodeLocalStyle, encodeLocalStyle, parseStyleCss, LocalStyleError, frontmatterEnd } from '../src/styles/local-codec';
import { checkDiagramSource, MAX_DIAGRAM_SOURCE_LENGTH } from '../src/rendering/source-budget';
import { Language, defineLanguageFacet } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { parser } from '@lezer/markdown';
import { diagramFences } from '../src/editor/fences';

void test('v3 migration preserves display, distinct element defaults, fonts and both color modes', () => {
	const input = { schemaVersion: 2, alignment: 'right', maxWidth: 'wide', maxHeight: '30vh', fillAvailable: false,
		theme: { foreground: '#123', nodeFill: '#456', nodeBorderWidth: '0px', labelSize: '12pt', font: 'Arial' } };
	const original = JSON.stringify(input); const settings = normalizeSettings(input);
	assert.equal(settings.schemaVersion, SETTINGS_SCHEMA_VERSION); assert.equal(settings.maxHeight, '30vh'); assert.equal(settings.fillAvailable, false);
	assert.deepEqual(settings.style.global.colors.text, { light: '#123', dark: '#123' });
	assert.deepEqual(settings.style.global.elements.nodeFill, { light: '#456', dark: '#456' });
	assert.equal(settings.style.global.colors.surface, undefined);
	assert.equal(settings.style.global.elements.nodeBorderWidth, 0); assert.equal(settings.style.global.labelSizePx, 16);
	assert.deepEqual(normalizeSettings(settings), settings); assert.equal(JSON.stringify(input), original);
	const other = normalizeSettings(null); other.style.global.colors.text = { light: '#000' };
	assert.deepEqual(normalizeSettings(null).style.global.colors, {});
});
void test('v3 untrusted profiles and editor preferences normalize independently', () => {
	const settings = normalizeSettings({ schemaVersion: 3, maxHeight: '50vh', style: { diagrams: { flowchart: { useGlobal: false, overrides: { colors: { text: { dark: '#fff' } } } }, unknown: {} } }, liveEditor: { debounceMs: 1, layout: 'stacked', wrapSource: true } });
	assert.equal(settings.liveEditor.debounceMs, 250); assert.equal(settings.liveEditor.layout, 'stacked');
	assert.equal(settings.maxHeight, '50vh'); assert.equal(settings.style.diagrams.flowchart?.useGlobal, false);
	assert.deepEqual(Object.keys(settings.style.diagrams), ['flowchart']);
});
void test('inline source font size defaults to inheritance and round-trips valid pixel sizes', () => {
	assert.equal(normalizeSettings(null).liveEditor.fontSizePx, null);
	for (const size of [8, 16, 22, 40]) {
		const settings = normalizeSettings({ liveEditor: { fontSizePx: size } });
		assert.equal(settings.liveEditor.fontSizePx, size);
		assert.equal(normalizeSettings(JSON.parse(JSON.stringify(settings))).liveEditor.fontSizePx, size);
	}
	for (const size of [undefined, null, 7, 41, 12.5, NaN, Infinity, '22', '22px', {}, true]) {
		assert.equal(normalizeSettings({ liveEditor: { fontSizePx: size } }).liveEditor.fontSizePx, null);
	}
});
void test('local CSS parses fully, preserves mode specificity and reports bad input', () => {
	const css = '/* hi */\n.theme-dark .pele { --pele-fg: #fff; --pele-radius: 0px; }\n.pele { --pele-fg:#123; --advanced-mermaid-edge-width:2px; --pele-font:"Arial", sans-serif; }';
	assert.equal(parseStyleCss(css, 'dark').colors.text?.dark, '#fff');
	assert.equal(parseStyleCss(css, 'light').colors.text?.light, '#123');
	assert.equal(parseStyleCss(css, 'dark').radiusPx, 0);
	for (const bad of ['@import "x";', '.anything { --pele-fg:#fff; }', '.pele { color:red; }', '.pele { --pele-fg:url(x); }', '.pele { --_s:#fff; }', '.pele { --pele-radius:calc(1px); }', '.pele { --pele-fg:#fff !important; }', '/* unclosed']) assert.throws(() => parseStyleCss(bad), LocalStyleError);
});
void test('style comment edits round-trip surrounding source and CRLF, with original diagnostic lines', () => {
	const source = '---\r\ntitle: Test\r\n---\r\n%% ordinary\r\n%%{init: {"theme":"base"}}%%\r\nflowchart LR\r\n A-->B';
	const css = '.pele {\n --pele-fg:#123;\n}'; const encoded = encodeLocalStyle(source, css);
	assert.equal(encodeLocalStyle(encoded, ''), source);
	assert.equal(decodeLocalStyle(encoded, 'light').profile.colors.text?.light, '#123');
	assert.equal(encodeLocalStyle(encoded, css), encoded);
	assert.ok(encoded.includes('---\r\n%% advanced-mermaid-style:v1\r\n'));
	assert.throws(() => decodeLocalStyle('%% advanced-mermaid-style:v1\n%% .pele {\n%% --pele-fg:red;\n%% }\n%% advanced-mermaid-style:end\nflowchart LR', 'light'), error => error instanceof LocalStyleError && error.line === 3);
	for (const invalid of ['%% advanced-mermaid-style:v2\nflowchart LR', encoded + '\n%% advanced-mermaid-style:v1', '%% advanced-mermaid-style:v1\nnot a comment\n%% advanced-mermaid-style:end']) assert.throws(() => decodeLocalStyle(invalid, 'light'), LocalStyleError);
});

void test('style insertion does not mistake YAML scalar text or comments for document/style delimiters', () => {
	for (const source of ['---\ntitle: "first\n---\nlast"\n---\nflowchart LR\n A-->B', "---\ntitle: Earth's map\n# an unmatched \" in a comment\n---\nflowchart LR\n A-->B", '---\ntitle: "first\n%% advanced-mermaid-style:v2\nlast"\n---\nflowchart LR\n A-->B']) {
		const encoded = encodeLocalStyle(source, '.pele { --pele-fg:#123; }');
		assert.equal(encodeLocalStyle(encoded, ''), source);
		assert.ok(encoded.indexOf('%% advanced-mermaid-style:v1') > source.lastIndexOf('---'));
	}
});

void test('frontmatter scanning handles long whitespace and preserves quoted/flow delimiters', () => {
	const metadata = '---\n' + ' '.repeat(40_000) + '\nlist: ["first\\nlast", \'it\'\'s valid\']\n---\n';
	const source = metadata + 'flowchart LR\n A-->B';
	assert.equal(frontmatterEnd(source, true), metadata.length);
	const encoded = encodeLocalStyle(source, '.pele { --pele-fg:#123; }');
	assert.equal(encodeLocalStyle(encoded, ''), source);
	assert.ok(encoded.indexOf('%% advanced-mermaid-style:v1') >= metadata.length);
});

void test('diagram source budget accepts the boundary and rejects oversized input', () => {
	assert.doesNotThrow(() => checkDiagramSource('a'.repeat(MAX_DIAGRAM_SOURCE_LENGTH)));
	assert.throws(() => checkDiagramSource('a'.repeat(MAX_DIAGRAM_SOURCE_LENGTH + 1)), /50,000/);
});

void test('parsed top-level fence ranges handle duplicates, tildes, deletion, and nested exclusions', () => {
	const language = new Language(defineLanguageFacet(), parser);
	const source = 'Before\n\n```pele\nflowchart LR\n A-->B\n```\n\n~~~pele\nflowchart LR\n A-->B\n~~~\n\n> ```pele\n> flowchart LR\n> ```\n\n```pele other\nflowchart LR\n```';
	const state = EditorState.create({ doc: source, extensions: [language] }); const fences = diagramFences(state);
	assert.equal(fences.length, 2); assert.equal(state.sliceDoc(fences[0]!.bodyFrom, fences[0]!.bodyTo), 'flowchart LR\n A-->B');
	assert.notEqual(fences[0]!.from, fences[1]!.from);
	const incomplete = EditorState.create({ doc: '```pele\nflowchart LR\n A-->B', extensions: [language] }); assert.deepEqual(diagramFences(incomplete), []);
});

void test('both fence languages retain their delimiters and exclude nested or incomplete blocks', () => {
	const language = new Language(defineLanguageFacet(), parser);
	const text = '```mermaid\nflowchart LR\n A-->B\n```\n\n~~~pele\nflowchart LR\n A-->B\n~~~\n\n> ~~~mermaid\n> A-->B\n> ~~~\n\n```mermaid\nunclosed';
	const state = EditorState.create({ doc: text, extensions: [language] }); const ranges = diagramFences(state);
	assert.deepEqual(ranges.map(range => range.language), ['mermaid', 'pele']);
	for (const range of ranges) assert.equal(state.sliceDoc(range.bodyFrom, range.bodyTo), 'flowchart LR\n A-->B');
	assert.ok(state.sliceDoc(ranges[0]!.from, ranges[0]!.to).startsWith('```mermaid'));
	assert.ok(state.sliceDoc(ranges[1]!.from, ranges[1]!.to).startsWith('~~~pele'));
});
