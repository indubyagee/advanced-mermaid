import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, PeleError } from 'pele';
import { DEFAULT_SETTINGS, normalizeSettings, parseMaxHeight, validThemeValue } from '../src/settings';
import { ConfigurationError, resolveDisplay } from '../src/rendering/overrides';

void test('invalid saved data falls back and does not reuse mutable defaults', () => {
	for (const value of [null, [], 'bad', { alignment: 'middle', maxHeight: '-1px' }]) {
		assert.deepEqual(normalizeSettings(value), DEFAULT_SETTINGS);
	}
	assert.notEqual(normalizeSettings(null), DEFAULT_SETTINGS);
});

void test('height grammar admits concrete lengths and rejects expressions and non-positive values', () => {
	for (const value of ['none', '30vh', '400px', '1.5rem', '.5rem']) assert.equal(parseMaxHeight(value), value);
	for (const value of ['', '0px', '-1px', '50%', 'auto', 'Infinitypx', 'calc(2px)', '2', '1e3px']) assert.equal(parseMaxHeight(value), null);
});

void test('custom theme values are allowlisted and defaults are isolated', () => {
	assert.ok(validThemeValue('font', '"Arial", sans-serif'));
	assert.ok(validThemeValue('text', '#123abc'));
	assert.ok(!validThemeValue('text', 'url(https://example.com)'));
	assert.ok(!validThemeValue('font', 'Arial; background: red'));
	assert.ok(!validThemeValue('font', '"Arial'));
	assert.ok(!validThemeValue('font', 'Arial,,serif'));
	const first = normalizeSettings({ theme: { foreground: '#123456', background: 'var(--bad)', unknown: 'evil' } });
	assert.deepEqual(first.theme, { text: '#123456' });
	first.theme.text = '#abcdef';
	assert.deepEqual(normalizeSettings(null).theme, {});
});

void test('overrides inherit missing values and preserve renderer compatibility and line positions', () => {
	const source = '---\r\ntitle: Test\r\n---\r\n%% ordinary\r\n%% advanced-mermaid: align=right max-height=none\r\nflowchart LR\r\n A[Start] --> B[End]';
	assert.deepEqual(resolveDisplay(source, { ...DEFAULT_SETTINGS }), { ...DEFAULT_SETTINGS, alignment: 'right', maxHeight: 'none' });
	const result = render(source, { images: false });
	assert.ok(result.svg.startsWith('<svg'));
	assert.ok(result.width > 0 && result.height > 0);
	assert.deepEqual(resolveDisplay('%% advanced-mermaid: align=left\nflowchart LR\n A-->B', { ...DEFAULT_SETTINGS }), { ...DEFAULT_SETTINGS, alignment: 'left', maxHeight: 'auto' });
	assert.deepEqual(resolveDisplay('flowchart LR\n%% advanced-mermaid: align=left\n A-->B', { ...DEFAULT_SETTINGS }), DEFAULT_SETTINGS);
});

void test('malformed directives report original body locations', () => {
	for (const text of ['align=bad', 'max-height=-2px', 'other=1', 'align=left align=right', '', 'align=left=bad']) {
		assert.throws(() => resolveDisplay(`\n%% advanced-mermaid: ${text}\nflowchart LR`, { ...DEFAULT_SETTINGS }), error => error instanceof ConfigurationError && error.line === 2);
	}
	assert.throws(() => resolveDisplay('%% advanced-mermaid: align=left\n%% advanced-mermaid: max-height=none\nflowchart LR', { ...DEFAULT_SETTINGS }), /only one/);
});

void test('Pele exposes structured failures and image loading remains disabled', () => {
	assert.throws(() => render('flowchart LR\n A[unclosed', { images: false }), error => error instanceof PeleError && error.code === 'syntax' && error.line === 2);
	const result = render('flowchart LR\n A@{ img: "https://example.com/image.png", label: "Image" }', { images: false });
	assert.doesNotMatch(result.svg, /<image[\s>]/);
});

void test('sequence, chart, and authored styles survive the shared render options', () => {
	for (const source of [
		'sequenceDiagram\n Alice->>Bob: Hello Ω',
		'pie title Example\n "First": 40\n "Second": 60',
		'flowchart LR\n A["<tag> & Ω"] --> B\n style A fill:#123456,color:#ffffff',
	]) {
		const result = render(source, { images: false });
		assert.ok(result.width > 0 && result.height > 0);
		assert.doesNotMatch(result.svg, /<image[\s>]/);
	}
});
