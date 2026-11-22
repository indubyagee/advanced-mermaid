import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings } from '../src/settings';
import { EDITOR_COLORS, normalizeEditorStyle } from '../src/styles/editor-style';
import { normalizeZoomStyle } from '../src/styles/zoom-style';

const inheritedZoom = { useGlobal: false, colors: {} };

void test('editor style additions preserve old source sizing and independently inherit theme colors', () => {
	const previous = normalizeSettings({ schemaVersion: 4, liveEditor: { fontSizePx: 23, lineNumbers: false } });
	assert.equal(previous.liveEditor.fontSizePx, 23);
	assert.equal(previous.liveEditor.lineNumbers, false);
	assert.deepEqual(previous.liveEditor.style, { lineNumberFontSizePx: null, buttonFontSizePx: null, buttonRadiusPx: null, colors: {}, syntax: {}, zoom: inheritedZoom });
	const style = normalizeEditorStyle({ buttonFontSizePx: 18, colors: {
		sourceText: { light: 'rgba(12, 34, 56, .5)' }, sourceBackground: { dark: '#123' },
		activeButtonText: { light: '#fff', dark: 'url(x)' }, unknown: { light: '#fff' },
	} });
	assert.deepEqual(style, { lineNumberFontSizePx: null, buttonFontSizePx: 18, buttonRadiusPx: null, colors: {
		sourceText: { light: '#0c223880' }, sourceBackground: { dark: '#112233' }, activeButtonText: { light: '#ffffff' },
	}, syntax: {}, zoom: inheritedZoom });
	assert.deepEqual(normalizeEditorStyle(JSON.parse(JSON.stringify(style))), style);
});

void test('every editor color pair and size survives settings persistence without shared defaults', () => {
	const colors = Object.fromEntries(Object.keys(EDITOR_COLORS).map(key => [key, { light: '#12345680', dark: '#abcdef' }]));
	for (const [size, radius] of [[8, 0], [16, 12], [40, 32]] as const) {
		const settings = normalizeSettings({ liveEditor: { style: { lineNumberFontSizePx: size, buttonFontSizePx: size, buttonRadiusPx: radius, colors } } });
		assert.deepEqual(settings.liveEditor.style, { lineNumberFontSizePx: size, buttonFontSizePx: size, buttonRadiusPx: radius, colors, syntax: {}, zoom: inheritedZoom });
		assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(settings))), settings);
	}
	const first = normalizeSettings(null); first.liveEditor.style.colors.sourceText = { dark: '#ffffff' };
	assert.deepEqual(normalizeSettings(null).liveEditor.style.colors, {});
	for (const size of [null, '16', '16px', 7, 41, 8.5, NaN, Infinity]) {
		const style = normalizeEditorStyle({ buttonFontSizePx: size, lineNumberFontSizePx: size });
		assert.equal(style.buttonFontSizePx, null);
		assert.equal(style.lineNumberFontSizePx, null);
	}
	for (const radius of [null, '0', '4px', -1, 33, 4.5, NaN, Infinity]) assert.equal(normalizeEditorStyle({ buttonRadiusPx: radius }).buttonRadiusPx, null);
});

void test('untrusted editor style records cannot inject CSS or getters', () => {
	const accessor = Object.defineProperty({}, 'colors', { enumerable: true, get: () => { throw new Error('Must not evaluate'); } });
	for (const style of [accessor, [], null, Object.create({ buttonFontSizePx: 20 })]) assert.deepEqual(normalizeEditorStyle(style), { lineNumberFontSizePx: null, buttonFontSizePx: null, buttonRadiusPx: null, colors: {}, syntax: {}, zoom: inheritedZoom });
	assert.deepEqual(normalizeEditorStyle({ colors: { sourceText: { light: '#fff; color:red', dark: 'var(--secret)' }, closeButtonBackground: { light: 'transparent' }, exportButtonText: ['#fff'] } }).colors, {});
});

void test('syntax settings preserve valid per-token overrides and discard invalid data', () => {
	const accessor = Object.defineProperty({}, 'weight', { enumerable: true, get: () => { throw new Error('Must not evaluate'); } });
	const settings = normalizeSettings({ liveEditor: { style: { syntax: {
		declaration: { colors: { light: 'rgba(1, 2, 3, 0.5)', dark: 'var(--invalid)' }, weight: 400 },
		comment: { weight: 650, colors: { dark: '#abc' } },
		keyword: { weight: '700' }, operator: accessor, unknown: { weight: 900 },
		frontmatter: { colors: { light: '#135' }, weight: 500 },
		'frontmatter-value': { colors: { dark: '#246' }, weight: 700 },
	} } } });
	assert.deepEqual(settings.liveEditor.style.syntax, {
		declaration: { colors: { light: '#01020380' }, weight: 400 },
		comment: { colors: { dark: '#aabbcc' } },
		'frontmatter-key': { colors: { light: '#113355' }, weight: 500 },
		'frontmatter-value': { colors: { dark: '#224466' }, weight: 700 },
	});
	assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(settings))), settings);
});

void test('dedicated Zoom colors inherit independently and global mode retains saved overrides', () => {
	assert.deepEqual(normalizeZoomStyle(undefined), inheritedZoom);
	const zoom = normalizeZoomStyle({ useGlobal: true, colors: {
		border: { light: 'rgba(12, 34, 56, .5)', dark: '#abc' }, text: { dark: '#fff' },
		background: { light: 'url(x)', dark: 'hsl(0, 0%, 0%)' }, unknown: { light: '#fff' },
	} });
	assert.deepEqual(zoom, { useGlobal: true, colors: { border: { light: '#0c223880', dark: '#aabbcc' }, text: { dark: '#ffffff' }, background: { dark: '#000000' } } });
	const settings = normalizeSettings({ liveEditor: { style: { zoom, colors: { closeButtonText: { dark: '#123456' } } } } });
	assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(settings))).liveEditor.style, settings.liveEditor.style);
	assert.deepEqual(settings.liveEditor.style.colors.closeButtonText, { dark: '#123456' });
	settings.liveEditor.style.zoom.useGlobal = false;
	assert.deepEqual(settings.liveEditor.style.zoom.colors, zoom.colors);
	settings.liveEditor.style.zoom.colors.border.light = '#ffffff';
	assert.deepEqual(normalizeSettings(null).liveEditor.style.zoom, inheritedZoom);
});
