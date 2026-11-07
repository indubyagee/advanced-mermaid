import assert from 'node:assert/strict';

export async function runPresetChecks(page) {
	const report = await page.evaluate(async () => {
		const cases = [
			['flowchart', 'flowchart LR\n A[First]:::PTEST --> B[Second]'],
			['state', 'stateDiagram-v2\n A --> B\n class A PTEST'],
			['agentflow', 'agentflow-beta\n A[Input]:::PTEST --> B[Task]'],
			['mindmap', 'mindmap\n root((Root))\n  Child[Child]\n   :::PTEST'],
			['treeView', 'treeView-beta\nroot/\n  file.ts :::PTEST'],
			['treemap', 'treemap-beta\n "Group"\n  "Item": 10:::PTEST'],
		];
		const results = [];
		for (const [type, source] of cases) {
			const item = fixture.diagram(source, { presets: [{ alias: 'PTEST', fill: '#12345680', stroke: '#335577', text: '#abcdef', width: 3.5 }] });
			const node = item.host.querySelector('.pele-node.PTEST');
			const shape = node.querySelector('rect,circle,ellipse,path,polygon'); const label = node.querySelector('text');
			const visible = { text: getComputedStyle(label).fill, fill: shape && getComputedStyle(shape).fill, stroke: shape && getComputedStyle(shape).stroke, width: shape && getComputedStyle(shape).strokeWidth, opacity: shape && getComputedStyle(shape).fillOpacity };
			const snapshot = await fixture.createSvgSnapshot(fixture.render(source, { images: false }), item.host, () => true);
			const exported = new DOMParser().parseFromString(snapshot.svg, 'image/svg+xml').querySelector('.pele-node.PTEST');
			const exportShape = exported.querySelector('rect,circle,ellipse,path,polygon');
			const parity = exported.querySelector('text').style.fill === visible.text && (!shape || exportShape.style.fill === visible.fill && exportShape.style.stroke === visible.stroke && exportShape.style.strokeWidth === visible.width);
			const png = await fixture.createPng(snapshot, document, new AbortController().signal); const bitmap = await createImageBitmap(png); const pngSize = bitmap.width === Math.ceil(snapshot.width * 2) && bitmap.height === Math.ceil(snapshot.height * 2); bitmap.close();
			item.child.unload(); const cleaned = !item.host.querySelector('style'); item.host.remove();
			results.push({ type, ...visible, parity, pngSize, cleaned });
		}
		const authored = [];
		for (const source of [
			'flowchart LR\n A[Authored]:::PTEST\n classDef PTEST fill:#ff0000,stroke:#00ff00,color:#0000ff,stroke-width:5px',
			'stateDiagram-v2\n A --> B\n class A PTEST\n classDef PTEST fill:#ff0000,stroke:#00ff00,color:#0000ff,stroke-width:5px',
			'agentflow-beta\n A[Task]:::PTEST --> B[Task]\n classDef PTEST fill:#ff0000,stroke:#00ff00,color:#0000ff,stroke-width:5px',
		]) {
			const item = fixture.diagram(source, { presets: [{ alias: 'PTEST', fill: '#123456', stroke: '#123456', text: '#123456', width: 1 }] });
			const node = item.host.querySelector('.pele-node.PTEST'); const shape = node.querySelector('rect');
			authored.push({ fill: getComputedStyle(shape).fill, stroke: getComputedStyle(shape).stroke, width: getComputedStyle(shape).strokeWidth, text: getComputedStyle(node.querySelector('text')).fill }); item.child.unload(); item.host.remove();
		}
		const ordered = fixture.diagram('flowchart LR\n A[First]\n class A One\n class A Two', { presets: [{ alias: 'One', fill: '#ff0000' }, { alias: 'Two', fill: '#0000ff' }] });
		const lastWins = getComputedStyle(ordered.host.querySelector('.pele-node rect')).fill; ordered.child.unload(); ordered.host.remove();
		const empty = fixture.diagram('flowchart LR\n A[First]:::ALT1'); empty.settings.presets = []; empty.child.updateSettings(); const noResurrection = getComputedStyle(empty.host.querySelector('.pele-node rect')).fill !== 'rgb(45, 70, 70)'; empty.child.unload(); empty.host.remove();
		const textOverride = fixture.diagram('flowchart LR\n A[First]:::ALT1', { schemaVersion: 4, style: { global: { colors: {}, elements: { nodeText: { light: '#ff0000' } } } } });
		const explicitText = getComputedStyle(textOverride.host.querySelector('.pele-label')).fill; textOverride.child.unload(); textOverride.host.remove();
		const staleHost = document.body.createDiv(); const staleSettings = fixture.normalizeSettings(null);
		const stale = new fixture.DiagramController(staleHost, 'flowchart LR\n A[Cached]:::ALT1', () => staleSettings, fixture.app, '', { keepLastValid: true }); stale.load();
		const cached = getComputedStyle(staleHost.querySelector('.pele-node rect')).fill; stale.setSource('flowchart LR\n A[unclosed');
		const stalePalette = staleHost.classList.contains('advanced-mermaid-stale') && getComputedStyle(staleHost.querySelector('.pele-node rect')).fill === cached;
		stale.destroy(); staleHost.remove();
		return { results, authored, lastWins, noResurrection, explicitText, stalePalette };
	});
	for (const item of report.results) {
		assert.equal(item.text, 'rgb(171, 205, 239)', item.type); assert.ok(item.parity && item.pngSize && item.cleaned, JSON.stringify(item));
		if (item.type === 'treeView') { assert.equal(item.fill, null); continue; }
		assert.match(item.fill, /^rgba\(18, 52, 86, 0\.5\d*\)$/); assert.equal(item.stroke, 'rgb(51, 85, 119)'); assert.equal(item.width, '3.5px'); assert.equal(item.opacity, '1');
	}
	for (const item of report.authored) assert.deepEqual(item, { fill: 'rgb(255, 0, 0)', stroke: 'rgb(0, 255, 0)', width: '5px', text: 'rgb(0, 0, 255)' });
	assert.equal(report.lastWins, 'rgb(0, 0, 255)'); assert.equal(report.noResurrection, true); assert.equal(report.explicitText, 'rgb(255, 0, 0)');
	assert.equal(report.stalePalette, true);
	console.log('Preset checks passed: all six adapters, authored precedence, alpha, stroke widths, text-only applicability, library order, deletion, SVG/PNG parity and cleanup.');
}

