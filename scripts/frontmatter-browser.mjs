import assert from 'node:assert/strict';

export async function runFrontmatterChecks(page) {
	const settingsReport = await page.evaluate(async () => {
		const settings = fixture.normalizeSettings(null);
		let changes = 0;
		const tab = new fixture.AdvancedMermaidSettingTab(fixture.app, {}, settings, () => changes++);
		tab.containerEl = document.body.createDiv(); tab.update();
		const row = name => [...tab.containerEl.querySelectorAll('.setting-item')].find(item => [...item.querySelectorAll('label')].some(label => label.textContent === name));
		const open = name => row(name).querySelector('button').click();
		const back = () => tab.containerEl.querySelector('button[aria-label="Back"]').click();
		open('By diagram type');
		const edit = yaml => { const input = tab.containerEl.querySelector('textarea'); input.value = yaml; input.dispatchEvent(new Event('input')); return input; };
		const categories = Object.entries(fixture.DIAGRAM_REGISTRY);
		const failures = [];
		for (const [category, { label }] of categories) {
			open(label);
			const example = tab.containerEl.querySelector('.advanced-mermaid-settings-example');
			example.open = true;
			await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			if (!example.querySelector('svg.pele')) failures.push(label + ' preview');
			open('Advanced');
			const initial = !row('Use custom frontmatter').querySelector('input').checked;
			const yaml = `title: ${category} defaults\nconfig:\n  ${category}: {}`;
			edit(yaml); row('Use custom frontmatter').querySelector('input').click();
			const saved = settings.style.diagrams[category];
			if (!(initial && saved.useGlobal && saved.frontmatter.enabled && saved.frontmatter.yaml === yaml)) failures.push(label + ' frontmatter');
			back(); back();
		}
		open('Flowchart'); open('Advanced');
		const saved = settings.style.diagrams.flowchart.frontmatter.yaml; const before = changes;
		const invalid = edit('config: [');
		const rejectsInvalid = invalid.getAttribute('aria-invalid') === 'true' && !!tab.containerEl.querySelector('[role="status"]').textContent && settings.style.diagrams.flowchart.frontmatter.yaml === saved && changes === before;
		edit(saved); row('Use custom frontmatter').querySelector('input').click();
		const disabledRetains = !settings.style.diagrams.flowchart.frontmatter.enabled && settings.style.diagrams.flowchart.frontmatter.yaml === saved;
		back();
		row('Use styles from All diagrams').querySelector('input').click(); row('Use styles from All diagrams').querySelector('input').click();
		open('Advanced');
		const inheritanceRetains = settings.style.diagrams.flowchart.frontmatter.yaml === saved && tab.containerEl.querySelector('textarea').value === saved;
		back(); open('Reset Flowchart styles');
		const reset = !settings.style.diagrams.flowchart && settings.style.diagrams.sequence.frontmatter.enabled;
		row('Reset Flowchart styles').querySelector('button:last-child').click();
		const undo = settings.style.diagrams.flowchart.frontmatter.yaml === saved && !settings.style.diagrams.flowchart.frontmatter.enabled;
		const roundTrip = { saved: settings, loaded: fixture.normalizeSettings(settings) };
		tab.hide(); tab.containerEl.remove();
		return { count: categories.length, failures, rejectsInvalid, disabledRetains, inheritanceRetains, reset, undo, roundTrip };
	});
	assert.equal(settingsReport.count, 16);
	assert.deepEqual(settingsReport.failures, []);
	assert.deepEqual(settingsReport.roundTrip.loaded, settingsReport.roundTrip.saved);
	for (const [key, value] of Object.entries(settingsReport)) if (!['count', 'failures', 'roundTrip'].includes(key)) assert.equal(value, true, key);

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
	await checkAgentflowAliases(page);
	console.log('Frontmatter passed: 16 settings families, validation, persistence, scoped reset/undo, reading/layout, SVG/PNG exports, and authored overrides and Agentflow aliases in both Live Editor fence languages.');
}

