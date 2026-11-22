import assert from 'node:assert/strict';

export async function runLiveExportChecks(page) {
	const source = '---\r\ntitle: Café 🧭\r\n---\r\n%% authored comment\r\ngraph LR\r\n A[Élan] --> B\r\n style A fill:#abe\r\n';
	await page.evaluate(source => {
		const host = document.body.createDiv({ cls: 'live-export-fixture' });
		const settings = fixture.normalizeSettings({ style: { diagrams: { flowchart: {
			frontmatter: { enabled: true, yaml: 'config:\n  flowchart: {rankSpacing: 150}' },
		} } } });
		const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({
			doc: '```pele\r\n' + source + '```',
			extensions: [fixture.EditorState.lineSeparator.of('\r\n'), language, fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension],
		}) });
		view.dispatch({ selection: { anchor: 10 } }); view.focus(); inline.toggle();
		window.liveExport = { host, view, inline };
	}, source);
	const host = page.locator('.live-export-fixture');
	const footer = host.locator('.advanced-mermaid-editor-footer');
	const right = footer.locator('.advanced-mermaid-editor-end-actions');
	const status = footer.locator('.advanced-mermaid-export-status');
	const button = (name, root = right) => root.getByRole('button', { name, exact: true });
	const disclosure = button('Export');
	const save = button('Save', page);
	const edit = body => page.evaluate(body => {
		const { view } = liveExport;
		const { bodyFrom, bodyTo } = fixture.fenceAt(view.state, 10);
		const change = typeof body === 'string' ? { from: bodyFrom, to: bodyTo, insert: body.replaceAll('\n', '\r\n') }
			: { from: bodyTo, insert: '\r\n%% changed during dialog' };
		view.dispatch({ changes: change });
	}, body);
	try {
		await disclosure.waitFor();
		assert.deepEqual(await right.getByRole('button').allTextContents(), ['Export']);
		await disclosure.press('Enter');
		const copy = right.locator('.advanced-mermaid-export-copy');
		const saves = right.locator('.advanced-mermaid-export-save');
		assert.deepEqual(await copy.getByRole('button').allTextContents(), ['Copy SVG', 'Copy PNG']);
		assert.deepEqual(await saves.getByRole('button').allTextContents(), ['Save SVG', 'Save PNG', 'Save .canvas', 'Save .mmd', 'Save .mermaid']);
		assert.ok(await saves.evaluate(el => getComputedStyle(el).borderInlineStartWidth === '1px'));
		assert.ok(await button('Copy SVG').evaluate(el => el === document.activeElement));
		await page.keyboard.press('Tab');
		assert.ok(await button('Copy PNG').evaluate(el => el === document.activeElement || el.disabled));
		await button('Collapse export').press('Enter');
		assert.ok(await disclosure.evaluate(el => el === document.activeElement));
		await disclosure.click();

		for (const extension of ['mmd', 'mermaid', 'mmd']) {
			await button(`Save .${extension}`).click();
			assert.equal(await host.locator('.advanced-mermaid-snapshot').count(), 0);
			await save.click();
			await status.filter({ hasText: /^Saved / }).waitFor({ timeout: 5000 }).catch(async error => {
				throw new Error(`Save .${extension}: ${await footer.innerText()} ${await page.locator('.modal').allTextContents()}`, { cause: error });
			});
		}
		const outputs = await page.evaluate(() => [...fixture.saved].filter(([path]) => /\.(mmd|mermaid)$/.test(path)));
		assert.equal(outputs.length, 3);
		assert.match(outputs.at(-1)[0], /-2\.mmd$/);
		for (const [, text] of outputs) assert.equal(text, source.slice(0, -2));
		for (const width of [960, 320]) {
			await host.evaluate((el, width) => { el.style.width = `${width}px`; }, width);
			assert.ok(await footer.evaluate(el => {
				const bounds = el.getBoundingClientRect();
				const groups = [...el.querySelectorAll('button')].filter(button => button.checkVisibility()).map(button => button.getBoundingClientRect());
				const feedback = el.querySelector('.advanced-mermaid-export-status').getBoundingClientRect();
				return groups.every(box => box.left >= bounds.left && box.right <= bounds.right + 1 && box.bottom <= feedback.top)
					&& Math.abs(groups[0].left - bounds.left) < 1 && Math.abs(groups.at(-1).right - bounds.right) < 1;
			}), `Footer fits at ${width}px`);
		}

		await host.getByRole('tab', { name: 'SVG', exact: true }).click();
		await button('Save .mmd').click();
		await button('Cancel', page).click();
		await status.filter({ hasText: 'Export cancelled.' }).waitFor();
		await host.getByRole('tab', { name: 'Pele', exact: true }).click();
		await button('Save .mermaid').click();
		await page.evaluate(() => {
			liveExport.create = fixture.app.vault.create;
			fixture.app.vault.create = () => Promise.reject(new Error('Fixture write failed.'));
		});
		await save.click();
		await page.getByText('Fixture write failed.', { exact: true }).waitFor();
		await page.evaluate(() => { fixture.app.vault.create = liveExport.create; });
		await edit(null);
		await save.click();
		await page.getByText('The diagram changed. Export it again.', { exact: true }).waitFor();
		await button('Cancel', page).click();
		await edit('flowchart LR\n A[unclosed');
		await button('Render now', footer).click();
		await host.locator('.advanced-mermaid-stale').waitFor();
		assert.equal(await button('Save .mmd').count(), 0);
		await edit('pie\n "Apples": 3');
		await button('Render now', footer).click();
		await button('Save .mmd').waitFor();
		assert.equal(await button('Save .canvas').count(), 0);
		await button('Save .mmd').click();
		await page.evaluate(() => liveExport.inline.destroy());
		await save.waitFor({ state: 'detached' });
		assert.equal(await page.evaluate(() => [...fixture.saved].filter(([path]) => /\.(mmd|mermaid)$/.test(path)).length), 3);
	} finally {
		await page.evaluate(() => {
			if (liveExport.create) fixture.app.vault.create = liveExport.create;
			liveExport.inline.destroy(); liveExport.view.destroy(); liveExport.host.remove();
			for (const path of fixture.saved.keys()) if (/\.(mmd|mermaid)$/.test(path)) fixture.saved.delete(path);
		});
	}
	console.log('Live export checks passed: disclosure, footer layout, exact authored source, collisions, and modal lifecycle.');
}
