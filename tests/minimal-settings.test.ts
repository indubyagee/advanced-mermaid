import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { App } from 'obsidian';
import { minimalEnabled, minimalThemeWidths } from '../src/rendering/minimal-settings';

void test('disabled MTS ignores saved values and previously used live widths', () => {
	let reads = 0;
	const registry = {
		manifests: { 'obsidian-minimal-settings': { dir: '.custom/plugins/obsidian-minimal-settings' } },
		plugins: {} as Record<string, { settings: unknown }>,
	};
	const app = { plugins: registry, vault: { adapter: { read: () => {
		reads++;
		return JSON.stringify({ lineWidth: 27, lineWidthWide: 63, maxWidth: 91 });
	} } } } as unknown as App;
	assert.equal(minimalEnabled(app), false);
	assert.equal(minimalThemeWidths(app), undefined);
	registry.plugins['obsidian-minimal-settings'] = { settings: { lineWidth: 33, lineWidthWide: 72, maxWidth: 79 } };
	assert.equal(minimalEnabled(app), true);
	assert.deepEqual(minimalThemeWidths(app), { normalRem: 33, wideRem: 72, maximumPercent: 79 });
	delete registry.plugins['obsidian-minimal-settings'];
	assert.equal(minimalEnabled(app), false);
	assert.equal(minimalThemeWidths(app), undefined);
	assert.equal(reads, 0);
});

void test('absent MTS uses native sizing, while invalid active settings use theme defaults', () => {
	const absent = { plugins: { manifests: {} } } as unknown as App;
	assert.equal(minimalEnabled(absent), false);
	assert.equal(minimalThemeWidths(absent), undefined);
	for (const settings of [undefined, null, { lineWidth: 0, lineWidthWide: {}, maxWidth: 101 }]) {
		const app = { plugins: { plugins: { 'obsidian-minimal-settings': { settings } } } } as unknown as App;
		assert.deepEqual(minimalThemeWidths(app), { normalRem: 40, wideRem: 50, maximumPercent: 88 });
	}
});
