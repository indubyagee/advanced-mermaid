import assert from 'node:assert/strict';

export async function runSvgOutputChecks(page) {
	const result = await page.evaluate(async () => {
		const wait = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const settings = fixture.normalizeSettings(null);
		const source = label => `flowchart LR\n A[${label}] --> B[End]`;
		const note = `Before\n\n~~~pele\n${source('Initial')}\n~~~\n\nAfter`;
		const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const host = document.body.createDiv();
		host.style.width = '900px';
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({
			doc: note, extensions: [language, fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension],
		}) });
		const click = (selector, label) => [...host.querySelectorAll(selector)].find(button => button.textContent === label).click();
		const render = () => click('button', 'Render now');
		const tab = name => click('[role="tab"]', name);
		const prototype = fixture.DiagramController.prototype;
		const snapshot = prototype.snapshot;
		let requests = 0;
		let holdNext = false;
		let release;
		let heldSvg;
		prototype.snapshot = async function () {
			requests++;
			const hold = holdNext && new Promise(resolve => { release = resolve; });
			holdNext = false;
			const result = await snapshot.call(this);
			if (hold) {
				heldSvg = result.svg;
				await hold;
			}
			return result;
		};
		try {
			click('.advanced-mermaid-editor-mode button', 'Live editor');
			await wait();
			render();
			const output = host.querySelector('.advanced-mermaid-svg-source');
			const graph = output.previousElementSibling;
			const nested = fixture.EditorView.findFromDOM(fixture.sourceRoot(host).querySelector('.cm-editor'));
			const replace = insert => nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert } });
			const hasSvg = label => output.value.startsWith('<svg') && output.value.includes(label);
			const idleRequests = requests;
			tab('SVG');
			await wait();
			const initial = hasSvg('Initial');
			const mountWidth = graph.querySelector('.advanced-mermaid-mount').clientWidth;
			const concealed = graph.inert && getComputedStyle(graph).opacity === '0';
			let baseline = requests;
			replace(source('Manual'));
			render();
			await wait();
			const manual = hasSvg('Manual');
			const manualError = manual ? '' : output.value;
			const manualRequests = requests - baseline;
			baseline = requests;
			replace(source('Automatic'));
			await new Promise(resolve => setTimeout(resolve, settings.liveEditor.debounceMs + 120));
			await wait();
			const automatic = hasSvg('Automatic');
			const automaticRequests = requests - baseline;
			baseline = requests;
			settings.style.global.colors.text = { light: '#123456' };
			inline.refresh();
			await wait();
			const svg = new DOMParser().parseFromString(output.value, 'image/svg+xml');
			const styled = svg.querySelector('.pele-label')?.style.fill === 'rgb(18, 52, 86)' &&
				svg.documentElement.style.visibility === 'visible';
			const styleRequests = requests - baseline;
			baseline = requests;
			tab('Pele');
			tab('SVG');
			await wait();
			const reopenRequests = requests - baseline;
			holdNext = true;
			replace(source('Older'));
			render();
			await wait();
			replace(source('Latest'));
			render();
			await wait();
			release?.();
			await wait();
			const superseded = heldSvg?.includes('Older') === true && hasSvg('Latest') && !output.value.includes('Older');
			replace('Invalid diagram');
			render();
			await wait();
			const invalidCleared = !output.value.startsWith('<svg') && graph.classList.contains('advanced-mermaid-stale');
			return { idleRequests, initial, mountWidth, concealed, manual, manualError, manualRequests, automatic,
				automaticRequests, styled, styleRequests, reopenRequests, superseded, invalidCleared };
		} finally {
			view.destroy();
			inline.destroy();
			release?.();
			prototype.snapshot = snapshot;
			host.remove();
		}
	});
	console.log('Inline SVG output checks:', JSON.stringify(result));
	assert.ok(result.initial && result.manual && result.automatic, result.manualError);
	assert.ok(result.mountWidth > 0 && result.concealed && result.styled && result.superseded && result.invalidCleared);
	assert.deepEqual([result.idleRequests, result.manualRequests, result.automaticRequests, result.styleRequests, result.reopenRequests], [0, 1, 1, 1, 0]);
}

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
		const editFilter = new fixture.Compartment();
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({ doc: text, extensions: [language, fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension, editFilter.of([])] }) });
		view.dispatch({ selection: { anchor: text.indexOf('flowchart') } }); view.focus();
		if (!inline.toggle()) throw new Error('Inline command unavailable');
		window.inlineFixture = { host, view, inline, settings, text, editFilter };
	});
	await page.waitForSelector('.advanced-mermaid-editor .cm-editor');
	const ownership = await page.evaluate(() => ({ widgets: document.querySelectorAll('.advanced-mermaid-editor').length, nested: fixture.sourceRoot(inlineFixture.host).querySelectorAll('.cm-editor').length }));
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
	const sourceRouting = await page.evaluate(() => {
		const { host, view, editFilter } = inlineFixture;
		const nested = fixture.EditorView.findFromDOM(fixture.sourceRoot(host).querySelector('.cm-editor'));
		const syntax = fixture.DiagramSyntaxSelector.prototype;
		const controller = fixture.DiagramController.prototype;
		const { refresh } = syntax;
		const { invalidate } = controller;
		let toolbarRefreshes = 0;
		let invalidations = 0;
		syntax.refresh = function (...args) { toolbarRefreshes++; return refresh.apply(this, args); };
		controller.invalidate = function () { invalidations++; invalidate.call(this); };
		const original = nested.state.doc.toString();
		let work;
		try {
			nested.dispatch({ changes: { from: nested.state.doc.length, insert: '\n B --> Counted' } });
			work = { toolbarRefreshes, invalidations, forwarded: view.state.doc.toString().includes('B --> Counted') };
		} finally {
			syntax.refresh = refresh;
			controller.invalidate = invalidate;
		}
		const undo = fixture.undo(view) && nested.state.doc.toString() === original;
		const redo = fixture.redo(view) && nested.state.doc.toString().includes('B --> Counted');
		fixture.undo(view);

		const click = label => [...host.querySelectorAll('button')].find(button => button.textContent === label).click();
		const compose = (from, to, changeNote) => {
			nested.dispatch({ selection: { anchor: from, head: to } });
			nested.contentDOM.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
			// Simulate an active IME session without depending on the operating system keyboard.
			Object.defineProperty(nested, 'composing', { configurable: true, value: true });
			try { changeNote(); }
			finally {
				delete nested.composing;
				nested.contentDOM.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
			}
		};
		const start = original.indexOf('Start');
		const parentStart = view.state.doc.toString().indexOf('Start');
		compose(start, start + 'Start'.length, () => {
			view.dispatch({ changes: { from: parentStart, to: parentStart + 'Start'.length, insert: 'External' } });
		});
		const compositionProtected = nested.state.doc.toString() === original && host.querySelector('.advanced-mermaid-draft-status').textContent.includes('External change during composition');
		click('Use note version');
		const reconciled = nested.state.doc.toString().includes('External');
		view.dispatch({ changes: { from: parentStart, to: parentStart + 'External'.length, insert: 'Start' } });

		const styleBlock = '%% advanced-mermaid-style:v1\n%% .pele { --pele-fg: #123; }\n%% advanced-mermaid-style:end\n';
		const bodyStart = fixture.diagramFences(view.state)[0].bodyFrom;
		view.dispatch({ changes: { from: bodyStart, insert: styleBlock } });
		click('CSS');
		const cssStart = nested.state.doc.toString().indexOf('#123');
		const noteCssStart = view.state.doc.toString().indexOf('#123');
		compose(cssStart, cssStart + 4, () => {
			view.dispatch({ changes: { from: noteCssStart, to: noteCssStart + 4, insert: '#456' } });
		});
		nested.dispatch({ changes: { from: cssStart, to: cssStart + 4, insert: '#789' } });
		click('Render now');
		const cssCompositionProtected = view.state.doc.toString().includes('#456') && !view.state.doc.toString().includes('#789');
		click('Use note version');
		const cssReconciled = nested.state.doc.toString().includes('#456');
		click('Mermaid');
		view.dispatch({ changes: { from: bodyStart, to: bodyStart + styleBlock.length } });

		click('Render now');
		const actions = host.querySelector('.advanced-mermaid-actions');
		const exportWasReady = !actions.hidden;
		view.dispatch({ effects: editFilter.reconfigure(fixture.EditorState.transactionFilter.of(transaction => transaction.docChanged ? [] : transaction)) });
		nested.dispatch({ changes: { from: nested.state.doc.length, insert: '\n B --> Rejected' } });
		const rejectedDraftProtected = exportWasReady && actions.hidden && !view.state.doc.toString().includes('Rejected') && nested.state.doc.toString().includes('Rejected');
		view.dispatch({ effects: editFilter.reconfigure([]) });
		click('Use note version');
		return { ...work, undo, redo, compositionProtected, reconciled, cssCompositionProtected, cssReconciled,
			rejectedDraftProtected, restored: nested.state.doc.toString() === original };
	});
	console.log('Inline source routing checks:', JSON.stringify(sourceRouting));
	assert.deepEqual(sourceRouting, { toolbarRefreshes: 1, invalidations: 1, forwarded: true,
		undo: true, redo: true, compositionProtected: true, reconciled: true, cssCompositionProtected: true,
		cssReconciled: true, rejectedDraftProtected: true, restored: true });
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
	await page.waitForFunction(() => !fixture.sourceRoot(document).querySelector('.cm-content').textContent.includes('C[Next]'));
	assert.equal(await page.locator('.advanced-mermaid-editor').count(), 1);
	await page.evaluate(() => { const source = inlineFixture.view.state.doc.toString(); inlineFixture.view.dispatch({ selection: { anchor: source.indexOf('flowchart') } }); });
	await page.waitForFunction(() => fixture.sourceRoot(document).querySelector('.cm-content').textContent.includes('C[Next]'));
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
