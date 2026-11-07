import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertDisplayOverride, insertStyleOverride } from '../src/editor/override-insertion';
import { decodeLocalStyle } from '../src/styles/local-codec';
import { resolveDisplay } from '../src/rendering/overrides';
import { normalizeSettings } from '../src/settings';

void test('display insertion preserves CRLF/frontmatter and selects existing authored values', () => {
	const source = '\r\n---\r\ntitle: "A\r\n---\r\nB"\r\n---\r\n%% ordinary\r\nflowchart LR\r\n A-->B';
	const first = insertDisplayOverride(source, 'align', 'left');
	assert.equal(first.source.slice(first.from, first.to), 'left'); assert.equal(first.changed, true);
	assert.equal(first.source.replace('%% advanced-mermaid: align=left\r\n', ''), source);
	assert.equal(resolveDisplay(first.source, normalizeSettings(null)).alignment, 'left');
	const second = insertDisplayOverride(first.source, 'max-width', 'wide');
	assert.match(second.source, /align=left max-width=wide/);
	const existing = insertDisplayOverride(second.source, 'align', 'right');
	assert.equal(existing.source, second.source); assert.equal(existing.changed, false); assert.equal(existing.source.slice(existing.from, existing.to), 'left');
	assert.throws(() => insertDisplayOverride('%% advanced-mermaid: align=bad\nflowchart LR', 'fill', 'true'));
	assert.throws(() => insertDisplayOverride('---\ntitle: unfinished', 'align', 'left'));
});

void test('style insertion retains declarations and mode scope with exact value selection', () => {
	const source = '---\r\ntitle: Test\r\n---\r\n%% ordinary\r\nflowchart LR\r\n A-->B';
	const first = insertStyleOverride(source, '--pele-fg', '#123456', 'dark');
	assert.equal(first.source.slice(first.from, first.to), '#123456');
	assert.equal(decodeLocalStyle(first.source, 'light').profile.colors.text, undefined);
	assert.equal(decodeLocalStyle(first.source, 'dark').profile.colors.text?.dark, '#123456');
	const second = insertStyleOverride(first.source, '--pele-radius', '2.5px', 'dark');
	assert.equal(second.source.slice(second.from, second.to), '2.5px'); assert.match(second.source, /--pele-fg: #123456;/);
	const existing = insertStyleOverride(second.source, '--pele-fg', '#ffffff', 'dark');
	assert.equal(existing.changed, false); assert.equal(existing.source.slice(existing.from, existing.to), '#123456');
	const both = insertStyleOverride(second.source, '--pele-fg', '#abcdef', 'both');
	assert.equal(decodeLocalStyle(both.source, 'light').profile.colors.text?.light, '#abcdef');
	assert.equal(decodeLocalStyle(both.source, 'dark').profile.colors.text?.dark, '#123456');
	assert.ok(both.source.endsWith('%% ordinary\r\nflowchart LR\r\n A-->B'));
	assert.throws(() => insertStyleOverride('%% advanced-mermaid-style:v1\nflowchart LR', '--pele-fg', '#fff', 'both'));
	assert.throws(() => insertStyleOverride(source, '--pele-fg', 'url(x)', 'both'));
	assert.throws(() => insertStyleOverride(source, '--private', '#fff', 'both'));
	const noSemicolon = '%% advanced-mermaid-style:v1\n%% .pele { --pele-fg:#fff }\n%% advanced-mermaid-style:end\nflowchart LR';
	assert.equal(decodeLocalStyle(insertStyleOverride(noSemicolon, '--pele-radius', '3px', 'both').source, 'light').profile.radiusPx, 3);
});
