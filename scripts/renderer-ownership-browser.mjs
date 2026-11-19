import assert from 'node:assert/strict';

export async function runOwnershipScopeChecks(page) {
	const result = await page.evaluate(async () => {
		const plugin = new fixture.AdvancedMermaidPlugin(fixture.app, { id: 'ownership-scope-fixture' });
		await plugin.onload();
		const root = document.body.createDiv();
		const source = 'flowchart LR\n A[Original] --> B[Diagram]';
		const files = ['InlineEditor.md', 'InlineEditor.md', 'Other.md'];
		const panes = files.map(() => root.createDiv());
		const lookups = [0, 0, 0];
		const owner = { id: 1, file: files[0], fromLine: 0, toLine: 4, source };
		const draw = plugin.processors.get('pele').handler;
		const children = [];
		let cachedSectionAvailable = true;
		try {
			for (const [index, pane] of panes.entries()) {
				for (let block = 0; block < 10; block++) {
					draw(source, pane.createDiv({ cls: 'cached-preview' }), {
						sourcePath: files[index],
						getSectionInfo() {
							lookups[index]++;
							return index === 0 && block === 0 && !cachedSectionAvailable ? null : { lineStart: block * 10 };
						},
						addChild: child => { children.push(child); child.load(); },
					});
				}
			}
			const [edited, split, other] = panes;
			const cached = edited.firstElementChild;
			fixture.setInlineOwner(edited, owner);
			lookups.fill(0);
			fixture.setInlineOwner(edited, { ...owner, source: source.replace('Original', 'Edited') });
			const sectionLookups = [...lookups];
			cached.remove();
			cachedSectionAvailable = false;
			fixture.setInlineOwner(edited, { ...owner, fromLine: 5, toLine: 9, source: source.replace('Original', 'Moved') });
			const detachedSuppressed = !cached.querySelector('svg.pele');
			edited.prepend(cached);
			fixture.setInlineOwner(edited, { ...owner, fromLine: 5, toLine: 9, source: source.replace('Original', 'Reattached') });
			const reattachedSuppressed = !cached.querySelector('svg.pele');
			fixture.setInlineOwner(edited);
			const restored = cached.querySelector('svg.pele')?.textContent.includes('Reattached') === true;
			const isolated = [split, other].every(pane => pane.querySelectorAll('svg.pele').length === 10 && pane.textContent.includes('Original'));
			return { sectionLookups, detachedSuppressed, reattachedSuppressed, restored, isolated };
		} finally {
			fixture.setInlineOwner(panes[0]);
			for (const child of children) child.unload();
			plugin.unload();
			root.remove();
		}
	});
	console.log('Pane-scoped ownership checks:', JSON.stringify(result));
	assert.deepEqual(result, { sectionLookups: [9, 0, 0], detachedSuppressed: true, reattachedSuppressed: true, restored: true, isolated: true });
}

/** Exercise production processor registration with a host reusing cached DOM. */
export async function runRendererOwnershipChecks(page) {
	const registrations = await page.evaluate(async () => {
		const plugin = new fixture.AdvancedMermaidPlugin(fixture.app, { id: 'registration-fixture' }); await plugin.onload();
		try { return [...plugin.processors].map(([language, { sortOrder }]) => ({ language, sortOrder })); }
		finally { plugin.unload(); }
	});
	assert.deepEqual(registrations.map(entry => entry.language).sort(), ['mermaid', 'pele'], 'Both fence languages must receive an Advanced Mermaid renderer');
	assert.ok(registrations.find(entry => entry.language === 'mermaid').sortOrder < 0, 'The Mermaid processor must run before the default-priority native renderer');
	for (const fenceLanguage of ['pele', 'mermaid']) await runOwnershipChecks(page, fenceLanguage);
}

