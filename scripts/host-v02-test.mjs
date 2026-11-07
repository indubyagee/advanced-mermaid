import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

if (!process.env.ADVANCED_MERMAID_HOST_VAULT) throw new Error('Set ADVANCED_MERMAID_HOST_VAULT to a disposable development vault before running the host probe.');
const vault = resolve(process.env.ADVANCED_MERMAID_HOST_VAULT);
const plugins = join(vault, '.obsidian', 'plugins');
const id = 'advanced-mermaid-v02-probe-' + Date.now(); const directory = resolve(plugins, id);
if (!directory.startsWith(plugins + sep)) throw new Error('Probe directory must stay inside the chosen vault plugin directory.');
const manifest = { id, name: 'Advanced Mermaid v0.2.0 host probe', version: '0.0.0', minAppVersion: '1.14.5', description: 'Temporary local integration probe', author: 'Local', isDesktopOnly: true };
const installedManifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const originalData = join(plugins, installedManifest.id, 'data.json');
const fingerprint = async () => { try { return createHash('sha256').update(await readFile(originalData)).digest('hex'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const before = await fingerprint();
const bundle = await build({ entryPoints: ['tests/host-v02-entry.ts'], bundle: true, write: false, platform: 'browser', format: 'cjs', target: 'es2021', external: ['obsidian', '@codemirror/*', '@lezer/*'] });
await mkdir(directory); await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest)); await writeFile(join(directory, 'main.js'), bundle.outputFiles[0].contents); await writeFile(join(directory, 'styles.css'), await readFile('styles.css'));
let browser; let page;
try {
	browser = await chromium.connectOverCDP(process.env.ADVANCED_MERMAID_HOST_CDP || 'http://127.0.0.1:9222');
	for (const candidate of browser.contexts().flatMap(context => context.pages())) if (candidate.url().startsWith('app://') && (await candidate.evaluate(() => app.vault.adapter.getBasePath())).toLowerCase() === vault.toLowerCase()) page = candidate;
	if (!page) throw new Error('Open the development vault in Obsidian with localhost debugging enabled.');
	await page.evaluate(async manifest => {
		if (document.querySelector('.advanced-mermaid-editor')) throw new Error('Close or resolve existing inline drafts before running the isolated probe.');
		const original = app.plugins.plugins['advanced-mermaid'];
		window.advancedMermaidV02Previous = { original, enabled: original?.settings.liveEditor.enabled, styles: [...document.querySelectorAll('style')].filter(style => style.textContent.includes('.advanced-mermaid')).map(style => ({ style, disabled: style.sheet.disabled })) };
		if (original) { original.settings.liveEditor.enabled = false; original.inline?.refresh(); }
		for (const entry of window.advancedMermaidV02Previous.styles) entry.style.sheet.disabled = true;
		app.plugins.manifests[manifest.id] = { ...manifest, dir: '.obsidian/plugins/' + manifest.id };
		await app.plugins.loadPlugin(manifest.id);
	}, manifest);
	await page.waitForFunction(() => !!window.advancedMermaidV02Probe, null, { timeout: 10000 });
	const editor = await page.evaluate(path => window.advancedMermaidV02Probe.editors(path), 'tests/' + id + '.md');
	const exports = await page.evaluate(() => window.advancedMermaidV02Probe.exports());
	const panes = await page.evaluate(path => window.advancedMermaidV02Probe.panes(path), 'tests/' + id + '-panes.md');
	console.log('Host editor:', JSON.stringify(editor)); console.log('Host export:', JSON.stringify(exports));
	console.log('Host panes:', JSON.stringify(panes));
	for (const [key, value] of Object.entries(editor)) if (!['path', 'modeControls'].includes(key)) assert.equal(value, true, key);
	assert.equal(editor.modeControls, 2); for (const [key, value] of Object.entries(exports)) assert.equal(value, true, key);
	for (const [key, value] of Object.entries(panes)) assert.equal(value, true, key);
	await page.evaluate(async () => { await app.setting.open(); app.setting.openTabById(window.advancedMermaidV02Probe.manifest.id); });
	await page.waitForTimeout(400);
	let surface;
	for (const candidate of browser.contexts().flatMap(context => context.pages())) if (await candidate.getByText('Editor style settings', { exact: true }).count()) surface = candidate;
	if (!surface) throw new Error('Native settings window unavailable.');
	await surface.bringToFront();
	const settingsReport = {};
	await surface.getByText('Editor style settings', { exact: true }).click();
	await surface.locator('[aria-label="Source font size"]').fill('23');
	await page.evaluate(() => window.advancedMermaidV02Probe.persisted);
	settingsReport.persisted = await page.evaluate(async () => (await window.advancedMermaidV02Probe.loadData()).liveEditor.fontSizePx === 23);
	await surface.locator('.setting-page-back-button').click();
	await surface.getByText('Global style settings', { exact: true }).click();
	await surface.waitForTimeout(80);
	settingsReport.inheritedSwatch = await page.evaluate(() => window.advancedMermaidV02Probe.checkInheritedSwatch());
	await surface.locator('[aria-label="Primary text Light"]:visible').fill('rgba(255, 0, 0, .5)');
	settingsReport.colorPair = await surface.locator('.advanced-mermaid-color-row:visible').filter({ has: surface.locator('[aria-label="Primary text Light"]') }).locator('input[type="color"]').count() === 2;
	await mkdir('test-results', { recursive: true }); await surface.screenshot({ path: 'test-results/v02-global-styles-host.png' });
	await surface.getByRole('button', { name: 'Reset', exact: true }).click(); await surface.getByRole('button', { name: 'Undo reset', exact: true }).click();
	settingsReport.resetUndo = await page.evaluate(() => window.advancedMermaidV02Probe.settings.style.global.colors.text.light === '#ff000080');
	const back = () => surface.locator('.setting-page-back-button').click();
	await back();
	await surface.getByText('Diagram-specific style settings', { exact: true }).click();
	await surface.locator('[aria-label="Diagram selection"]:visible').selectOption('flowchart');
	const inheritance = surface.locator('.setting-item:visible').filter({ has: surface.getByText('Use global styles', { exact: true }) });
	await inheritance.locator('.checkbox-container').click();
	await surface.locator('[aria-label="Primary text Dark"]:visible').fill('#abcdef');
	settingsReport.typeRetained = await page.evaluate(() => window.advancedMermaidV02Probe.settings.style.diagrams.flowchart.overrides.colors.text.dark === '#abcdef');
	await back();
	await surface.getByText('Preset class settings', { exact: true }).last().click();
	await surface.getByRole('button', { name: 'Create', exact: true }).click();
	let dialog = surface.locator('.advanced-mermaid-preset-dialog');
	await dialog.locator('[aria-label="Preset class alias"]').fill('NativeCustom'); await dialog.locator('[aria-label="Preset fill"]').fill('#12345680');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	settingsReport.formCreate = await page.evaluate(() => window.advancedMermaidV02Probe.settings.presets.some(preset => preset.alias === 'NativeCustom'));
	await surface.locator('[aria-label="Preset class selection"]').selectOption('NativeCustom'); await surface.getByRole('button', { name: 'Edit', exact: true }).click();
	dialog = surface.locator('.advanced-mermaid-preset-dialog'); await dialog.locator('[aria-label="Preset class alias"]').fill('NativeRenamed'); await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	settingsReport.formRename = await page.evaluate(() => window.advancedMermaidV02Probe.settings.presets.some(preset => preset.alias === 'NativeRenamed'));
	await surface.locator('[aria-label="Preset class selection"]').selectOption('NativeRenamed'); await surface.getByRole('button', { name: 'Delete', exact: true }).click();
	settingsReport.deletePending = await page.evaluate(() => window.advancedMermaidV02Probe.settings.presets.some(preset => preset.alias === 'NativeRenamed'));
	await surface.locator('.advanced-mermaid-delete-preset-dialog').getByRole('button', { name: 'Delete', exact: true }).click();
	settingsReport.deleted = await page.evaluate(() => !window.advancedMermaidV02Probe.settings.presets.some(preset => preset.alias === 'NativeRenamed'));
	await surface.getByPlaceholder(/Search settings/).fill('Preset class code block'); await surface.waitForTimeout(250);
	settingsReport.search = await surface.getByText('Preset class code block', { exact: true }).count() > 0;
	await surface.getByPlaceholder(/Search settings/).fill(''); await surface.waitForTimeout(150);
	await surface.getByRole('button', { name: 'Edit preset text', exact: true }).click();
	dialog = surface.locator('.advanced-mermaid-preset-dialog'); await dialog.locator('textarea').fill('preset: []'); await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await page.evaluate(() => window.advancedMermaidV02Probe.persisted);
	await page.evaluate(async id => { app.setting.close(); await app.plugins.unloadPlugin(id); await app.plugins.loadPlugin(id); }, id);
	settingsReport.reloaded = await page.evaluate(() => window.advancedMermaidV02Probe.settings.liveEditor.fontSizePx === 23 && window.advancedMermaidV02Probe.settings.presets.length === 0);
	console.log('Host settings:', JSON.stringify(settingsReport)); for (const [key, value] of Object.entries(settingsReport)) assert.equal(value, true, key);
	await writeFile('test-results/v02-host-results.json', JSON.stringify({ date: new Date().toISOString(), title: await page.title(), editor, exports, panes, settings: settingsReport }, null, 2));
} finally {
	if (page) await page.evaluate(async id => {
		try { app.setting.close(); await app.plugins.unloadPlugin(id); delete app.plugins.manifests[id]; }
		finally {
			const previous = window.advancedMermaidV02Previous;
			if (previous) { if (previous.original) { previous.original.settings.liveEditor.enabled = previous.enabled; previous.original.inline?.refresh(); } for (const entry of previous.styles) if (entry.style.sheet) entry.style.sheet.disabled = entry.disabled; delete window.advancedMermaidV02Previous; }
		}
	}, id).catch(error => console.error('Host cleanup:', error.message));
	await browser?.close();
	if (directory.startsWith(plugins + sep) && JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')).id === id) await rm(directory, { recursive: true });
	assert.equal(await fingerprint(), before, 'The installed plugin settings must remain byte-for-byte unchanged.');
}