async function checkAgentflowAliases(page) {
	const source = 'agentflow LR\n  A@{ shape: input, label: "Intake" } --> B[Review]';
	for (const fence of ['mermaid', 'pele']) {
		await page.evaluate(async ({ fence, source }) => {
			const plugin = new fixture.AdvancedMermaidPlugin(fixture.app, { id: 'agentflow-alias-fixture' });
			plugin.data = { style: { diagrams: { agentflow: {
				frontmatter: { enabled: true, yaml: 'title: Agentflow defaults\nconfig:\n  agentflow: {rankSpacing: 80}' },
			} } } };
			await plugin.onload();
			const reading = document.body.createDiv();
			const host = document.body.createDiv({ cls: 'agentflow-alias-fixture' });
			host.style.width = '900px';
			const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
			const note = 'Before\n\n\x60\x60\x60' + fence + '\n' + source + '\n\x60\x60\x60\n\nAfter';
			const view = new fixture.EditorView({
				parent: host,
				state: fixture.EditorState.create({ doc: note, extensions: [language, fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, plugin.extensions] }),
			});
			const processBlock = plugin.processors.get(fence).handler;
			processBlock(source, reading, { sourcePath: 'InlineEditor.md', getSectionInfo: () => null, addChild: child => child.load() });
			// Obsidian creates the custom-fence preview through the Markdown processor.
			if (fence === 'pele') {
				const preview = view.dom.createDiv({ cls: 'alias-pele-preview' });
				processBlock(source, preview, {
					sourcePath: 'InlineEditor.md',
					getSectionInfo: () => ({ lineStart: 2, lineEnd: 5, text: note }),
					addChild: child => child.load(),
				});
			}
			window.agentflowFixture = { reading, host, plugin, view, note };
		}, { fence, source });
		try {
			await page.waitForFunction(() => {
				const { reading, host } = agentflowFixture;
				return [reading.querySelector('svg.pele'), host.querySelector(':is(.advanced-mermaid-rendered-preview, .alias-pele-preview) svg.pele')]
					.every(svg => svg?.textContent.includes('Agentflow defaults') && svg.textContent.includes('Intake'));
			});
			await page.evaluate(() => {
				const { view, plugin, note } = agentflowFixture;
				view.dispatch({ selection: { anchor: note.indexOf('agentflow LR') } });
				view.focus();
				if (!plugin.inline.toggle()) throw new Error('Could not open Agentflow in Live Editor.');
			});
			await page.waitForFunction(() => agentflowFixture.host.querySelector('.advanced-mermaid-editor-render svg.pele')?.textContent.includes('Agentflow defaults'));
			const editor = page.locator('.agentflow-alias-fixture');
			assert.equal(await editor.getByRole('combobox', { name: 'Diagram type' }).inputValue(), 'agentflow-beta LR');
			assert.ok(await page.evaluate(() => agentflowFixture.view.state.doc.toString() === agentflowFixture.note), fence + ' source preserved');
			await page.evaluate(() => {
				const nested = fixture.EditorView.findFromDOM(fixture.sourceRoot(agentflowFixture.host).querySelector('.cm-editor'));
				const text = nested.state.doc.toString();
				const beta = text.replace('agentflow LR', 'agentflow-beta LR').replace('Intake', 'Beta intake');
				nested.dispatch({ changes: { from: 0, to: text.length, insert: beta } });
			});
			await page.waitForFunction(() => agentflowFixture.host.querySelector('.advanced-mermaid-editor-render svg.pele')?.textContent.includes('Beta intake'));
			assert.equal(await editor.getByRole('combobox', { name: 'Diagram type' }).inputValue(), 'agentflow-beta LR');
		} finally {
			await page.evaluate(() => {
				const { reading, host, plugin, view } = agentflowFixture;
				view.destroy();
				plugin.unload();
				reading.remove();
				host.remove();
				delete window.agentflowFixture;
			});
		}
	}
}
