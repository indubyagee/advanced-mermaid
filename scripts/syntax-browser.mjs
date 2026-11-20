import assert from 'node:assert/strict';

export async function runSyntaxChecks(page) {
	await page.evaluate(() => {
		const host = document.body.createDiv(); host.style.width = '900px';
		const settings = fixture.normalizeSettings(null);
		const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const source = 'Before\n\n```pele\nflowchart LR\n A[Old]\n```\n\nAfter';
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({ doc: source, extensions: [language, fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension] }) });
		view.dispatch({ selection: { anchor: source.indexOf('flowchart') } }); view.focus(); inline.toggle();
		window.syntaxFixture = { host, settings, inline, view, source, nested: () => fixture.EditorView.findFromDOM(fixture.sourceRoot(host).querySelector('.cm-editor')) };
	});
	const diagrams = page.getByRole('combobox', { name: 'Diagram type', exact: true });
	const orientations = page.getByRole('combobox', { name: 'Orientation', exact: true });
	const components = page.getByRole('combobox', { name: 'Insert diagram component', exact: true });
	const configuration = page.getByRole('button', { name: 'Insert configuration', exact: true });
	const documentation = page.getByRole('button', { name: 'Syntax Docs', exact: true });
	const note = () => page.evaluate(() => syntaxFixture.view.state.doc.toString());
	assert.equal(await diagrams.inputValue(), 'flowchart');
	assert.equal(await orientations.inputValue(), 'LR');
	await checkSyntaxDocsNavigation(page, documentation);
	await orientations.selectOption('TB');
	assert.equal(await page.evaluate(() => syntaxFixture.view.state.doc.toString()), 'Before\n\n```pele\nflowchart TB\n A[Old]\n```\n\nAfter');
	await page.keyboard.press('Control+z');
	assert.equal(await page.evaluate(() => syntaxFixture.view.state.doc.toString()), await page.evaluate(() => syntaxFixture.source));
	assert.equal(await orientations.inputValue(), 'LR');
	await page.keyboard.press('Control+Shift+Z');
	assert.equal(await orientations.inputValue(), 'TB');
	await page.evaluate(() => { const view = syntaxFixture.nested(); const from = view.state.doc.toString().indexOf('A[Old]'); view.dispatch({ selection: { anchor: from, head: from + 6 } }); view.focus(); });
	await components.selectOption({ label: 'Rectangle: A["node"]' });
	assert.ok(await page.evaluate(() => syntaxFixture.view.state.doc.toString().includes(' A["node"]')));
	await page.evaluate(() => { const view = syntaxFixture.nested(); view.dispatch({ selection: { anchor: view.state.doc.length } }); view.focus(); });
	assert.equal(await components.locator('option').filter({ hasText: 'Event (rounded rectangle): A@{ shape: rounded, label: process }' }).count(), 1);
	await components.selectOption({ label: 'Process (rectangle): A@{ shape: rect, label: process }' });
	assert.ok(await page.evaluate(() => syntaxFixture.view.state.doc.toString().includes('\nA@{ shape: rect, label: process }')));
	await page.evaluate(() => {
		const nested = syntaxFixture.nested();
		const end = nested.state.doc.length;
		nested.dispatch({ changes: { from: end, insert: '\n  ' }, selection: { anchor: end + 3 } });
		nested.focus();
	});
	const subgraph = await components.locator('option').filter({ hasText: /^Subgraph: subgraph group/ }).getAttribute('value');
	await components.selectOption(subgraph);
	assert.ok((await note()).includes('\n  subgraph group [Group]\n    A --> B\n  end'));
	const beforeConfig = await page.evaluate(() => syntaxFixture.view.state.doc.toString());
	await page.getByRole('button', { name: 'Insert configuration', exact: true }).click();
	const configured = await page.evaluate(() => syntaxFixture.view.state.doc.toString());
	assert.match(configured, /config:\n/); assert.match(configured, /flowchart:\n/);
	assert.match(configured, /rankSpacing: 50/); assert.ok(configured.startsWith('Before\n\n```pele\n---\n') && configured.endsWith('```\n\nAfter'));
	await page.getByRole('button', { name: 'Render now', exact: true }).click();
	await page.waitForSelector('.advanced-mermaid-editor svg.pele');
	await page.getByRole('button', { name: 'Insert configuration', exact: true }).click();
	assert.equal(await page.evaluate(() => syntaxFixture.view.state.doc.toString()), configured);
	await page.keyboard.press('Control+z');
	assert.equal(await page.evaluate(() => syntaxFixture.view.state.doc.toString()), beforeConfig);
	await page.keyboard.press('Control+Shift+Z');
	assert.equal(await page.evaluate(() => syntaxFixture.view.state.doc.toString()), configured);

	const allChoices = await page.evaluate(() => {
		const host = syntaxFixture.host;
		const selector = host.querySelector('[aria-label="Diagram type"]');
		const orientation = host.querySelector('[aria-label="Orientation"]');
		const results = [];
		for (const diagram of fixture.DIAGRAM_SYNTAX) {
			const nested = syntaxFixture.nested(); nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: '' } });
			selector.value = diagram.declaration; selector.dispatchEvent(new Event('change'));
			const pending = syntaxFixture.nested().state.doc.length === 0;
			const disabled = orientation.disabled;
			const docs = host.querySelector('button[title="Open official syntax documentation."]');
			const open = window.open;
			let openedUrl = '';
			window.open = url => { openedUrl = url; return null; };
			try { docs.click(); } finally { window.open = open; }
			let declaration = diagram.declaration;
			if (!disabled) {
				const value = orientation.options[1].value;
				if (diagram.orientation.placement === 'body') declaration += '\n  direction ' + value;
				else declaration += ' ' + value + (diagram.type === 'gitGraph' ? ':' : '');
				orientation.value = value; orientation.dispatchEvent(new Event('change'));
			}
			results.push({
				declaration, initialized: syntaxFixture.nested().state.doc.toString() === declaration + '\n',
				correctPending: pending === Boolean(diagram.orientation) && disabled === !diagram.orientation,
				openedDocs: openedUrl === diagram.syntaxDocs && /^https:\/\/(?:mermaid\.ai\/open-source\/syntax\/|pele\.run\/compatibility#diagram-types)/.test(openedUrl),
				components: host.querySelector('[aria-label="Insert diagram component"]').options.length > 1,
			});
		}
		return results;
	});
	assert.equal(allChoices.length, 41);
	for (const result of allChoices) assert.ok(result.initialized && result.correctPending && result.openedDocs && result.components, result.declaration);

	await page.evaluate(() => { const nested = syntaxFixture.nested(); nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: 'sequenceDiagram\n A->>B: Hello' } }); });
	assert.equal(await diagrams.inputValue(), 'sequenceDiagram');
	assert.equal(await orientations.inputValue(), '');
	assert.ok(await orientations.isDisabled());
	const beforePending = await note();
	await diagrams.selectOption('flowchart');
	assert.equal(await note(), beforePending);
	assert.equal(await orientations.inputValue(), '');
	assert.ok(await components.isDisabled());
	assert.ok(await configuration.isDisabled());
	assert.ok(await page.getByRole('combobox', { name: 'Insert local override', exact: true }).isDisabled());
	assert.ok(await page.getByRole('combobox', { name: 'Presets / Palette', exact: true }).isDisabled());
	await orientations.selectOption('TD');
	assert.equal(await note(), beforePending.replace('sequenceDiagram', 'flowchart TD'));
	await page.keyboard.press('Control+z');
	assert.equal(await note(), beforePending);
	await diagrams.selectOption('flowchart');
	await page.evaluate(() => {
		const view = syntaxFixture.view;
		const from = view.state.doc.toString().indexOf('Hello');
		view.dispatch({ changes: { from, to: from + 5, insert: 'Updated' } });
	});
	assert.equal(await diagrams.inputValue(), 'sequenceDiagram');
	assert.ok(await orientations.isDisabled());
	assert.ok(await components.isEnabled());
	assert.ok(await configuration.isEnabled());
	assert.equal(await components.locator('option').filter({ hasText: 'A["node"]' }).count(), 0);
	await components.selectOption({ label: 'Note on the right: Note right of A: Note' });
	assert.ok(await page.evaluate(() => syntaxFixture.view.state.doc.toString().includes('Note right of A: Note')));
	await page.getByRole('button', { name: 'Insert configuration', exact: true }).click();
	assert.match(await page.evaluate(() => syntaxFixture.view.state.doc.toString()), /sequence:\n/);

	await page.getByRole('tab', { name: 'CSS', exact: true }).click();
	assert.ok(await page.locator('.advanced-mermaid-syntax-selector').isHidden());
	assert.ok(await documentation.isHidden());
	const beforeDraft = await page.evaluate(() => syntaxFixture.view.state.doc.toString());
	await page.evaluate(() => {
		const nested = syntaxFixture.nested(); nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: '.pele { color: red; }' } });
		syntaxFixture.host.querySelector('.advanced-mermaid-syntax-selector button').click();
	});
	assert.equal(await page.evaluate(() => syntaxFixture.view.state.doc.toString()), beforeDraft);
	assert.match(await page.locator('.advanced-mermaid-draft-status').textContent(), /Resolve the current draft/);
	await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
	await page.getByRole('tab', { name: 'Mermaid', exact: true }).first().click();
	assert.ok(await page.locator('.advanced-mermaid-syntax-selector').isVisible());
	await page.evaluate(() => { const nested = syntaxFixture.nested(); nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: '---\nconfig: []\n---\nsequenceDiagram' } }); });
	const invalidYaml = await page.evaluate(() => syntaxFixture.view.state.doc.toString());
	await page.getByRole('button', { name: 'Insert configuration', exact: true }).click();
	assert.equal(await page.evaluate(() => syntaxFixture.view.state.doc.toString()), invalidYaml);
	assert.ok(await page.locator('.advanced-mermaid-draft-status').textContent());
	await page.evaluate(() => { const nested = syntaxFixture.nested(); nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: '---\nconfig: [\n---\nsequenceDiagram' } }); });
	assert.ok(await page.getByRole('button', { name: 'Insert configuration', exact: true }).isDisabled());
	assert.ok(await documentation.isDisabled());

	await checkPresetAndPalette(page, note);

	const cleanup = await page.evaluate(() => {
		const button = syntaxFixture.host.querySelector('.advanced-mermaid-syntax-selector button');
		const before = syntaxFixture.view.state.doc.toString(); syntaxFixture.inline.destroy();
		button.click(); const unchanged = syntaxFixture.view.state.doc.toString() === before;
		syntaxFixture.view.destroy(); syntaxFixture.host.remove(); delete window.syntaxFixture;
		return unchanged;
	});
	assert.equal(cleanup, true);
	console.log(`Syntax toolbar passed: ${allChoices.length} declarations, classic/expanded components, source selection, configuration, undo/redo, manual detection, CSS draft protection, malformed YAML and cleanup.`);
}

