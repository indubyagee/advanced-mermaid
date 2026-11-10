import assert from 'node:assert/strict';

/** Post-user-test regressions run in a real DOM with explicit host adapters. */
export async function runPostTestChecks(page) {
	const fitting = await page.evaluate(async () => {
		const wait = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const results = [];
		for (const direction of ['LR', 'TD']) {
			const item = fixture.diagram(`flowchart ${direction}\n A[Node] --- B[Node]\n B --- C[Node]\n C --- D[Node]`);
			const sizes = [];
			for (const height of ['1vh', '2vh', '4vh', '5vh', '10vh', '25vh', '50vh', '100vh', '4vh']) {
				item.settings.maxHeight = height; item.child.updateSettings(); await wait();
				const svg = item.host.querySelector('svg.pele').getBoundingClientRect();
				const summary = item.host.querySelector('summary');
				const control = summary.getBoundingClientRect();
				sizes.push({ width: svg.width, height: svg.height, intrinsic: item.host.querySelector('svg.pele').getAttribute('viewBox'), below: control.top >= svg.bottom && control.top >= item.host.getBoundingClientRect().top + 40, visible: control.width > 0 && control.height >= 28, label: summary.textContent });
			}
			let bubbled = 0;
			const listener = () => bubbled++;
			document.body.addEventListener('click', listener);
			item.host.querySelector('summary').click();
			document.body.removeEventListener('click', listener);
			results.push({ sizes, bubbled });
			item.child.unload(); item.host.remove();
		}
		const stretched = fixture.diagram('flowchart LR\n A-->B', { maxHeight: '25vh', maintainAspectRatio: false, fillAvailable: true });
		await wait();
		const svg = stretched.host.querySelector('svg.pele');
		const stretch = { width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height, ratio: svg.getAttribute('preserveAspectRatio') };
		stretched.child.unload(); stretched.host.remove();
		return { results, stretch };
	});
	for (const { sizes, bubbled } of fitting.results) {
		for (let i = 1; i < sizes.length - 1; i++) assert.ok(sizes[i].height + .05 >= sizes[i - 1].height);
		assert.ok(Math.abs(sizes[2].height - sizes.at(-1).height) < .05);
		assert.ok(sizes.every(size => size.below && size.visible && size.label === 'Export'));
		assert.equal(bubbled, 0);
		assert.equal(new Set(sizes.map(value => value.intrinsic)).size, 1);
	}
	assert.equal(fitting.stretch.ratio, 'none'); assert.equal(fitting.stretch.height, 200);

	await page.setViewportSize({ width: 1600, height: 800 });
	const widths = await page.evaluate(async () => {
		const pane = document.body.createDiv({ cls: 'markdown-preview-view' });
		pane.style.cssText = 'width:min(1200px, calc(100vw - 80px));padding:20px;box-sizing:border-box;';
		const line = pane.createDiv(); line.style.cssText = 'width:600px;max-width:100%;margin:auto;';
		const paragraph = line.createEl('p', { text: 'Readable note text' });
		const textBefore = paragraph.getBoundingClientRect();
		const item = fixture.diagram('flowchart LR\n A-->B', { fillAvailable: true }, line);
		const layout = item.host.querySelector('.advanced-mermaid-layout');
		const results = [];
		for (const width of ['normal', 'wide', 'maximum', 'none']) {
			item.settings.maxWidth = width; item.child.updateSettings();
			await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			const bounds = layout.getBoundingClientRect(), box = pane.getBoundingClientRect();
			const svg = layout.querySelector('svg.pele').getBoundingClientRect();
			const text = paragraph.getBoundingClientRect();
			results.push({ width: bounds.width, svgWidth: svg.width, centered: Math.abs(bounds.left + bounds.right - box.left - box.right) < .1,
				inside: bounds.left >= box.left + 19 && bounds.right <= box.right - 19, textStable: text.x === textBefore.x && text.width === textBefore.width });
		}
		globalThis.resizeFixture = { item, pane, layout };
		return results;
	});
	for (const [index, expected] of [640, 800, 1020.8, 1160].entries()) {
		const width = widths[index];
		assert.ok(Math.abs(width.width - expected) < .05, JSON.stringify(width));
		assert.ok(Math.abs(width.svgWidth - expected) < .05, JSON.stringify(width));
		assert.ok(width.inside && width.centered && width.textStable, JSON.stringify(width));
	}
	await page.setViewportSize({ width: 800, height: 800 });
	await page.waitForFunction(() => resizeFixture.layout.getBoundingClientRect().width === 680);
	const narrow = await page.evaluate(() => {
		const { item, pane, layout } = resizeFixture;
		item.settings.maxWidth = 'wide'; item.child.updateSettings();
		const width = layout.getBoundingClientRect().width;
		item.child.unload(); pane.remove(); delete globalThis.resizeFixture;
		return width;
	});
	assert.ok(Math.abs(narrow - 598.4) < .05);
	await page.setViewportSize({ width: 1000, height: 800 });

	const theme = await page.evaluate(async () => {
		const source = 'flowchart LR\n subgraph GROUP[Group]\n A[Default] -->|label| B[Palette]:::PRESET3\n B-->C[Authored]:::PRESET4\n end\n style C fill:#123456,color:#abcdef,stroke:#654321,stroke-width:5px';
		const item = fixture.diagram(source, { theme: { background: '#112233', text: '#eeeeee', nodeFill: '#224466', nodeBorder: '#abcdef', nodeText: '#fefefe',
			line: '#fedcba', edgeLabelFill: '#334455', edgeLabelText: '#aabbcc', edgeLabelBorder: '#778899', subgraphFill: '#445566', subgraphBorder: '#ccbbaa', subgraphText: '#ffffff',
			nodeBorderWidth: '2px', edgeWidth: '3px', edgeLabelBorderWidth: '2px', subgraphBorderWidth: '4px' } });
		const style = selector => { const s = getComputedStyle(item.host.querySelector(selector)); return { fill: s.fill, stroke: s.stroke, width: s.strokeWidth, opacity: s.fillOpacity }; };
		const node = id => `.pele-node[data-id="${id}"]`;
		const computed = { canvas: getComputedStyle(item.host.querySelector('svg.pele')).backgroundColor, node: style(`${node('A')} rect`), palette: style(`${node('B')} rect`), authored: style(`${node('C')} rect`),
			text: style(`${node('A')} text`), authoredText: style(`${node('C')} text`), edge: style('.pele-edge path'), label: style('.pele-edge-label rect'), labelText: style('.pele-edge-label text'),
			cluster: style('.pele-cluster rect'), clusterText: style('.pele-cluster text') };
		const snapshot = await fixture.createSvgSnapshot(fixture.render(source, { images: false }), item.host, () => true);
		const exported = new DOMParser().parseFromString(snapshot.svg, 'image/svg+xml');
		const exportedPalette = exported.querySelector(`${node('B')} rect`).style.fill;
		const exportedAuthored = exported.querySelector(`${node('C')} rect`).style.fill;
		const png = await fixture.createPng(snapshot, document, new AbortController().signal);
		const bitmap = await createImageBitmap(png);
		const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
		const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
		const corner = [...ctx.getImageData(0, 0, 1, 1).data]; bitmap.close();
		const before = Number(item.host.querySelector('svg.pele').getAttribute('width'));
		item.settings.theme.labelSize = '32px'; item.child.updateSettings();
		const after = Number(item.host.querySelector('svg.pele').getAttribute('width'));
		const measuredFont = getComputedStyle(item.host.querySelector(`${node('A')} text`)).fontSize;
		delete item.settings.theme.nodeFill; delete item.settings.style.global.elements.nodeFill; item.child.updateSettings();
		const reset = style(`${node('A')} rect`).fill;
		item.child.unload(); item.host.remove();
		return { computed, exportedPalette, exportedAuthored, corner, before, after, measuredFont, reset };
	});
	const { computed } = theme;
	assert.equal(computed.canvas, 'rgb(17, 34, 51)');
	assert.deepEqual(computed.node, { fill: 'rgb(34, 68, 102)', stroke: 'rgb(171, 205, 239)', width: '2px', opacity: '1' });
	assert.equal(computed.palette.fill, 'rgb(45, 70, 70)'); assert.equal(computed.palette.stroke, 'rgb(96, 143, 148)');
	assert.equal(computed.authored.fill, 'rgb(18, 52, 86)'); assert.equal(computed.authored.stroke, 'rgb(101, 67, 33)'); assert.equal(computed.authored.width, '5px');
	assert.equal(computed.text.fill, 'rgb(254, 254, 254)'); assert.equal(computed.authoredText.fill, 'rgb(171, 205, 239)');
	assert.equal(computed.edge.stroke, 'rgb(254, 220, 186)'); assert.equal(computed.edge.width, '3px');
	assert.equal(computed.label.fill, 'rgb(51, 68, 85)'); assert.equal(computed.label.stroke, 'rgb(119, 136, 153)');
	assert.equal(computed.labelText.fill, 'rgb(170, 187, 204)');
	assert.equal(computed.cluster.fill, 'rgb(68, 85, 102)'); assert.equal(computed.cluster.stroke, 'rgb(204, 187, 170)'); assert.equal(computed.cluster.width, '4px'); assert.equal(computed.cluster.opacity, '1');
	assert.equal(computed.clusterText.fill, 'rgb(255, 255, 255)');
	assert.equal(theme.exportedPalette, computed.palette.fill); assert.equal(theme.exportedAuthored, computed.authored.fill);
	assert.deepEqual(theme.corner, [17, 34, 51, 255]);
	assert.ok(theme.after > theme.before, `Measured size did not increase: ${JSON.stringify({ before: theme.before, after: theme.after, font: theme.measuredFont })}`); assert.equal(theme.measuredFont, '32px'); assert.notEqual(theme.reset, computed.node.fill);
	const palette = await page.evaluate(() => {
		const names = ['PRESET1', 'PRESET2', 'PRESET3', 'PRESET4', 'PRESET5', 'PRESET6', 'PRESET7', 'PRESET8'];
		const item = fixture.diagram('flowchart LR\n subgraph GROUP[Group]\n' + names.map((name, i) => ` N${i}[${name}]:::${name}`).join('\n') + '\n end\n class GROUP PRESET2');
		const colors = names.map((_, i) => getComputedStyle(item.host.querySelector(`.pele-node[data-id="N${i}"] rect`)).fill);
		const group = getComputedStyle(item.host.querySelector('.pele-cluster rect'));
		const result = { colors, group: group.fill, opacity: group.fillOpacity };
		item.child.unload(); item.host.remove(); return result;
	});
	assert.deepEqual(palette.colors, ['rgb(128, 128, 128)', 'rgb(21, 21, 21)', 'rgb(45, 70, 70)', 'rgb(50, 65, 30)', 'rgb(80, 30, 30)', 'rgb(70, 55, 90)', 'rgb(110, 90, 40)', 'rgb(90, 50, 80)']);
	assert.equal(palette.group, 'rgb(21, 21, 21)'); assert.equal(palette.opacity, '1');

	const ui = await page.evaluate(async () => {
		const item = fixture.diagram('flowchart LR\n A-->B');
		let changes = 0;
		const tab = new fixture.AdvancedMermaidSettingTab(fixture.app, {}, item.settings, () => changes++);
		tab.containerEl = document.body.createDiv(); tab.display();
		const heightInput = tab.containerEl.querySelector('input[aria-label="Maximum height"]');
		const heightPreset = tab.containerEl.querySelector('select[aria-label="Height preset"]');
		heightInput.value = '17rem'; heightInput.dispatchEvent(new Event('input'));
		const customHeight = item.settings.maxHeight === '17rem' && heightPreset.value === 'custom';
		heightPreset.value = 'short'; heightPreset.dispatchEvent(new Event('change'));
		const presetHeight = item.settings.maxHeight === 'short' && heightInput.value === 'short';
		const globalPage = [...tab.containerEl.querySelectorAll('.setting-item')].find(row => [...row.querySelectorAll('label')].some(label => label.textContent === 'Global style settings'));
		globalPage.querySelector('button').click();
		const text = tab.containerEl.querySelector('input[aria-label="Primary text Light"]');
		text.value = '#12345678'; text.dispatchEvent(new Event('input'));
		const picker = tab.containerEl.querySelector('input[aria-label="Primary text Light picker"]');
		picker.value = '#abcdef'; picker.dispatchEvent(new Event('input'));
		const picked = item.settings.style.global.colors.text?.light;
		text.value = 'url(https://invalid.example)'; text.dispatchEvent(new Event('input'));
		const invalid = text.getAttribute('aria-invalid') === 'true' && item.settings.style.global.colors.text?.light === picked;
		picker.value = '#010203'; picker.dispatchEvent(new Event('input'));
		const recovered = text.checkValidity() && text.value === '#01020378';
		text.closest('.setting-item').querySelector('button').click();
		const reset = item.settings.style.global.colors.text === undefined;
		let selected;
		const input = document.body.createEl('input');
		const suggest = new fixture.VaultFolderSuggest(fixture.app, input, path => { selected = path; });
		const folders = suggest.getSuggestions('nested'); const root = suggest.getSuggestions('');
		suggest.selectSuggestion('notes/nested');
		let saved, finished;
		const modal = new fixture.SaveExportModal(fixture.app, 'test.svg', '', async folder => { saved = folder; return `${folder}/test.svg`; }, path => { if (path) finished = path; });
		modal.open(); modal.suggestions.selectSuggestion('notes/nested');
		const preview = modal.contentEl.textContent.includes('notes/nested/test.svg');
		[...modal.contentEl.querySelectorAll('button')].find(button => button.textContent === 'Save').click();
		for (let i = 0; i < 20 && !finished; i++) await new Promise(resolve => setTimeout(resolve, 5));
		input.remove(); tab.hide(); tab.containerEl.remove(); item.child.unload(); item.host.remove();
		return { picked, invalid, recovered, reset, customHeight, presetHeight, changes, folders, root, selected, preview, saved, finished };
	});
	assert.equal(ui.picked, '#abcdef78'); assert.ok(ui.invalid && ui.recovered && ui.reset && ui.changes >= 4);
	assert.ok(ui.customHeight && ui.presetHeight);
	assert.deepEqual(ui.folders, ['notes/nested']); assert.ok(ui.root.includes(''));
	assert.equal(ui.selected, 'notes/nested'); assert.ok(ui.preview); assert.equal(ui.saved, 'notes/nested'); assert.equal(ui.finished, 'notes/nested/test.svg');
	console.log('Post-test regressions passed: monotonic sizing, footer isolation, pane expansion/resize, stretching, styled SVG/PNG, measured labels, color pickers and folder selection.');
}
