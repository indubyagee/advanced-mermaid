import assert from 'node:assert/strict';

/** Live Preview's native Mermaid widget bypasses Markdown code block processors. */
export async function runMermaidPreviewChecks(page) {
	await page.evaluate(async () => {
		const plugin = new fixture.AdvancedMermaidPlugin(fixture.app, { id: 'mermaid-preview-fixture' });
		plugin.data = { schemaVersion: 4, alignment: 'right', style: { global: { colors: { text: { light: '#123456', dark: '#654321' } } } } };
		await plugin.onload();
		const source = 'Before\n\n```mermaid\nflowchart LR\n A[Global] --> B[Settings]\n```\n\n~~~mermaid\n%% advanced-mermaid: align=left\n%% advanced-mermaid-style:v1\n%% .pele { --pele-fg: #abcdef; }\n%% advanced-mermaid-style:end\nflowchart LR\n C[Local] --> D[Overrides]\n~~~\n\nAfter';
		class NativeMermaid extends fixture.WidgetType {
			toDOM() { const element = document.createElement('div'); element.className = 'fixture-native-mermaid'; element.textContent = 'Native Mermaid'; return element; }
		}
		const nativeDecorations = state => fixture.Decoration.set(fixture.diagramFences(state)
			.filter(range => range.language === 'mermaid' && state.field(fixture.editorLivePreviewField, false) && !state.selection.ranges.some(selection => selection.from <= range.to && selection.to >= range.from))
			.map(range => fixture.Decoration.replace({ block: true, widget: new NativeMermaid() }).range(range.from, range.to)), true);
		const native = fixture.StateField.define({ create: nativeDecorations, update: (_old, transaction) => nativeDecorations(transaction.state), provide: field => fixture.EditorView.decorations.from(field) });
		const host = document.body.createDiv(); host.style.width = '900px';
		const extension = new fixture.Compartment(); const preview = new fixture.Compartment();
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({ doc: source, extensions: [language, fixture.history(), fixture.editorInfoField, preview.of(fixture.editorLivePreviewField), native, extension.of(plugin.extensions)] }) });
		window.mermaidPreviewFixture = { plugin, host, view, extension, preview, source };
	});
	try {
		const previews = page.locator('.advanced-mermaid-rendered-preview');
		assert.equal(await previews.count(), 2, 'Rendered Live Preview must use Advanced Mermaid without invoking its Markdown processor');
		assert.equal(await page.locator('.fixture-native-mermaid').count(), 0, 'The built-in widget must not render over Advanced Mermaid');
		const initial = await page.evaluate(() => [...mermaidPreviewFixture.host.querySelectorAll('.advanced-mermaid-rendered-preview')].map(host => ({ align: host.dataset.align, text: getComputedStyle(host.querySelector('.pele-label')).fill })));
		assert.deepEqual(initial, [{ align: 'right', text: 'rgb(18, 52, 86)' }, { align: 'left', text: 'rgb(171, 205, 239)' }]);
		const modes = page.locator('.advanced-mermaid-editor-mode').first();
		await modes.getByRole('button', { name: 'Live editor', exact: true }).click();
		assert.equal(await previews.count(), 1); assert.equal(await page.locator('.advanced-mermaid-editor').count(), 1);
		await modes.getByRole('button', { name: 'Rendered view', exact: true }).click();
		assert.equal(await previews.count(), 2); assert.equal(await page.locator('.advanced-mermaid-editor').count(), 0);
		await modes.getByRole('button', { name: 'Static editor', exact: true }).click();
		assert.equal(await previews.count(), 1, 'Selecting source must reveal the original fence');
		await modes.getByRole('button', { name: 'Rendered view', exact: true }).click();
		const updated = await page.evaluate(() => {
			const { plugin, view, host } = mermaidPreviewFixture;
			plugin.settings.style.global.colors.text.light = '#2468ac'; plugin.inline.refresh();
			const from = view.state.doc.toString().indexOf('#abcdef'); view.dispatch({ changes: { from, to: from + 7, insert: '#102030' } });
			return [...host.querySelectorAll('.advanced-mermaid-rendered-preview')].map(host => getComputedStyle(host.querySelector('.pele-label')).fill);
		});
		assert.deepEqual(updated, ['rgb(36, 104, 172)', 'rgb(16, 32, 48)']);
		await page.evaluate(() => document.body.classList.add('theme-dark'));
		await page.waitForFunction(() => getComputedStyle(document.querySelector('.advanced-mermaid-rendered-preview .pele-label')).fill === 'rgb(101, 67, 33)');
		await page.evaluate(() => { const { plugin } = mermaidPreviewFixture; plugin.settings.liveEditor.enabled = false; plugin.inline.refresh(); });
		assert.equal(await previews.count(), 2, 'Rendering must work when the optional inline editor is disabled');
		assert.equal(await page.locator('.advanced-mermaid-editor-mode').count(), 0);
		await page.evaluate(() => { const { view, preview } = mermaidPreviewFixture; view.dispatch({ effects: preview.reconfigure([]) }); });
		assert.equal(await previews.count(), 0, 'Source mode must remain plain Markdown');
		await page.evaluate(() => { const { view, preview } = mermaidPreviewFixture; view.dispatch({ effects: preview.reconfigure(fixture.editorLivePreviewField) }); });
		assert.equal(await previews.count(), 2);
		await page.evaluate(() => { const { view, extension, plugin } = mermaidPreviewFixture; view.dispatch({ effects: extension.reconfigure([]) }); plugin.unload(); });
		assert.equal(await previews.count(), 0); assert.equal(await page.locator('.fixture-native-mermaid').count(), 2, 'Unloading must restore native rendering');
		console.log('Mermaid Live Preview passed: native-widget precedence, global settings, local overrides, settings/source/theme updates, editor transitions, disabled inline editor, Source mode and unload.');
	} finally {
		await page.evaluate(() => { const { view, host, plugin } = mermaidPreviewFixture; view.destroy(); plugin.unload(); host.remove(); document.body.classList.remove('theme-dark'); delete window.mermaidPreviewFixture; });
	}
}
