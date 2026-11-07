import assert from 'node:assert/strict';

/** Real keyboard events in nested CodeMirror with a bounded note scroller. */
export async function runEditorInteractionChecks(page) {
	await page.evaluate(() => {
		const host = document.body.createDiv(); host.style.cssText = 'width:900px;margin:0 auto';
		const settings = fixture.normalizeSettings({ liveEditor: { activation: 'focused-block' } });
		const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const text = 'Before\n'.repeat(30) + '\n```pele\nflowchart LR\n A[Start] --> B[End]\n```\n\n' + 'After\n'.repeat(50);
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		// Stress a host requesting that its own hidden fence cursor be revealed
		// after note changes, while source editing owns focus in the widget.
		const followParent = fixture.EditorView.updateListener.of(update => {
			if (update.docChanged) queueMicrotask(() => { if (window.interactions) update.view.dispatch({ effects: fixture.EditorView.scrollIntoView(update.view.state.selection.main.head) }); });
		});
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({ doc: text, extensions: [language, fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension, followParent] }) });
		view.dom.style.height = '650px'; view.scrollDOM.style.overflow = 'auto';
		view.dispatch({ selection: { anchor: text.indexOf('flowchart') } });
		const keys = []; host.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === 'Tab') keys.push(event.key); });
		const modeEvents = []; host.addEventListener('click', event => { if (event.target.closest('.advanced-mermaid-editor-mode')) modeEvents.push('click'); });
		window.interactions = { host, settings, inline, view, keys, modeEvents };
	});
	try {
		const content = page.locator('.advanced-mermaid-editor-source .cm-content');
		await content.click(); await page.keyboard.press('Control+End');
		await page.waitForTimeout(150);
		const before = await page.evaluate(() => ({ note: interactions.view.scrollDOM.scrollTop, page: scrollY }));
		for (let i = 0; i < 5; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(80); }
		const after = await page.evaluate(() => ({ note: interactions.view.scrollDOM.scrollTop, page: scrollY }));
		console.log('Enter scroll regression:', JSON.stringify({ before, after }));
		assert.ok(Math.abs(after.note - before.note) <= 2 && Math.abs(after.page - before.page) <= 2, 'Enter must keep the surrounding note at the same scroll position');
		await page.keyboard.type('B --> C[Next]');
		const original = await page.evaluate(() => interactions.view.state.doc.toString());
		await page.keyboard.press('Home'); await page.keyboard.press('Tab');
		assert.equal(await content.evaluate(element => element.contains(element.ownerDocument.activeElement)), true, 'Tab keeps source focus');
		assert.notEqual(await page.evaluate(() => interactions.view.state.doc.toString()), original, 'Tab indents source');
		await page.keyboard.press('Shift+Tab');
		assert.equal(await page.evaluate(() => interactions.view.state.doc.toString()), original, 'Shift+Tab reverses indentation');
		await page.keyboard.press('Control+Home'); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown');
		const beforeIndent = await page.evaluate(() => interactions.view.state.doc.toString());
		await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
		assert.equal(await page.evaluate(() => interactions.view.state.doc.toString()), beforeIndent, 'Multi-line indentation round trips');
		assert.deepEqual(await page.evaluate(() => interactions.keys), [], 'Source editing keys must not reach note keyboard handlers');
		const bar = page.locator('.advanced-mermaid-editor-mode').first();
		assert.deepEqual(await bar.locator('button').allTextContents(), ['Rendered View', 'Live Editor', 'Static Editor']);
		assert.equal(await page.getByRole('button', { name: 'Close Editor', exact: true }).count(), 0);
		await bar.getByRole('button', { name: 'Rendered View', exact: true }).click();
		await page.waitForTimeout(120);
		assert.equal(await page.locator('.advanced-mermaid-editor').count(), 0);
		assert.equal(await bar.getByRole('button', { name: 'Rendered View', exact: true }).getAttribute('aria-pressed'), 'true');
		assert.deepEqual(await page.evaluate(() => interactions.modeEvents), [], 'Mode controls must not trigger note click handlers');
		assert.equal(await page.evaluate(() => {
			const head = interactions.view.state.selection.main.head; const text = interactions.view.state.doc.toString();
			return head < text.indexOf('```pele') || head > text.indexOf('```', text.indexOf('```pele') + 3) + 3;
		}), true, 'Close moves the note cursor outside the fence');
		await bar.getByRole('button', { name: 'Static Editor', exact: true }).click();
		assert.equal(await bar.getByRole('button', { name: 'Static Editor', exact: true }).getAttribute('aria-pressed'), 'true');
		await bar.getByRole('button', { name: 'Rendered View', exact: true }).click();
		assert.equal(await bar.getByRole('button', { name: 'Rendered View', exact: true }).getAttribute('aria-pressed'), 'true');
		await bar.getByRole('button', { name: 'Live Editor', exact: true }).click();
		await content.click(); await page.keyboard.press('Escape'); await page.waitForTimeout(120);
		assert.equal(await page.locator('.advanced-mermaid-editor').count(), 0);
		assert.equal(await bar.getByRole('button', { name: 'Rendered View', exact: true }).getAttribute('aria-pressed'), 'true');
		const edgeCases = await page.evaluate(async () => {
			const { view, host, inline } = interactions; const pause = () => new Promise(resolve => setTimeout(resolve, 60));
			const first = '```pele\nflowchart LR\n A-->B\n```';
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: first }, selection: { anchor: 1 } }); await pause();
			const choose = name => [...host.querySelector('.advanced-mermaid-editor-mode').querySelectorAll('button')].find(button => button.textContent === name).click();
			choose('Live Editor'); await pause(); choose('Rendered View'); await pause();
			const fenceOnly = view.state.doc.toString() === first + '\n' && view.state.selection.main.head === view.state.doc.length && !host.querySelector('.advanced-mermaid-editor');
			choose('Live Editor'); await pause(); const toggled = inline.toggle(); await pause();
			const toggleCloses = toggled && !host.querySelector('.advanced-mermaid-editor') && host.querySelector('[aria-pressed="true"]').textContent === 'Rendered View';
			const second = '\n~~~mermaid\nflowchart LR\n C-->D\n~~~';
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: first + second }, selection: { anchor: 1 } }); await pause();
			choose('Live Editor'); await pause(); choose('Rendered View'); await pause();
			const adjacent = view.state.doc.toString() === first + '\n' + second && !host.querySelector('.advanced-mermaid-editor');
			return { fenceOnly, toggleCloses, adjacent };
		});
		for (const [name, value] of Object.entries(edgeCases)) assert.equal(value, true, name);
		console.log('Editor interaction checks passed: Enter scroll stability, Tab/back-tab, multiline indentation, rendered/static/live transitions and Escape.');
	} finally {
		await page.evaluate(() => { interactions.view.destroy(); interactions.inline.destroy(); interactions.host.remove(); delete window.interactions; });
	}
}

