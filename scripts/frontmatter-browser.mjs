import assert from 'node:assert/strict';

export async function runFrontmatterChecks(page) {
	const settingsReport = await page.evaluate(() => {
		const settings = fixture.normalizeSettings(null);
		let changes = 0;
		const tab = new fixture.AdvancedMermaidSettingTab(fixture.app, {}, settings, () => changes++);
		tab.containerEl = document.body.createDiv(); tab.update();
		const row = name => [...tab.containerEl.querySelectorAll('.setting-item')].find(item => [...item.querySelectorAll('label')].some(label => label.textContent === name));
		row('Diagram-specific style settings').querySelector('button').click();
		const select = category => { const input = tab.containerEl.querySelector('[aria-label="Diagram selection"]'); input.value = category; input.dispatchEvent(new Event('change')); };
		const edit = yaml => { const input = tab.containerEl.querySelector('textarea'); input.value = yaml; input.dispatchEvent(new Event('input')); return input; };
		const categories = [...tab.containerEl.querySelector('select').options].map(option => option.value).filter(Boolean);
		const families = categories.map(category => {
			select(category); const initial = !row('Use custom frontmatter').querySelector('input').checked;
			const yaml = `title: ${category} defaults\nconfig:\n  ${category}: {}`;
			edit(yaml); row('Use custom frontmatter').querySelector('input').click();
			const saved = settings.style.diagrams[category];
			return initial && saved.useGlobal && saved.frontmatter.enabled && saved.frontmatter.yaml === yaml;
		});
		select('flowchart');
		const saved = settings.style.diagrams.flowchart.frontmatter.yaml; const before = changes;
		const invalid = edit('config: [');
		const rejectsInvalid = invalid.getAttribute('aria-invalid') === 'true' && !!tab.containerEl.querySelector('[role="status"]').textContent && settings.style.diagrams.flowchart.frontmatter.yaml === saved && changes === before;
		edit(saved); row('Use custom frontmatter').querySelector('input').click();
		const disabledRetains = !settings.style.diagrams.flowchart.frontmatter.enabled && settings.style.diagrams.flowchart.frontmatter.yaml === saved;
		row('Use global styles').querySelector('input').click(); row('Use global styles').querySelector('input').click();
		const inheritanceRetains = settings.style.diagrams.flowchart.frontmatter.yaml === saved && tab.containerEl.querySelector('textarea').value === saved;
		row('Reset this diagram type').querySelector('button').click();
		const reset = !settings.style.diagrams.flowchart && settings.style.diagrams.sequence.frontmatter.enabled;
		row('Styles reset').querySelector('button').click();
		const undo = settings.style.diagrams.flowchart.frontmatter.yaml === saved && !settings.style.diagrams.flowchart.frontmatter.enabled;
		const roundTrip = { saved: settings, loaded: fixture.normalizeSettings(settings) };
		tab.hide(); tab.containerEl.remove();
		return { count: families.length, families: families.every(Boolean), rejectsInvalid, disabledRetains, inheritanceRetains, reset, undo, roundTrip };
	});
	assert.equal(settingsReport.count, 16);
	assert.deepEqual(settingsReport.roundTrip.loaded, settingsReport.roundTrip.saved);
	for (const [key, value] of Object.entries(settingsReport)) if (!['count', 'roundTrip'].includes(key)) assert.equal(value, true, key);

	const renderingReport = await page.evaluate(async () => {
		const yaml = 'title: Default title\nconfig:\n  flowchart:\n    nodeSpacing: 75\n    rankSpacing: 150';
		const data = { style: { diagrams: { flowchart: { useGlobal: true, frontmatter: { enabled: true, yaml } } } } };
		const source = '---\r\ntitle: Source title\r\nconfig:\r\n  flowchart:\r\n    rankSpacing: 20\r\n---\r\n%% advanced-mermaid: align=right\r\nflowchart TD\r\n A-->B\r\n A-->C';
		const expected = '---\ntitle: Source title\nconfig:\n  flowchart: {nodeSpacing: 75, rankSpacing: 20}\n---\nflowchart TD\n A-->B\n A-->C';
		const item = fixture.diagram(source, data); const reference = fixture.diagram(expected);
		const size = host => { const svg = host.querySelector('svg.pele'); return [svg.getAttribute('width'), svg.getAttribute('height')]; };
		const reading = JSON.stringify(size(item.host)) === JSON.stringify(size(reference.host)) && item.host.textContent.includes('Source title') && item.host.dataset.align === 'right';
		const plain = fixture.diagram('flowchart LR\n A-->B', data);
		const initialWidth = Number(size(plain.host)[0]);
		plain.settings.style.diagrams.flowchart.frontmatter.enabled = false; plain.child.updateSettings();
		await new Promise(resolve => setTimeout(resolve, 60));
		const disabled = !plain.host.textContent.includes('Default title') && Number(size(plain.host)[0]) < initialWidth;
		plain.settings.style.diagrams.flowchart.frontmatter.enabled = true; plain.child.updateSettings();
		await new Promise(resolve => setTimeout(resolve, 60));
		const enabled = plain.host.textContent.includes('Default title') && Number(size(plain.host)[0]) === initialWidth;
		const host = document.body.createDiv();
		const settings = fixture.normalizeSettings(data);
		const controller = new fixture.DiagramController(host, source, () => settings, fixture.app, 'Frontmatter.md'); controller.load();
		const snapshot = await controller.snapshot();
		const exported = new DOMParser().parseFromString(snapshot.svg, 'image/svg+xml');
		const svgExport = snapshot.width === Number(size(reference.host)[0]) && snapshot.height === Number(size(reference.host)[1]) && exported.documentElement.textContent.includes('Source title');
		const png = await fixture.createPng(snapshot, document, new AbortController().signal); const bitmap = await createImageBitmap(png);
		const pngExport = bitmap.width === Math.ceil(snapshot.width * 2) && bitmap.height === Math.ceil(snapshot.height * 2); bitmap.close();
		const other = fixture.diagram('sequenceDiagram\n A->>B: Hello', data);
		const isolated = !other.host.textContent.includes('Default title');
		const badSource = '---\ntitle: Local\nconfig:\n  flowchart: {nodeSpacing: 75}\n---\nflowchart LR\n A[unclosed';
		const bad = fixture.diagram(badSource, data);
		const diagnostic = bad.host.querySelector('.advanced-mermaid-error-message').textContent.includes('line 7');
		for (const entry of [item, reference, plain, other, bad]) { entry.child.unload(); entry.host.remove(); }
		controller.destroy(); host.remove();
		return { reading, disabled, enabled, svgExport, pngExport, isolated, diagnostic };
	});
	for (const [key, value] of Object.entries(renderingReport)) assert.equal(value, true, key);

	for (const fence of ['pele', 'mermaid']) {
		await page.evaluate(fence => {
			const settings = fixture.normalizeSettings({ style: { diagrams: { flowchart: { frontmatter: { enabled: true, yaml: 'title: Inline defaults\nconfig:\n  flowchart: {nodeSpacing: 75, rankSpacing: 150}' } } } } });
			const host = document.body.createDiv(); host.style.width = '900px';
			const inline = fixture.createInlineExtension(fixture.app, () => settings);
			const text = `Before\n\n\`\`\`${fence}\nflowchart TD\n A-->B\n A-->C\n\`\`\`\n\nAfter`;
			const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
			const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({ doc: text, extensions: [language, fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension] }) });
			view.dispatch({ selection: { anchor: text.indexOf('flowchart') } }); view.focus();
			if (!inline.toggle()) throw new Error('Inline editor did not open');
			window.frontmatterFixture = { host, view, inline, settings, text };
		}, fence);
		await page.waitForFunction(() => frontmatterFixture.host.querySelector('svg.pele')?.textContent.includes('Inline defaults'));
		assert.equal(await page.evaluate(() => frontmatterFixture.view.state.doc.toString() === frontmatterFixture.text), true, 'Defaults must not rewrite the note');
		await page.locator('.advanced-mermaid-editor-source .cm-content').click();
		await page.keyboard.press('Control+Home');
		await page.keyboard.insertText('---\ntitle: Inline source\nconfig:\n  flowchart: {rankSpacing: 20}\n---\n');
		await page.waitForFunction(() => frontmatterFixture.host.querySelector('svg.pele')?.textContent.includes('Inline source'));
		const liveReport = await page.evaluate(() => {
			const expected = fixture.diagram('---\ntitle: Inline source\nconfig: {flowchart: {nodeSpacing: 75, rankSpacing: 20}}\n---\nflowchart TD\n A-->B\n A-->C');
			const actualSvg = frontmatterFixture.host.querySelector('svg.pele'); const expectedSvg = expected.host.querySelector('svg.pele');
			const inherited = actualSvg.getAttribute('width') === expectedSvg.getAttribute('width') && actualSvg.getAttribute('height') === expectedSvg.getAttribute('height');
			expected.child.unload(); expected.host.remove();
			const note = frontmatterFixture.view.state.doc.toString();
			return { inherited, sourcePreserved: note.includes('title: Inline source') && !note.includes('nodeSpacing') && !note.includes('Inline defaults') && note.startsWith('Before') && note.endsWith('After') };
		});
		assert.equal(liveReport.inherited, true, fence + ' live inheritance'); assert.equal(liveReport.sourcePreserved, true, fence + ' source preservation');
		await page.locator('.advanced-mermaid-editor [role="tab"]', { hasText: /^SVG$/ }).click();
		await page.waitForFunction(() => frontmatterFixture.host.querySelector('.advanced-mermaid-svg-source').value.includes('Inline source'));
		await page.evaluate(() => { frontmatterFixture.view.destroy(); frontmatterFixture.inline.destroy(); frontmatterFixture.host.remove(); delete window.frontmatterFixture; });
	}
	console.log('Frontmatter passed: 16 settings families, validation, persistence, scoped reset/undo, reading/layout, SVG/PNG exports, and authored overrides in both Live Editor fence languages.');
}
