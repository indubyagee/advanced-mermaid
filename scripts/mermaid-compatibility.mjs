import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { referenceCases, referenceDeltas, previewSamples } from './mermaid-reference-cases.mjs';

// Install the pinned comparison packages in the ignored prefix described in the
// technical reference. Only the plugin's installed Pele version enters timing.
const prefix = resolve('.local/mermaid-12-3-reference');
const pins = { mermaid: '12.3.0', 'pele-baseline': '1.12.0', pele: '1.13.0' };
for (const [name, version] of Object.entries(pins)) {
	const pkg = JSON.parse(await readFile(resolve(prefix, 'node_modules', name, 'package.json'), 'utf8'));
	assert.equal(pkg.version, version, name);
}
const [engines, editor, css] = await Promise.all([
	build({
		stdin: {
			contents: "export { default as mermaid } from 'mermaid'; export * as baseline from 'pele-baseline'; export * as candidate from 'pele';",
			resolveDir: prefix,
		},
		bundle: true, write: false, format: 'iife', globalName: 'engines',
	}),
	build({
		entryPoints: ['tests/browser-entry.ts'],
		bundle: true, write: false, format: 'iife', globalName: 'fixture',
		alias: { obsidian: resolve('tests/obsidian.ts') },
	}),
	readFile('styles.css', 'utf8'),
]);
const browser = await chromium.launch({ channel: process.env.ADVANCED_MERMAID_BROWSER || 'msedge', headless: true });
try {
	const page = await browser.newPage({ viewport: { width: 1100, height: 850 }, reducedMotion: 'reduce' });
	await page.route('**/*', route => route.abort());
	await page.setContent('<!doctype html><style>body { font-family: Arial; --font-text: Arial; }' + css + '</style>');
	await page.addScriptTag({ content: engines.outputFiles[0].text });
	const capabilities = await page.evaluate(async ({ cases, deltas }) => {
		const { mermaid, baseline, candidate } = engines;
		mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', deterministicIds: true, deterministicIDSeed: 'reference' });
		const options = { images: false, now: new Date('2026-01-02T00:00:00Z') };
		let sequence = 0;
		const renderMermaid = async (source) => {
			const { diagramType } = await mermaid.parse(source);
			const { svg } = await mermaid.render('reference-' + ++sequence, source);
			return { type: diagramType, svg };
		};
		const renderPele = (lib, source) => {
			const model = lib.parse(source);
			const result = lib.render(source, options);
			return { ...result, diagnostics: model.diagnostics?.map(item => item.id) };
		};
		const renderers = [renderMermaid, source => renderPele(baseline, source), source => renderPele(candidate, source)];

		const summarize = ({ svg, type, diagnostics }, probe) => {
			const host = document.body.appendChild(document.createElement('div'));
			try {
				// The three renderers receive only the checked-in comparison fixtures.
				host.innerHTML = svg;
				const diagram = host.querySelector('svg');
				if (!diagram || diagram.viewBox.baseVal.width <= 0 || diagram.viewBox.baseVal.height <= 0) {
					throw new Error('Renderer returned an empty SVG.');
				}
				const result = { type };
				if (diagnostics?.length) result.diagnostics = diagnostics;
				if (probe.selector) result.matches = diagram.querySelectorAll(probe.selector).length;
				if (probe.labels) {
					result.labels = probe.labels.map(label => {
						const text = [...diagram.querySelectorAll('text, .nodeLabel')].find(element => element.textContent.trim() === label);
						if (!text) return null;
						const bounds = text.getBoundingClientRect();
						const node = text.closest('g.node, .pele-node, .mindmap-node, .er.entityBox, .pele-entity');
						const shape = node?.querySelector('rect, path, polygon, circle, ellipse');
						return { x: Math.round(bounds.x), y: Math.round(bounds.y), shape: shape?.tagName, fill: shape && getComputedStyle(shape).fill };
					});
				}
				return result;
			} finally {
				host.remove();
			}
		};

		const rows = [];
		for (const probe of [...cases, ...deltas]) {
			const results = [];
			for (const render of renderers) {
				try {
					const result = await render(probe.source);
					const summary = summarize(result, probe);
					if (probe.control) {
						const control = await render(probe.control);
						summary.control = summarize(control, probe);
						if (render !== renderMermaid) summary.sameSvg = result.svg === control.svg;
					}
					results.push(summary);
				} catch (error) {
					results.push({ code: error.code ?? error.name, error: String(error.message ?? error).split('\n')[0] });
				}
			}
			rows.push({ family: probe.family, name: probe.name ?? probe.declaration, results });
		}
		return rows;
	}, { cases: referenceCases, deltas: referenceDeltas });
	for (const [index, { family, declaration }] of referenceCases.entries()) {
		const [mermaid, baseline, candidate] = capabilities[index].results;
		if (declaration === 'agentflow LR') {
			assert.equal(mermaid.code, 'UnknownDiagramError');
			assert.equal(baseline.code, 'unsupported-diagram');
			assert.equal(candidate.code, 'unsupported-diagram');
		} else {
			assert.ok(mermaid.type, declaration + ' in Mermaid 12.3.0');
			assert.equal(baseline.type, family, declaration + ' in Pele 1.12.0');
			assert.equal(candidate.type, family, declaration + ' in Pele 1.13.0');
		}
	}
	const result = name => capabilities.find(row => row.name === name).results;
	assert.equal(result('Flowchart numbered steps')[0].matches, 2);
	assert.equal(result('Flowchart numbered steps')[0].control.matches, 0);
	assert.equal(result('Flowchart BPMN start node')[0].matches, 1);
	assert.ok(result('Flowchart plain link and circle link').every(variant => variant.matches === 1));
	assert.ok(result('Swimlane nested subgraph').every(variant => variant.matches === 3));
	assert.ok(result('ER nested subgraph').every(variant => variant.matches === 1));
	const [mindmap] = result('Mindmap depth colors');
	assert.equal(mindmap.labels[0].fill, mindmap.labels[2].fill);
	assert.notEqual(mindmap.labels[0].fill, mindmap.labels[1].fill);
	assert.notEqual(mindmap.control.labels[0].fill, mindmap.control.labels[2].fill);
	const [shortInput, ...peleInputs] = result('Agentflow input shorthand');
	assert.equal(shortInput.labels[0].shape, 'polygon');
	assert.ok(peleInputs.every(input => input.control.labels[0].shape === 'polygon'));
	for (const direction of result('ER left-to-right')) {
		assert.ok(direction.labels[0].x < direction.labels[2].x);
		assert.ok(direction.control.labels[0].y < direction.control.labels[2].y);
	}
	await page.addScriptTag({ content: editor.outputFiles[0].text });
	const timings = await page.evaluate(async samples => {
		const results = {};
		for (const [name, source] of Object.entries(samples)) {
			const host = document.body.createDiv();
			host.style.width = '960px';
			const settings = fixture.normalizeSettings(null);
			const inline = fixture.createInlineExtension(fixture.app, () => settings);
			const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
			const view = new fixture.EditorView({
				parent: host,
				state: fixture.EditorState.create({
					doc: '\x60\x60\x60mermaid\n' + source + '\n\x60\x60\x60\n',
					extensions: [language, fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension],
				}),
			});
			try {
				view.dispatch({ selection: { anchor: 11 } });
				view.focus();
				if (!inline.toggle()) throw new Error('Could not open Live Editor for ' + name);
				const nested = fixture.EditorView.findFromDOM(fixture.sourceRoot(host).querySelector('.cm-editor'));
				const from = nested.state.doc.toString().indexOf('Sample 00');
				const visible = label => new Promise((done, reject) => {
					const observer = new MutationObserver(check);
					const timer = setTimeout(() => {
						observer.disconnect();
						reject(new Error(name + ' preview did not show ' + label));
					}, 5000);
					function check() {
						const svg = host.querySelector('.advanced-mermaid-mount svg.pele');
						if (svg?.textContent.includes(label)) {
							observer.disconnect();
							clearTimeout(timer);
							done();
						}
					}
					observer.observe(host, { childList: true, subtree: true, characterData: true });
					check();
				});
				await visible('Sample 00');
				const measured = [];
				for (let index = 1; index <= 15; index++) {
					const label = 'Sample ' + String(index).padStart(2, '0');
					const start = performance.now();
					nested.dispatch({ changes: { from, to: from + label.length, insert: label } });
					await visible(label);
					if (index > 3) measured.push(performance.now() - start);
				}
				measured.sort((a, b) => a - b);
				const percentile = fraction => Math.round(measured[Math.ceil(fraction * measured.length) - 1] * 10) / 10;
				results[name] = { samples: measured.length, debounceMs: settings.liveEditor.debounceMs, medianMs: percentile(0.5), p95Ms: percentile(0.95) };
			} finally {
				inline.destroy();
				view.destroy();
				host.remove();
			}
		}
		return results;
	}, previewSamples);
	console.log(JSON.stringify({
		columns: ['Mermaid ' + pins.mermaid, 'Pele ' + pins['pele-baseline'], 'Pele ' + pins.pele],
		browser: browser.version(),
		installedPele: JSON.parse(await readFile('node_modules/pele/package.json', 'utf8')).version,
		capabilities,
		timings,
	}, null, 2));
} finally {
	await browser.close();
}