export async function runNavigationChecks(page) {
	for (const mode of ['markdown-source-view mod-cm6', 'markdown-preview-view']) for (const fillAvailable of [false, true]) {
		await page.evaluate(({ mode, fillAvailable }) => {
			const parent = document.body.createDiv({ cls: mode }); parent.style.width = '600px';
			const item = fixture.diagram('flowchart LR\n A[Small]', { fillAvailable }, parent);
			window.navigation = { parent, item };
		}, { mode, fillAvailable });
		try {
			const host = page.locator('.fixture-diagram').last();
			for (const label of ['Zoom In', 'Zoom Out', 'Reset Zoom']) assert.equal(await host.getByRole('button', { name: label, exact: true }).isVisible(), true, mode + ': ' + label);
			assert.equal(await host.getByRole('button', { name: 'Zoom In', exact: true }).isEnabled(), true, 'Enlarged small diagrams can zoom beyond their fitted scale');
			const original = await host.locator('svg.pele').getAttribute('viewBox');
			await host.getByRole('button', { name: 'Zoom In', exact: true }).click();
			const zoomed = await host.locator('svg.pele').getAttribute('viewBox'); assert.notEqual(zoomed, original);
			const bounds = await host.locator('svg.pele').boundingBox();
			await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 35, bounds.y + bounds.height / 2 + 10, { steps: 4 }); await page.mouse.up();
			const panned = await host.locator('svg.pele').getAttribute('viewBox');
			assert.notEqual(panned, zoomed, 'Mouse drag pans');
			await host.locator('svg.pele').focus(); await page.keyboard.press('ArrowRight');
			assert.notEqual(await host.locator('svg.pele').getAttribute('viewBox'), panned, 'Arrow keys pan');
			await host.getByRole('button', { name: 'Reset Zoom', exact: true }).click(); assert.equal(await host.locator('svg.pele').getAttribute('viewBox'), original);
			assert.equal(await host.getByRole('button', { name: 'Reset Zoom', exact: true }).isVisible(), true);
			assert.equal(await host.evaluate(element => {
				const svg = element.querySelector('svg.pele').getBoundingClientRect(); const rail = element.querySelector('.pele-zoom').getBoundingClientRect();
				return rail.left >= svg.right && rail.right <= element.getBoundingClientRect().right + 1;
			}), true, 'Navigation stays beside the diagram within its pane');
		} finally { await page.evaluate(() => { navigation.item.child.unload(); navigation.parent.remove(); delete window.navigation; }); }
	}
	console.log('Navigation checks passed: small rendered diagrams in source/reading surfaces, full zoom stack, pointer pan, keyboard pan, reset and non-overlapping controls.');
}
