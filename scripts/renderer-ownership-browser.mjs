import assert from 'node:assert/strict';

/** Exercise production processor registration with a host reusing cached DOM. */
export async function runRendererOwnershipChecks(page) {
	const report = await page.evaluate(async () => {
		const plugin = new fixture.AdvancedMermaidPlugin(fixture.app, { id: 'ownership-fixture' }); await plugin.onload();
		const root = document.body.createDiv(); root.style.width = '900px'; const children = [];
		const source = 'flowchart LR\n A[Original] --> B[Diagram]';
		const language = () => new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const note = 'Before\n\n```pele\n' + source + '\n```\n\nAfter';
		const pane = () => {
			const parent = root.createDiv();
			const view = new fixture.EditorView({ parent, state: fixture.EditorState.create({ doc: note, extensions: [language(), fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, plugin.extensions] }) });
			const host = view.dom.createDiv({ cls: 'cached-preview' });
			const context = { sourcePath: 'InlineEditor.md', getSectionInfo: () => ({ lineStart: view.state.doc.lineAt(view.state.doc.toString().indexOf('```pele')).number - 1, lineEnd: view.state.doc.lines - 3, text: view.state.doc.toString() }), addChild: child => { children.push(child); child.load(); } };
			plugin.processor(source, host, context);
			const choose = label => [...view.dom.querySelector('.advanced-mermaid-editor-mode').querySelectorAll('button')].find(button => button.textContent === label).click();
			return { view, host, context, choose };
		};
		const first = pane(); const other = pane();
		const wait = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		try {
			await wait(); const initial = first.host.querySelectorAll('svg.pele').length;
			first.choose('Live Editor'); await wait();
			const whileOwned = first.host.querySelectorAll('svg.pele').length;
			const paneIsolation = other.host.querySelectorAll('svg.pele').length === 1;
			first.view.dispatch({ changes: { from: 0, insert: 'Prefix\n' } }); await wait();
			const mapped = !first.host.querySelector('svg.pele');
			const nested = fixture.EditorView.findFromDOM(first.view.dom.querySelector('.advanced-mermaid-editor-source .cm-editor'));
			nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: 'flowchart LR\n A[Latest] --> B[Saved]' } }); await wait();
			const delayed = first.view.dom.createDiv({ cls: 'delayed-preview' }); const count = children.length;
			plugin.processor(source, delayed, first.context); await wait();
			const delayedRegistered = children.length === count + 1 && !delayed.querySelector('svg.pele');
			first.choose('Rendered View'); await wait();
			const restored = first.host.querySelectorAll('svg.pele').length;
			const latest = first.host.querySelector('svg.pele')?.textContent.includes('Latest') && delayed.querySelector('svg.pele')?.textContent.includes('Latest');
			const delayedRestored = delayed.querySelectorAll('svg.pele').length === 1;
			let repeatable = true;
			for (let i = 0; i < 4; i++) {
				first.choose('Live Editor'); await wait(); repeatable &&= !first.host.querySelector('svg.pele');
				first.choose('Rendered View'); await wait();
				repeatable &&= first.host.querySelectorAll('svg.pele').length === 1 && first.host.querySelectorAll('.advanced-mermaid-actions').length === 1;
			}
			first.choose('Live Editor'); await wait(); children[count].unload();
			first.choose('Rendered View'); await wait(); const unloadedStaysEmpty = !delayed.querySelector('svg.pele');
			first.choose('Static Editor'); await wait(); first.choose('Rendered View'); await wait();
			const staticRestored = first.host.querySelectorAll('svg.pele').length === 1;
			return { initial, whileOwned, restored, paneIsolation, mapped, delayedRegistered, delayedRestored, latest, repeatable, unloadedStaysEmpty, staticRestored };
		} finally { first.view.destroy(); other.view.destroy(); for (const child of children) child.unload(); plugin.unload(); root.remove(); }
	});
	console.log('Cached renderer ownership:', JSON.stringify(report));
	assert.equal(report.initial, 1); assert.equal(report.whileOwned, 0);
	assert.equal(report.restored, 1, 'Rendered View must restore a reused Markdown preview after Live Editor releases ownership');
	for (const [key, value] of Object.entries(report)) if (!['initial', 'whileOwned', 'restored'].includes(key)) assert.equal(value, true, key);
}