async function checkPresetAndPalette(page, note) {
	const menu = page.getByRole('combobox', { name: 'Presets / Palette', exact: true });
	const render = page.getByRole('button', { name: 'Render now', exact: true });
	const setSource = source => page.evaluate(source => {
		const view = syntaxFixture.nested();
		view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source }, selection: { anchor: source.length } });
	}, source);
	const selection = () => page.evaluate(() => {
		const { state } = syntaxFixture.nested();
		const { from, to } = state.selection.main;
		return state.sliceDoc(from, to);
	});
	const visiblePaint = colors => page.waitForFunction(colors => {
		const svg = syntaxFixture.host.querySelector('.advanced-mermaid-mount svg');
		const paint = [...(svg?.querySelectorAll('rect,path,text,tspan') ?? [])].map(node => getComputedStyle(node).fill);
		return colors.every(color => paint.includes(color));
	}, colors);
	const green = 'rgb(38, 164, 33)';
	const blue = 'rgb(19, 55, 170)';
	const savedLibrary = await page.evaluate(() => syntaxFixture.settings.presets);
	await setSource('flowchart LR\nTarget["New class"] --> Authored["Explicit style"]\nclass Authored ToolbarReview\nstyle Authored fill:#1337aa');
	assert.equal(await menu.locator('option[value="class:ToolbarReview"]').count(), 0);
	await page.evaluate(() => {
		syntaxFixture.settings.presets = [...syntaxFixture.settings.presets, { alias: 'ToolbarReview', fill: '#26a421', text: '#26a421' }];
		syntaxFixture.inline.refresh();
	});
	await menu.selectOption('class:ToolbarReview');
	assert.match(await note(), /class NODE_ID ToolbarReview/);
	assert.equal(await selection(), 'NODE_ID');
	await page.keyboard.insertText('Target');
	assert.match(await note(), /class Target ToolbarReview/);
	await render.click();
	await visiblePaint([green, blue]);
	assert.equal(await menu.locator('option[value="palette"]').count(), 0);

	await setSource('treeView-beta\nroot/\n  ');
	await menu.selectOption('class:ToolbarReview');
	assert.match(await note(), /\nroot\/\n  file\.txt :::ToolbarReview/);
	assert.equal(await selection(), 'file.txt');
	await render.click();
	await visiblePaint([green]);
	await setSource('treemap-beta\n"Group"\n  "Item": 10');
	assert.equal(await menu.locator('optgroup[label="Preset classes"]').count(), 1);
	assert.equal(await menu.locator('optgroup[label="Series palettes"]').count(), 1);

	const pie = '---\nconfig:\n  themeVariables:\n    pie1: "#1337aa" # Authored color\n---\npie\n "First": 10\n "Second": 20';
	await setSource(pie);
	assert.equal(await menu.locator('optgroup[label="Preset classes"]').count(), 0);
	await page.evaluate(() => {
		syntaxFixture.settings.presets = [];
		syntaxFixture.inline.refresh();
	});
	assert.ok(await menu.isDisabled());
	assert.equal(await menu.locator('option[value="palette"]').count(), 0);
	await page.evaluate(presets => {
		syntaxFixture.settings.presets = presets.map(preset => preset.alias === 'CATEGORY2' ? { ...preset, fill: '#26a421' } : preset);
		syntaxFixture.inline.refresh();
	}, savedLibrary);
	assert.ok(await menu.isEnabled());
	const before = await note();
	await menu.selectOption('palette');
	const after = await note();
	assert.match(after, /pie1: "#1337aa" # Authored color/);
	assert.match(after, /pie2: ['"]#26a421['"]/);
	assert.equal(await menu.inputValue(), '');
	await menu.selectOption('palette');
	assert.equal(await note(), after);
	await page.keyboard.press('Control+z');
	assert.equal(await note(), before);
	await page.keyboard.press('Control+Shift+Z');
	assert.equal(await note(), after);
	await render.click();
	await visiblePaint([green, blue]);
	await page.getByRole('tab', { name: 'SVG', exact: true }).click();
	await page.waitForFunction(color => syntaxFixture.host.querySelector('textarea[aria-label="Canonical Pele SVG"]').value.includes(color), green);
	const hasExportPaint = await page.evaluate(async color => {
		const output = syntaxFixture.host.querySelector('textarea[aria-label="Canonical Pele SVG"]');
		const svg = output.value;
		const element = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
		const width = Number(element.getAttribute('width'));
		const height = Number(element.getAttribute('height'));
		const blob = await fixture.createPng({ svg, width, height }, document, new AbortController().signal);
		const bitmap = await createImageBitmap(blob);
		try {
			const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
			const ctx = canvas.getContext('2d');
			ctx.drawImage(bitmap, 0, 0);
			const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
			const png = pixels.some((value, i) => i % 4 === 0 && value === 38 && pixels[i + 1] === 164 && pixels[i + 2] === 33 && pixels[i + 3] === 255);
			return { svg: svg.includes(color) && svg.includes('rgb(19, 55, 170)'), png };
		} finally { bitmap.close(); }
	}, green);
	assert.deepEqual(hasExportPaint, { svg: true, png: true });

	await page.getByRole('tab', { name: 'CSS', exact: true }).click();
	await page.evaluate(() => {
		const view = syntaxFixture.nested();
		view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '.pele { color: red; }' } });
		const select = syntaxFixture.host.querySelector('[aria-label="Presets / Palette"]');
		select.value = 'palette';
		select.dispatchEvent(new Event('change'));
	});
	assert.equal(await note(), after);
	assert.match(await page.locator('.advanced-mermaid-draft-status').textContent(), /Resolve the current draft/);
	await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
	await page.getByRole('tab', { name: 'Mermaid', exact: true }).click();
	await setSource('---\nconfig: []\n---\npie\n "First": 10');
	const invalidYaml = await note();
	await menu.selectOption('palette');
	assert.equal(await note(), invalidYaml);
	assert.ok(await page.locator('.advanced-mermaid-draft-status').textContent());
	console.log('Preset and palette toolbar passed: scope, live library refresh, target selection, undo/redo, draft guards and exported colors.');
}