export async function runEditorModeChecks(page) {
	const report = await page.evaluate(async () => {
		const host = document.body.createDiv(); const settings = fixture.normalizeSettings(null);
		const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const source = 'Before\n\n~~~mermaid\nflowchart LR\n A-->B\n~~~\n\n```pele\nflowchart LR\n C-->D\n```\n\nAfter';
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({ doc: source, extensions: [language, fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension] }) });
		const pause = () => new Promise(resolve => setTimeout(resolve, 40));
		const buttons = () => [...host.querySelectorAll('.advanced-mermaid-editor-mode')];
		const staticMode = index => [...buttons()[index].querySelectorAll('button')].find(button => button.textContent === 'Static Editor').click();
		const button = label => [...host.querySelectorAll('button')].find(element => element.textContent === label);
		const choose = (id, theme = 'both') => { const select = host.querySelector('[aria-label="Insert local override"]'); const target = host.querySelector('[aria-label="Local style theme"]'); target.value = theme; select.value = id; select.dispatchEvent(new Event('change')); };
		view.dispatch({ selection: { anchor: source.indexOf('flowchart') } }); view.focus(); await pause();
		const bars = buttons().length; buttons()[0].querySelectorAll('button')[1].click(); await pause();
		const mermaidOpened = host.querySelectorAll('.advanced-mermaid-editor').length === 1 && view.state.doc.toString() === source;
		settings.liveEditor.activation = 'focused-block'; inline.refresh();
		staticMode(0); await pause();
		view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('A-->B') + 1 } });
		const suppressed = !host.querySelector('.advanced-mermaid-editor');
		view.dispatch({ changes: { from: 0, insert: 'Prefix\n' } }); view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('A-->B') + 2 } });
		const mappedStatic = !host.querySelector('.advanced-mermaid-editor');
		buttons()[0].querySelectorAll('button')[1].click(); await pause();
		const before = view.state.doc.toString(); choose('display:align'); await pause();
		const inserted = view.state.doc.toString().includes('%% advanced-mermaid: align=center');
		const undone = fixture.undo(view) && view.state.doc.toString() === before; fixture.redo(view); await pause();
		choose('style:--pele-surface', 'dark'); await pause(); const styleInserted = view.state.doc.toString().includes('.theme-dark .pele { --pele-surface:');
		const existing = view.state.doc.toString(); choose('style:--pele-surface', 'dark'); const noDuplicate = view.state.doc.toString() === existing;
		const root = host.querySelector('.advanced-mermaid-editor'); const nested = fixture.EditorView.findFromDOM(root.querySelector('.cm-editor'));
		[...root.querySelectorAll('button')].find(element => element.textContent === 'CSS').click(); nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: '.pele { color: red; }' } });
		choose('display:fill'); staticMode(0); const draftProtected = view.state.doc.toString() === existing && !!host.querySelector('.advanced-mermaid-editor');
		button('Discard Changes').click(); staticMode(0); await pause();
		const staticSource = !host.querySelector('.advanced-mermaid-editor') && view.state.doc.toString().includes('~~~mermaid');
		buttons()[1].querySelectorAll('button')[1].click(); await pause(); const oneWidget = host.querySelectorAll('.advanced-mermaid-editor').length === 1;
		settings.liveEditor.enabled = false; inline.refresh(); const disabled = !host.querySelector('.advanced-mermaid-editor') && !host.querySelector('.advanced-mermaid-editor-mode');
		view.destroy(); inline.destroy(); host.remove();
		return { bars, mermaidOpened, suppressed, mappedStatic, inserted, undone, styleInserted, noDuplicate, draftProtected, staticSource, oneWidget, disabled };
	});
	assert.equal(report.bars, 2); for (const [key, value] of Object.entries(report)) if (key !== 'bars') assert.equal(value, true, key);
	console.log('Editor modes passed: both fence languages, session static suppression and mapping, explicit activation, override insertion/undo, draft protection, one widget and disable cleanup.');
}
