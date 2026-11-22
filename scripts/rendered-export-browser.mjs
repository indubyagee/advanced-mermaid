import assert from 'node:assert/strict';

export async function runRenderedExportChecks(page) {
	const flow = '---\r\ntitle: Café 🧭\r\n---\r\n%% advanced-mermaid: align=right\r\n%% Authored comment\r\ngraph LR\r\n A[Élan] --> B\r\n style A fill:#abe';
	const chart = 'pie\r\n "Apples": 3';
	await page.evaluate(({ flow, chart }) => {
		const host = document.body.createDiv({ cls: 'rendered-export-fixture' });
		const settings = fixture.normalizeSettings({ style: { diagrams: { flowchart: {
			frontmatter: { enabled: true, yaml: 'config:\n  flowchart: {rankSpacing: 150}' },
		} } } });
		const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const note = `Before\r\n\r\n\x60\x60\x60pele\r\n${flow}\r\n\x60\x60\x60\r\n\r\n\x60\x60\x60mermaid\r\n${chart}\r\n\x60\x60\x60\r\n\r\nAfter`;
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({ doc: note, extensions: [
			fixture.EditorState.lineSeparator.of('\r\n'), language, fixture.editorLivePreviewField,
			fixture.editorInfoField.init(() => ({ file: { path: 'RenderedExport.md' } })), inline.extension,
		] }) });
		window.renderedExport = { host, view, inline, snapshots: 0 };
		const observer = new MutationObserver(records => {
			for (const record of records) for (const element of record.addedNodes) {
				if (element instanceof Element && (element.matches('.advanced-mermaid-snapshot') || element.querySelector('.advanced-mermaid-snapshot'))) renderedExport.snapshots++;
			}
		});
		observer.observe(host, { subtree: true, childList: true });
		renderedExport.observer = observer;
	}, { flow, chart });
	const host = page.locator('.rendered-export-fixture');
	const previews = host.locator('.advanced-mermaid-rendered-preview');
	const flowPreview = previews.first();
	const chartPreview = previews.last();
	const button = (root, label) => root.getByRole('button', { name: label, exact: true });
	const save = button(page, 'Save');
	const status = preview => preview.locator('.advanced-mermaid-export-status');
	const exports = () => page.evaluate(() => [...fixture.saved].filter(([path]) => path.startsWith('RenderedExport-diagram-')));
	try {
		assert.equal(await previews.count(), 2);
		const toolbar = flowPreview.locator('.advanced-mermaid-actions');
		assert.deepEqual(await toolbar.getByRole('button').allTextContents(), ['Export']);
		await button(toolbar, 'Export').press('Enter');
		assert.ok(await button(toolbar, 'Copy SVG').evaluate(el => el === document.activeElement));
		assert.deepEqual(await toolbar.locator('.advanced-mermaid-export-copy button').allTextContents(), ['Copy SVG', 'Copy PNG']);
		assert.deepEqual(await toolbar.locator('.advanced-mermaid-export-save button').allTextContents(), ['Save SVG', 'Save PNG', 'Save .canvas', 'Save .mmd', 'Save .mermaid']);
		assert.equal(await toolbar.locator('.advanced-mermaid-export-save').evaluate(el => getComputedStyle(el).borderInlineStartWidth), '1px');
		for (const width of [900, 320]) {
			await host.evaluate((el, width) => { el.style.width = `${width}px`; }, width);
			await flowPreview.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
			assert.ok(await toolbar.evaluate(el => {
				const layout = el.closest('.advanced-mermaid-layout').getBoundingClientRect();
				const controls = [...el.querySelectorAll('button')].filter(button => button.checkVisibility()).map(button => button.getBoundingClientRect());
				return controls.every(box => box.left >= layout.left - 1 && box.right <= layout.right + 1)
					&& Math.abs(controls.at(-1).right - layout.right) < 1;
			}), `Toolbar is right-aligned and fits at ${width}px`);
		}
		for (const [preview, extension] of [[flowPreview, 'mmd'], [flowPreview, 'mmd'], [chartPreview, 'mermaid']]) {
			if (preview === chartPreview) {
				await button(chartPreview, 'Export').click();
				assert.equal(await button(chartPreview, 'Save .canvas').count(), 0);
			}
			await button(preview, `Save .${extension}`).click();
			await save.click();
			await status(preview).filter({ hasText: /^Saved / }).waitFor();
		}
		const files = await exports();
		assert.equal(files.length, 3);
		assert.ok(files.some(([path]) => path.endsWith('-2.mmd')));
		for (const [path, text] of files) assert.equal(text, path.endsWith('.mmd') ? flow : chart);
		assert.equal(await page.evaluate(() => renderedExport.snapshots), 0);
		await button(flowPreview, 'Save .canvas').click();
		await save.click();
		await button(flowPreview, 'Collapse export').press('Enter');
		assert.ok(await button(flowPreview, 'Export').evaluate(el => el === document.activeElement));
		await button(flowPreview, 'Open canvas').click();
		assert.ok(await page.evaluate(() => fixture.opened.some(path => /^RenderedExport-diagram-.*\.canvas$/.test(path))));
		await button(chartPreview, 'Save .mermaid').click();
		await page.evaluate(() => {
			const { view } = renderedExport;
			const offset = view.state.doc.toString().indexOf('Apples');
			view.dispatch({ changes: { from: offset, to: offset + 6, insert: 'Pears' } });
		});
		await save.waitFor({ state: 'detached' });
		assert.equal((await exports()).length, 4);
		await button(chartPreview, 'Export').click();
		await button(chartPreview, 'Save .mermaid').click();
		await save.click();
		await status(chartPreview).filter({ hasText: /^Saved / }).waitFor();
		assert.equal((await exports()).at(-1)[1], chart.replace('Apples', 'Pears'));
	} finally {
		await page.evaluate(() => {
			const { observer, host, view, inline } = renderedExport;
			observer.disconnect(); view.destroy(); inline.destroy(); host.remove();
			for (const path of fixture.saved.keys()) if (path.startsWith('RenderedExport-diagram-')) fixture.saved.delete(path);
			delete window.renderedExport;
		});
	}
	console.log('Rendered export checks passed: both fence languages, exact source, narrow layout, keyboard disclosure, Canvas, and stale dialog replacement.');
}
