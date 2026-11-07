import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeColor } from '../src/styles/colors';
import { decodePresets, encodePresets, defaultPresets, validatePresets, PresetTextError } from '../src/styles/presets';
import { normalizeSettings, isFutureSettingsSchema } from '../src/settings';

void test('literal colors normalize RGB, HSL, short hex and alpha without evaluating CSS', () => {
	for (const [source, expected] of [
		['#aBc', '#aabbcc'], ['#1234', '#11223344'], ['rgba(255, 0, 0, .5)', '#ff000080'],
		['rgb(100% 0% 0% / 50%)', '#ff000080'], ['hsl(120, 100%, 50%)', '#00ff00'],
		['hsla(-120deg 100% 50% / .25)', '#0000ff40'], ['hsl(.5turn 100% 50%)', '#00ffff'],
	]) assert.equal(normalizeColor(source!), expected);
	for (const value of ['red', 'var(--x)', 'url(x)', 'rgb(256,0,0)', 'rgba(0,0,0,2)', 'hsl(1 101% 50%)', 'rgb(1, 2 3)', 'rgb(1 2 3 /)', '#12', 'rgba(NaN,0,0,1)']) assert.equal(normalizeColor(value), null, value);
});

void test('preset text accepts bare hex examples and writes quoted, lossless values', () => {
	const source = 'preset:\r\n  - alias: DEFAULT\r\n    fill: #50505080\r\n    stroke: #808080\r\n    text: rgb(255, 0, 0)\r\n    width: 1.25px';
	const parsed = decodePresets(source);
	assert.deepEqual(parsed, [{ alias: 'DEFAULT', fill: '#50505080', stroke: '#808080', text: '#ff0000', width: 1.25 }]);
	assert.match(encodePresets(parsed), /fill: "#50505080"/);
	assert.deepEqual(decodePresets(encodePresets(parsed)), parsed);
	assert.deepEqual(decodePresets('preset: []'), []);
	assert.deepEqual(decodePresets('preset:\n  - alias: Empty\n    fill:\n    width:'), [{ alias: 'Empty' }]);
});

void test('invalid preset drafts report issues and cannot partly replace a library', () => {
	for (const source of [
		'preset:\n  - alias: A\n    fill: #xyz', 'preset:\n  - alias: A\n  - alias: A',
		'preset:\n  - alias: pele-node', 'preset:\n  - alias: default', 'preset:\n  - alias: A\n    width: 21px',
		'preset:\n  - alias: A\n    fill: #fff\n    fill: #000', 'preset:\n  - alias: A\n    unknown: yes',
		'preset:\n  - alias: "unterminated', 'preset: &anchor', 'preset:\n  - alias: A\n    fill: !tag red', 'preset: []\n  - alias: A',
	]) assert.throws(() => decodePresets(source), PresetTextError, source);
	assert.ok(validatePresets([{ alias: 'A', width: 0 }, { alias: 'B', width: NaN }]).issues.length);
	assert.deepEqual(decodePresets('preset:\n  - alias: A\n    width: 0px'), [{ alias: 'A', width: 0 }]);
});

void test('schema 4 seeds the original palette once and preserves empty libraries and existing settings', () => {
	const legacy = normalizeSettings({ schemaVersion: 3, maxHeight: 'none', style: { global: { colors: { text: { dark: '#abc' } } } }, liveEditor: { fontSizePx: 17 } });
	assert.equal(legacy.schemaVersion, 4); assert.equal(legacy.presets.length, 8);
	assert.equal(legacy.presets[2]?.fill, '#2d4646'); assert.equal(legacy.maxHeight, 'none');
	assert.equal(legacy.style.global.colors.text?.dark, '#abc'); assert.equal(legacy.liveEditor.fontSizePx, 17);
	assert.deepEqual(normalizeSettings(legacy), legacy);
	assert.deepEqual(normalizeSettings({ schemaVersion: 4, presets: [] }).presets, []);
	const changed = normalizeSettings(null); changed.presets[0]!.fill = '#ff0000';
	assert.deepEqual(normalizeSettings(null).presets, defaultPresets());
});

void test('the persistence guard recognizes newer schemas without modifying their data', () => {
	const future = { schemaVersion: 5, presets: [], newSetting: { retained: true } }; const original = JSON.stringify(future);
	assert.equal(isFutureSettingsSchema(future), true); normalizeSettings(future);
	assert.equal(JSON.stringify(future), original);
	for (const saved of [null, {}, { schemaVersion: 3 }, { schemaVersion: 4 }, { schemaVersion: '5' }]) assert.equal(isFutureSettingsSchema(saved), false);
});