async function checkSyntaxDocsNavigation(page, button) {
	const url = 'https://mermaid.ai/open-source/syntax/flowchart.html';
	const context = page.context();
	await page.waitForFunction(() => syntaxFixture.host.querySelector('.advanced-mermaid-editor-status').textContent.startsWith('Current'));
	await page.evaluate(() => {
		const original = fixture.DiagramController.prototype.setSource;
		syntaxFixture.docsCheck = { state: syntaxFixture.view.state, original, renders: 0 };
		fixture.DiagramController.prototype.setSource = function (...args) {
			syntaxFixture.docsCheck.renders++;
			return original.apply(this, args);
		};
	});
	const reply = route => route.fulfill({ body: 'Flowcharts syntax' });
	await context.route(url, reply);
	try {
		await button.focus();
		assert.ok(await button.evaluate(element => element.ownerDocument.activeElement === element));
		const [popup] = await Promise.all([context.waitForEvent('page'), page.keyboard.press('Enter')]);
		await popup.waitForURL(url);
		await popup.close();
		assert.deepEqual(await page.evaluate(() => {
			const { state, renders } = syntaxFixture.docsCheck;
			return { sameState: syntaxFixture.view.state === state, renders };
		}), { sameState: true, renders: 0 });
	} finally {
		await context.unroute(url, reply);
		await page.evaluate(() => {
			fixture.DiagramController.prototype.setSource = syntaxFixture.docsCheck.original;
			delete syntaxFixture.docsCheck;
		});
	}

	const alias = await page.evaluate(() => {
		const nested = syntaxFixture.nested();
		nested.dispatch({ changes: { from: 0, to: 9, insert: 'graph' } });
		const open = window.open;
		let openedUrl;
		window.open = url => { openedUrl = url; return null; };
		try { syntaxFixture.host.querySelector('button[title="Open official syntax documentation."]').click(); }
		finally {
			window.open = open;
			nested.dispatch({ changes: { from: 0, to: 5, insert: 'flowchart' } });
		}
		return openedUrl;
	});
	assert.equal(alias, url);
}
