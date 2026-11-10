import assert from 'node:assert/strict';

export async function runInlineEditorChecks(page) {
	const profiles = await page.evaluate(async () => {
		const source = 'flowchart LR\n A[Start] --> B[End]';
		const item = fixture.diagram(source, { schemaVersion: 3, style: { followObsidianTheme: true, global: { colors: { text: { light: '#123456', dark: '#abcdef' } }, elements: {} }, diagrams: { flowchart: { useGlobal: false, overrides: { colors: { surface: { light: '#334455' } }, elements: {} } } } } });
		const text = () => getComputedStyle(item.host.querySelector('.pele-label')).fill;
		const light = text(); document.body.classList.add('theme-dark');
		await new Promise(resolve => setTimeout(resolve, 100)); const dark = text();
		const result = fixture.render(source, { images: false }); const snapshot = await fixture.createSvgSnapshot(result, item.host, () => true);
		const exported = new DOMParser().parseFromString(snapshot.svg, 'image/svg+xml').querySelector('.pele-label').style.fill;
		document.body.classList.remove('theme-dark'); item.child.unload(); item.host.remove();
		const malformed = fixture.diagram('%% advanced-mermaid-style:v1\n%% .pele { --pele-fg:red; }\n%% advanced-mermaid-style:end\n' + source);
		const fallback = !!malformed.host.querySelector('svg.pele') && malformed.host.textContent.includes('hex color');
		const noExport = malformed.host.querySelector('.advanced-mermaid-actions').hidden; malformed.child.unload(); malformed.host.remove();
		return { light, dark, exported, fallback, noExport };
	});
	assert.equal(profiles.light, 'rgb(18, 52, 86)'); assert.equal(profiles.dark, 'rgb(171, 205, 239)'); assert.equal(profiles.exported, profiles.dark); assert.ok(profiles.fallback && profiles.noExport);
	const semantic = await page.evaluate(async () => {
		const cases = [
			['sequence', 'sequenceDiagram\n participant A\n participant B\n A->>B: Hello\n activate B\n Note over B: Work\n deactivate B', [['sequenceParticipantFill', '.pele-actor rect', 'fill'], ['sequenceNoteFill', '.pele-note rect', 'fill'], ['sequenceActivationFill', '.pele-activation', 'fill']]],
			['state', 'stateDiagram-v2\n state Group {\n Idle --> Active\n }', [['stateCompositeFill', '.pele-state-composite rect', 'fill']]],
			['treeView', 'treeView-beta\nroot/\n  file.ts', [['treeFileText', '.pele-tree-file text', 'fill'], ['treeDirectoryText', '.pele-tree-dir text', 'fill'], ['treeGuideColor', '.pele-tree-guides', 'stroke']]],
			['agentflow', 'agentflow-beta\n A[Input] --> B[Task]', [['agentTaskColor', '.pele-kind-task rect', 'fill']]],
			['mindmap', 'mindmap\n root((Root))\n  Branch\n   Leaf', [['mindmapRootFill', '.pele-root circle', 'fill']]],
		];
		const results = [];
		for (const [category, source, controls] of cases) for (const [id, selector, property] of controls) {
			const item = fixture.diagram(source, { schemaVersion: 3, style: { global: { colors: {}, elements: {} }, diagrams: { [category]: { useGlobal: false, overrides: { colors: {}, elements: { [id]: { light: '#123456', dark: '#abcdef' } } } } } } });
			const light = getComputedStyle(item.host.querySelector(selector))[property];
			document.body.classList.add('theme-dark'); item.child.refreshTheme();
			const dark = getComputedStyle(item.host.querySelector(selector))[property];
			const snapshot = await fixture.createSvgSnapshot(fixture.render(source, { images: false }), item.host, () => true);
			const exported = new DOMParser().parseFromString(snapshot.svg, 'image/svg+xml').querySelector(selector).style[property];
			results.push({ id, light, dark, exported }); document.body.classList.remove('theme-dark'); item.child.unload(); item.host.remove();
		}
		return results;
	});
	for (const item of semantic) { assert.equal(item.light, 'rgb(18, 52, 86)', item.id); assert.equal(item.dark, 'rgb(171, 205, 239)', item.id); assert.equal(item.exported, item.dark, item.id); }
	await page.evaluate(() => {
		const settings = fixture.normalizeSettings(null);
		const host = document.body.createDiv(); host.style.width = '900px';
		const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const text = 'Before\n\n```pele\nflowchart LR\n A[Start] --> B[End]\n```\n\nAfter\n\n```pele\nflowchart LR\n A[Start] --> B[End]\n```';
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({ doc: text, extensions: [language, fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension] }) });
		view.dispatch({ selection: { anchor: text.indexOf('flowchart') } }); view.focus();
		if (!inline.toggle()) throw new Error('Inline command unavailable');
		window.inlineFixture = { host, view, inline, settings, text };
	});
	await page.waitForSelector('.advanced-mermaid-editor .cm-editor');
	const ownership = await page.evaluate(() => ({ widgets: document.querySelectorAll('.advanced-mermaid-editor').length, nested: inlineFixture.host.querySelectorAll('.advanced-mermaid-editor-source .cm-editor').length }));
	assert.equal(ownership.widgets, 1); assert.equal(ownership.nested, 1);
	await page.waitForFunction(() => document.querySelector('.advanced-mermaid-editor').dataset.layout === 'side-by-side');
	assert.ok(await page.evaluate(() => {
		const preview = inlineFixture.host.querySelector('.advanced-mermaid-editor-preview').getBoundingClientRect();
		const svg = inlineFixture.host.querySelector('svg.pele').getBoundingClientRect();
		return svg.left >= preview.left - 1 && svg.right <= preview.right + 1;
	}));
	await page.evaluate(() => { inlineFixture.host.style.width = '400px'; });
	await page.waitForFunction(() => document.querySelector('.advanced-mermaid-editor').dataset.layout === 'stacked');
	await page.evaluate(() => { inlineFixture.host.style.width = '900px'; });
	await page.waitForFunction(() => document.querySelector('.advanced-mermaid-editor').dataset.layout === 'side-by-side');
	const content = page.locator('.advanced-mermaid-editor-source .cm-content');
	await content.click(); await page.keyboard.press('Control+End'); await page.keyboard.type('\n B --> C[Next]');
	await page.waitForFunction(() => inlineFixture.view.state.doc.toString().includes('C[Next]'));
	const editing = await page.evaluate(() => {
		const before = inlineFixture.host.querySelector('.advanced-mermaid-editor');
		const note = inlineFixture.view.state.doc.toString();
		inlineFixture.view.dispatch({ changes: { from: 0, insert: 'Prefix\n' } });
		return { single: note.split('C[Next]').length === 2, paragraphs: note.startsWith('Before') && note.includes('After'), reused: before === inlineFixture.host.querySelector('.advanced-mermaid-editor'), prefix: inlineFixture.view.state.doc.toString().startsWith('Prefix\nBefore') };
	});
	assert.ok(editing.single && editing.paragraphs && editing.reused && editing.prefix, JSON.stringify(editing));
	await page.evaluate(() => { inlineFixture.settings.liveEditor.activation = 'focused-block'; const source = inlineFixture.view.state.doc.toString(); inlineFixture.view.dispatch({ selection: { anchor: source.lastIndexOf('flowchart') } }); });
	await page.waitForFunction(() => !document.querySelector('.advanced-mermaid-editor-source .cm-content').textContent.includes('C[Next]'));
	assert.equal(await page.locator('.advanced-mermaid-editor').count(), 1);
	await page.evaluate(() => { const source = inlineFixture.view.state.doc.toString(); inlineFixture.view.dispatch({ selection: { anchor: source.indexOf('flowchart') } }); });
	await page.waitForFunction(() => document.querySelector('.advanced-mermaid-editor-source .cm-content').textContent.includes('C[Next]'));
	await page.evaluate(() => { inlineFixture.settings.liveEditor.activation = 'manual'; });
	await page.getByRole('tab', { name: 'CSS', exact: true }).click();
	await content.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('.pele { --pele-fg: #246; }');
	await page.waitForFunction(() => inlineFixture.view.state.doc.toString().includes('advanced-mermaid-style:v1'));
	const validNote = await page.evaluate(() => inlineFixture.view.state.doc.toString());
	await page.keyboard.press('Control+A'); await page.keyboard.type('.pele { color: red; }');
	await page.waitForFunction(() => document.querySelector('.advanced-mermaid-draft-status').textContent.includes('Unsaved'));
	assert.equal(await page.evaluate(() => inlineFixture.view.state.doc.toString()), validNote);
	await page.locator('.advanced-mermaid-editor-mode').first().getByRole('button', { name: 'Rendered view', exact: true }).click(); assert.equal(await page.locator('.advanced-mermaid-editor').count(), 1);
	await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
	await content.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('.pele { --pele-fg: #abc; }');
	await page.evaluate(() => { const source = inlineFixture.view.state.doc.toString(); const offset = source.indexOf('#246'); inlineFixture.view.dispatch({ changes: { from: offset, to: offset + 4, insert: '#135' } }); });
	await page.waitForFunction(() => document.querySelector('.advanced-mermaid-draft-status').textContent.includes('changed externally'));
	assert.ok((await page.evaluate(() => inlineFixture.view.state.doc.toString())).includes('#135'));
	assert.ok((await content.textContent()).includes('#abc'));
	await page.getByRole('button', { name: 'Use note version', exact: true }).click();
	await page.getByRole('tab', { name: 'Mermaid', exact: true }).first().click();
	await content.click(); await page.keyboard.press('Control+End'); await page.keyboard.type('\n C[unclosed');
	await page.waitForSelector('.advanced-mermaid-stale');
	assert.ok(await page.locator('.advanced-mermaid-editor svg.pele').count());
	const staleExport = await page.evaluate(() => document.querySelector('.advanced-mermaid-editor .advanced-mermaid-actions').hidden); assert.ok(staleExport);
	await page.keyboard.press('Control+z');
	await page.waitForFunction(() => !inlineFixture.view.state.doc.toString().includes('C[unclosed'));
	await page.getByRole('button', { name: 'Render now', exact: true }).click();
	await page.waitForFunction(() => !document.querySelector('.advanced-mermaid-stale'), null, { timeout: 5000 }).catch(async error => { console.log('Inline editor recovery diagnostic:', await page.evaluate(() => ({ note: inlineFixture.view.state.doc.toString(), ui: document.querySelector('.advanced-mermaid-editor')?.textContent }))); throw error; });
	await page.getByRole('tab', { name: 'SVG', exact: true }).click();
	await page.waitForFunction(() => document.querySelector('textarea[aria-label="Canonical Pele SVG"]').value.startsWith('<svg'));
	assert.deepEqual(await page.getByRole('tablist', { name: 'Preview format' }).getByRole('tab').allTextContents(), ['Pele', 'SVG']);
	assert.deepEqual(await page.getByRole('tablist', { name: 'Source format' }).getByRole('tab').allTextContents(), ['Mermaid', 'CSS']);
	await page.getByRole('tab', { name: 'Pele', exact: true }).click();
	await page.locator('.advanced-mermaid-editor svg.pele').waitFor({ state: 'visible' });
	await page.getByRole('tab', { name: 'CSS', exact: true }).click();
	await content.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('.pele { invalid: draft; }');
	await page.evaluate(() => {
		const note = inlineFixture.view.state.doc.toString(); const from = note.indexOf('```pele'); const to = note.indexOf('```pele', from + 7);
		inlineFixture.view.dispatch({ changes: { from, to, insert: '' } });
	});
	await page.waitForTimeout(350);
	assert.equal(await page.locator('.advanced-mermaid-editor').count(), 0);
	assert.ok(await page.evaluate(() => fixture.recoveryDrafts().some(draft => draft.css.includes('invalid: draft') && draft.source.includes('flowchart'))));
	await page.evaluate(() => {
		const note = inlineFixture.view.state.doc.toString(); const line = inlineFixture.view.state.doc.lineAt(note.indexOf('```pele')).number - 1;
		inlineFixture.inline.openAt('InlineEditor.md', line);
	});
	assert.equal(await page.locator('.advanced-mermaid-editor').count(), 1);
	await page.evaluate(() => { const from = inlineFixture.view.state.doc.toString().lastIndexOf('```'); inlineFixture.view.dispatch({ changes: { from, to: from + 3, insert: '' } }); });
	assert.equal(await page.locator('.advanced-mermaid-editor').count(), 0);
	await page.evaluate(() => { inlineFixture.view.destroy(); inlineFixture.inline.destroy(); inlineFixture.host.remove(); });
	assert.equal(await page.locator('.advanced-mermaid-editor').count(), 0);
	console.log('Inline editor browser checks passed: profiles, theme modes, semantic adapters, scoped exports, one widget, source mapping, parent history, CSS drafts, stale recovery, SVG view and cleanup.');
}
