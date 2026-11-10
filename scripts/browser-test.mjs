import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { runPostTestChecks } from './browser-regressions.mjs';
import { runInlineEditorChecks } from './inline-editor-browser.mjs';
import { runInlineSettingsChecks } from './inline-settings-browser.mjs';
import { runInlineLayoutChecks } from './inline-layout-browser.mjs';
import { runPresetChecks, runEditorModeChecks } from './v02-browser.mjs';
import { runEditorInteractionChecks, runNavigationChecks } from './v021-browser.mjs';
import { runEditorStyleChecks } from './editor-style-browser.mjs';
import { runRendererOwnershipChecks } from './renderer-ownership-browser.mjs';
import { runMermaidPreviewChecks } from './mermaid-preview-browser.mjs';
import { runZoomStyleChecks } from './zoom-style-browser.mjs';
import { runFrontmatterChecks } from './frontmatter-browser.mjs';
import { runSyntaxChecks } from './syntax-browser.mjs';

const bundle = await build({ entryPoints: ['tests/browser-entry.ts'], bundle: true, write: false, format: 'iife', globalName: 'fixture', alias: { obsidian: resolve('tests/obsidian.ts') } });
const css = await readFile('styles.css', 'utf8');
const server = createServer((request, response) => {
	response.setHeader('Content-Type', request.url === '/fixture.js' ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8');
	response.end(request.url === '/fixture.js' ? bundle.outputFiles[0].text : `<!doctype html><style>body{--background-primary:#fff;--text-normal:#222;--font-text:Arial;font-family:Arial}.fixture-diagram{width:600px}${css}</style><script src="/fixture.js"></script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
	browser = await chromium.launch({ channel: process.env.ADVANCED_MERMAID_BROWSER || 'msedge', headless: true });
	const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
	page.on('pageerror', error => console.error('Browser error:', error));
	await page.goto(`http://127.0.0.1:${server.address().port}`);
	await runMermaidPreviewChecks(page);
	await runSyntaxChecks(page);
	await runFrontmatterChecks(page);
	const sourceBudget = await page.evaluate(() => {
		const item = fixture.diagram('---\n' + ' '.repeat(60_000) + '\n---\nflowchart LR\n A-->B');
		const result = { diagnostic: item.host.textContent.includes('Diagram source exceeds 50,000 characters.'), rendered: !!item.host.querySelector('svg'), actionsHidden: item.host.querySelector('.advanced-mermaid-actions')?.hidden };
		item.child.unload();
		return result;
	});
	assert.deepEqual(sourceBudget, { diagnostic: true, rendered: false, actionsHidden: true });
	await runRendererOwnershipChecks(page);
	await runEditorInteractionChecks(page);
	await runEditorStyleChecks(page);
	await runZoomStyleChecks(page);
	await runNavigationChecks(page);
	const result = await page.evaluate(async () => {
		const { diagram } = fixture;
		const item = diagram('flowchart LR\n A[Start] --> B[End]', { fillAvailable: false });
		await new Promise(resolve => requestAnimationFrame(resolve));
		const svg = item.host.querySelector('svg.pele');
		const bounds = svg.getBoundingClientRect();
		const small = { width: bounds.width, height: bounds.height, x: bounds.x - item.host.getBoundingClientRect().x, ratio: Number(svg.getAttribute('width')) / Number(svg.getAttribute('height')) };
		item.settings.alignment = 'right'; item.child.updateSettings();
		const right = item.host.querySelector('svg.pele').getBoundingClientRect().x - item.host.getBoundingClientRect().x;
		const tall = diagram('flowchart TD\n' + Array.from({ length: 20 }, (_, i) => ` A${i} --> A${i + 1}`).join('\n'));
		await new Promise(resolve => requestAnimationFrame(resolve));
		const tallSvg = tall.host.querySelector('svg.pele');
		const tallBounds = tallSvg.getBoundingClientRect();
		const failed = diagram('flowchart LR\n A[<img src=x onerror=alert(1)>');
		const failure = { source: failed.host.querySelector('code').textContent, images: failed.host.querySelectorAll('img').length, error: failed.host.querySelector('.advanced-mermaid-error').hidden };
		item.child.unload(); tall.child.unload(); failed.child.unload();
		const removed = item.host.children.length;
		item.child.load();
		const reloaded = item.host.querySelectorAll('.advanced-mermaid-mount > svg.pele').length;
		item.child.unload();
		return { small, right, tall: { width: tallBounds.width, height: tallBounds.height, ratio: Number(tallSvg.getAttribute('width')) / Number(tallSvg.getAttribute('height')) }, failure, removed, reloaded };
	});
	console.log('Display measurements:', JSON.stringify(result));
	assert.ok(result.small.width > 0 && result.small.width < 600);
	assert.ok(Math.abs(result.small.width / result.small.height - result.small.ratio) < .01);
	assert.ok(result.small.x > 0 && result.right > result.small.x);
	assert.ok(result.tall.height <= 400.1 && result.tall.height > 0);
	assert.ok(Math.abs(result.tall.width / result.tall.height - result.tall.ratio) < .01);
	assert.equal(result.failure.images, 0);
	assert.equal(result.failure.error, false);
	assert.ok(result.failure.source.includes('<img'));
	assert.equal(result.removed, 0);
	assert.equal(result.reloaded, 1);
	const exports = await page.evaluate(async () => {
		const source = 'flowchart LR\n A["Start & Ω"] --> B["Finish"]';
		const item = fixture.diagram(source);
		const rendered = fixture.render(source, { images: false, fontFamily: 'Arial' });
		const snapshot = await fixture.createSvgSnapshot(rendered, item.host, () => true);
		const parsed = new DOMParser().parseFromString(snapshot.svg, 'image/svg+xml');
		const visible = !snapshot.svg.includes('visibility: hidden') && !parsed.querySelector('parsererror');
		const png = await fixture.createPng(snapshot, document, new AbortController().signal);
		const bitmap = await createImageBitmap(png);
		const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
		const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
		const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
		let ink = 0, transparent = 0;
		for (let index = 0; index < pixels.length; index += 4) { if (pixels[index] < 200) ink++; if (pixels[index + 3] < 255) transparent++; }
		const dimensions = { width: bitmap.width, height: bitmap.height }; bitmap.close();
		const style = parsed.querySelector('text')?.getAttribute('style');
		const size = { width: snapshot.width, height: snapshot.height };
		const copies = [];
		class TestClipboardItem { constructor(data) { this.data = data; } static supports() { return true; } }
		Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: TestClipboardItem });
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
			write: async items => { const values = {}; for (const [type, value] of Object.entries(items[0].data)) values[type] = await value; copies.push(values); },
			writeText: async text => copies.push({ 'text/plain': new Blob([text]) }),
		} });
		const waitFor = async predicate => { for (let index = 0; index < 200; index++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Action did not complete: ' + item.host.textContent); };
		const click = text => [...item.host.querySelectorAll('button')].find(button => button.textContent === text).click();
		click('Copy SVG'); await waitFor(() => copies.length === 1);
		await waitFor(() => item.host.textContent.includes('Copied SVG source.'));
		click('Copy PNG'); await waitFor(() => copies.length === 2);
		await waitFor(() => item.host.textContent.includes('Copied PNG.'));
		click('Save SVG'); await waitFor(() => document.querySelector('.modal'));
		const folder = document.querySelector('.modal input'); folder.value = ''; folder.dispatchEvent(new Event('input'));
		[...document.querySelectorAll('.modal button')].find(button => button.textContent === 'Save').click();
		await waitFor(() => fixture.saved.size === 1);
		await waitFor(() => item.host.textContent.includes('Saved '));
		click('Save PNG'); await waitFor(() => document.querySelector('.modal'));
		[...document.querySelectorAll('.modal button')].find(button => button.textContent === 'Save').click();
		await waitFor(() => fixture.saved.size === 2);
		const files = [...fixture.saved].map(([path, data]) => ({ path, binary: data instanceof ArrayBuffer, bytes: typeof data === 'string' ? data.length : data.byteLength }));
		const copiedSvg = await copies[0]['text/plain'].text();
		const copiedPng = copies[1]['image/png'].type;
		const leftover = document.querySelectorAll('.advanced-mermaid-snapshot').length;
		item.child.unload();
		return { visible, size, dimensions, ink, transparent, style, files, copiedSvgValid: copiedSvg.startsWith('<svg') && !copiedSvg.includes('var('), copiedPng, leftover };
	});
	assert.equal(exports.visible, true);
	assert.equal(exports.dimensions.width, Math.ceil(exports.size.width * 2));
	assert.equal(exports.dimensions.height, Math.ceil(exports.size.height * 2));
	assert.ok(exports.ink > 100 && exports.transparent === 0);
	assert.match(exports.style, /Arial/);
	assert.equal(exports.copiedSvgValid, true);
	assert.equal(exports.copiedPng, 'image/png');
	assert.ok(exports.files.some(file => file.path.endsWith('.svg') && !file.binary));
	assert.ok(exports.files.some(file => file.path.endsWith('.png') && file.binary));
	assert.equal(exports.leftover, 0);
	console.log('Export checks passed:', JSON.stringify(exports));
	const recovery = await page.evaluate(async () => {
		const source = 'flowchart TD\n' + Array.from({ length: 15 }, (_, i) => ` A${i} --> A${i + 1}`).join('\n');
		const item = fixture.diagram(source);
		const wait = () => new Promise(resolve => requestAnimationFrame(resolve));
		await wait();
		const svg = item.host.querySelector('svg.pele');
		const originalViewBox = svg.getAttribute('viewBox');
		item.host.querySelector('.pele-zoom-in')?.click();
		const zoomViewBox = svg.getAttribute('viewBox');
		let copied;
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async items => { copied = await (await items[0].data['text/plain']).text(); } } });
		[...item.host.querySelectorAll('button')].find(button => button.textContent === 'Copy SVG').click();
		for (let i = 0; i < 100 && !copied; i++) await new Promise(resolve => setTimeout(resolve, 10));
		const copiedViewBox = new DOMParser().parseFromString(copied, 'image/svg+xml').documentElement.getAttribute('viewBox');
		item.settings.maxHeight = 'none'; item.child.updateSettings();
		const unlimitedHeight = item.host.querySelector('svg.pele').getBoundingClientRect().height;
		item.host.parentElement.style.setProperty('--text-normal', '#abcdef');
		item.child.refreshTheme();
		const themed = getComputedStyle(item.host.querySelector('svg.pele text')).fill;
		item.settings.theme.text = '#123456'; item.child.updateSettings();
		const custom = getComputedStyle(item.host.querySelector('svg.pele text')).fill;
		delete item.settings.theme.text; item.child.updateSettings();
		const reset = getComputedStyle(item.host.querySelector('svg.pele text')).fill;
		// A revision change during asynchronous export must not publish stale output.
		let staleWrites = 0;
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async items => { await items[0].data['text/plain']; staleWrites++; } } });
		[...item.host.querySelectorAll('button')].find(button => button.textContent === 'Copy SVG').click();
		item.child.refreshTheme();
		await new Promise(resolve => setTimeout(resolve, 50));
		const staleStatus = item.host.querySelector('[role=status]').textContent;
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
		const unsupported = fixture.diagram('flowchart LR\n A-->B');
		const pngDisabled = [...unsupported.host.querySelectorAll('button')].find(button => button.textContent === 'Copy PNG').disabled;
		[...unsupported.host.querySelectorAll('button')].find(button => button.textContent === 'Copy SVG').click();
		for (let i = 0; i < 100 && !document.querySelector('textarea'); i++) await new Promise(resolve => setTimeout(resolve, 10));
		const fallback = document.querySelector('textarea')?.value.startsWith('<svg');
		unsupported.child.unload();
		const modalAfterUnload = document.querySelector('.modal') !== null;
		item.child.unload();
		return { zoomed: originalViewBox !== zoomViewBox, exportIgnoresZoom: copiedViewBox === originalViewBox, unlimitedHeight, themed, custom, reset, staleWrites, staleStatus, pngDisabled, fallback, modalAfterUnload };
	});
	assert.equal(recovery.zoomed, true);
	assert.equal(recovery.exportIgnoresZoom, true);
	assert.ok(recovery.unlimitedHeight > 400);
	assert.equal(recovery.themed, 'rgb(171, 205, 239)');
	assert.equal(recovery.custom, 'rgb(18, 52, 86)');
	assert.equal(recovery.reset, recovery.themed);
	assert.equal(recovery.staleWrites, 0);
	assert.equal(recovery.staleStatus, '');
	assert.equal(recovery.pngDisabled, true);
	assert.equal(recovery.fallback, true);
	assert.equal(recovery.modalAfterUnload, false);
	console.log('Theme, zoom, unavailable clipboard and stale-export checks passed:', JSON.stringify(recovery));
	const formats = await page.evaluate(async () => {
		const sources = [
			'sequenceDiagram\n Alice->>Bob: Hello Ω',
			'pie title Distribution\n "First": 40\n "Second": 60',
			'flowchart LR\n A["<tag> & Ω"] --> B\n style A fill:#123456,color:#ffffff',
		];
		const results = [];
		for (const source of sources) {
			const item = fixture.diagram(source, { theme: { background: '#111111', text: '#eeeeee', line: '#eeeeee', font: 'monospace' } });
			const snapshot = await fixture.createSvgSnapshot(fixture.render(source, { images: false, fontFamily: 'monospace' }), item.host, () => true);
			results.push({ noVariables: !snapshot.svg.includes('var('), dark: snapshot.svg.includes('rgb(17, 17, 17)'), authored: snapshot.svg.includes('rgb(18, 52, 86)') });
			item.child.unload();
		}
		const item = fixture.diagram('flowchart LR\n A-->B');
		const snapshot = await fixture.createSvgSnapshot(fixture.render('flowchart LR\n A-->B'), item.host, () => true);
		const toBlob = HTMLCanvasElement.prototype.toBlob;
		HTMLCanvasElement.prototype.toBlob = callback => callback(null);
		let encodingFailure = false;
		try { await fixture.createPng(snapshot, document, new AbortController().signal); } catch (error) { encodingFailure = error.message.includes('encode'); }
		finally { HTMLCanvasElement.prototype.toBlob = toBlob; }
		const abort = new AbortController(); abort.abort();
		let cancelled = false;
		try { await fixture.createPng(snapshot, document, abort.signal); } catch (error) { cancelled = error.message.includes('cancelled'); }
		let stale = false;
		try { await fixture.createSvgSnapshot(fixture.render('flowchart LR\n A-->B'), item.host, () => false); } catch (error) { stale = error.message.includes('changed'); }
		item.child.unload();
		return { results, encodingFailure, cancelled, stale, snapshots: document.querySelectorAll('.advanced-mermaid-snapshot').length };
	});
	assert.ok(formats.results.every(item => item.noVariables && item.dark));
	assert.equal(formats.results[2].authored, true);
	assert.equal(formats.encodingFailure, true);
	assert.equal(formats.cancelled, true);
	assert.equal(formats.stale, true);
	assert.equal(formats.snapshots, 0);
	console.log('Additional diagram families, dark export and failure cleanup checks passed:', JSON.stringify(formats));
	await runInlineEditorChecks(page);
	await runPresetChecks(page);
	await runEditorModeChecks(page);
	await runInlineLayoutChecks(page);
	await runInlineLayoutChecks(page, 'Minimal');
	if (!process.argv.includes('--inline')) {
		await runInlineSettingsChecks(page);
		await runPostTestChecks(page);
	}
} finally {
	await browser?.close();
	await new Promise(resolve => server.close(resolve));
}