async function runOwnershipChecks(page, fenceLanguage) {
	const report = await page.evaluate(async fenceLanguage => {
		const plugin = new fixture.AdvancedMermaidPlugin(fixture.app, { id: 'ownership-fixture' }); await plugin.onload();
		const processor = plugin.processors.get(fenceLanguage).handler;
		const root = document.body.createDiv(); root.style.width = '900px'; const children = [];
		const source = 'flowchart LR\n A[Original] --> B[Diagram]';
		const language = () => new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const note = 'Before\n\n```' + fenceLanguage + '\n' + source + '\n```\n\nAfter';
		const pane = () => {
			const parent = root.createDiv();
			const view = new fixture.EditorView({ parent, state: fixture.EditorState.create({ doc: note, extensions: [language(), fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, plugin.extensions] }) });
			const host = view.dom.createDiv({ cls: 'cached-preview' });
			const context = { sourcePath: 'InlineEditor.md', getSectionInfo: () => ({ lineStart: view.state.doc.lineAt(view.state.doc.toString().indexOf('```' + fenceLanguage)).number - 1, lineEnd: view.state.doc.lines - 3, text: view.state.doc.toString() }), addChild: child => { children.push(child); child.load(); } };
			processor(source, host, context);
			const choose = label => [...view.dom.querySelector('.advanced-mermaid-editor-mode').querySelectorAll('button')].find(button => button.textContent === label).click();
			return { view, host, context, choose };
		};
		const first = pane(); const other = pane();
		const wait = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		try {
			await wait(); const initial = first.host.querySelectorAll('svg.pele').length;
			first.choose('Live editor'); await wait();
			const whileOwned = first.host.querySelectorAll('svg.pele').length;
			const paneIsolation = other.host.querySelectorAll('svg.pele').length === 1;
			first.view.dispatch({ changes: { from: 0, insert: 'Prefix\n' } }); await wait();
			const mapped = !first.host.querySelector('svg.pele');
			const nested = fixture.EditorView.findFromDOM(fixture.sourceRoot(first.view.dom).querySelector('.cm-editor'));
			nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: 'flowchart LR\n A[Latest] --> B[Saved]' } }); await wait();
			const delayed = first.view.dom.createDiv({ cls: 'delayed-preview' }); const count = children.length;
			processor(source, delayed, first.context); await wait();
			const delayedRegistered = children.length === count + 1 && !delayed.querySelector('svg.pele');
			first.choose('Rendered view'); await wait();
			const restored = first.host.querySelectorAll('svg.pele').length;
			const latest = first.host.querySelector('svg.pele')?.textContent.includes('Latest') && delayed.querySelector('svg.pele')?.textContent.includes('Latest');
			const delayedRestored = delayed.querySelectorAll('svg.pele').length === 1;
			let repeatable = true;
			for (let i = 0; i < 4; i++) {
				first.choose('Live editor'); await wait(); repeatable &&= !first.host.querySelector('svg.pele');
				first.choose('Rendered view'); await wait();
				repeatable &&= first.host.querySelectorAll('svg.pele').length === 1 && first.host.querySelectorAll('.advanced-mermaid-actions').length === 1;
			}
			first.choose('Live editor'); await wait(); children[count].unload();
			first.choose('Rendered view'); await wait(); const unloadedStaysEmpty = !delayed.querySelector('svg.pele');
			first.choose('Static editor'); await wait(); first.choose('Rendered view'); await wait();
			const staticRestored = first.host.querySelectorAll('svg.pele').length === 1;
			return { initial, whileOwned, restored, paneIsolation, mapped, delayedRegistered, delayedRestored, latest, repeatable, unloadedStaysEmpty, staticRestored };
		} finally { first.view.destroy(); other.view.destroy(); for (const child of children) child.unload(); plugin.unload(); root.remove(); }
	}, fenceLanguage);
	console.log('Cached renderer ownership (' + fenceLanguage + '):', JSON.stringify(report));
	assert.equal(report.initial, 1); assert.equal(report.whileOwned, 0);
	assert.equal(report.restored, 1, 'Rendered view must restore a reused Markdown preview after Live editor releases ownership');
	for (const [key, value] of Object.entries(report)) if (!['initial', 'whileOwned', 'restored'].includes(key)) assert.equal(value, true, key);
}
