import assert from 'node:assert/strict';

export async function runDiagramRefreshChecks(page) {
	const result = await page.evaluate(async () => {
		const wait = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const pane = document.body.createDiv({ cls: 'markdown-preview-view' });
		pane.style.width = '950px';
		const source = 'flowchart TD\n' + Array.from({ length: 18 }, (_, i) => ` A${i}[Node ${i}] --> A${i + 1}`).join('\n');
		const charts = Array.from({ length: 12 }, () => fixture.diagram(source, undefined, pane));
		const svgs = () => charts.map(({ host }) => host.querySelector('.advanced-mermaid-mount > svg.pele'));
		const replacements = before => svgs().filter((svg, index) => svg !== before[index]).length;
		const align = alignment => {
			for (const { child, settings } of charts) { settings.alignment = alignment; child.updateSettings(); }
		};
		try {
			await wait();
			if (svgs().some(svg => !svg)) throw new Error('Diagram refresh fixture did not render');
			align('right');
			await wait();
			align('left');
			await wait();
			const timings = [];
			let alignmentReplacements = 0;
			for (let i = 0; i < 9; i++) {
				const before = svgs();
				const start = performance.now();
				align(i % 2 ? 'left' : 'right');
				timings.push(performance.now() - start);
				await wait();
				alignmentReplacements = Math.max(alignmentReplacements, replacements(before));
			}
			const aligned = charts.every(({ host }) => host.dataset.align === 'right');
			let before = svgs();
			for (const { child, settings } of charts) {
				settings.style.global.colors.text = { light: '#123456' };
				child.updateSettings();
			}
			await wait();
			const colorReplacements = replacements(before);
			const colorsApplied = svgs().every(svg => getComputedStyle(svg.querySelector('.pele-label')).fill === 'rgb(18, 52, 86)');
			before = svgs();
			document.body.classList.add('fixture-unrelated-class');
			await wait();
			return { alignmentReplacements, colorReplacements, bodyClassReplacements: replacements(before), aligned, colorsApplied,
			medianAlignmentMs: Math.round(timings.sort((a, b) => a - b)[4] * 10) / 10 };
		} finally {
			for (const { child } of charts) child.unload();
			pane.remove();
			document.body.classList.remove('fixture-unrelated-class');
		}
	});
	console.log('Diagram refresh measurements:', JSON.stringify(result));
	assert.equal(result.alignmentReplacements, 0);
	assert.equal(result.colorReplacements, 0);
	assert.equal(result.bodyClassReplacements, 0);
	assert.ok(result.aligned && result.colorsApplied);
}

export async function runDiagramEnvironmentChecks(page) {
	const result = await page.evaluate(async () => {
		const trackBodyObservers = view => {
			const { prototype } = view.MutationObserver;
			const { observe, disconnect } = prototype;
			const observers = new Set();
			prototype.observe = function (target, options) {
				observe.call(this, target, options);
				if (target === view.document.body) observers.add(this);
			};
			prototype.disconnect = function () { disconnect.call(this); observers.delete(this); };
			return { observers, restore() { Object.assign(prototype, { observe, disconnect }); } };
		};
		const wait = view => new Promise(resolve => view.requestAnimationFrame(() => view.requestAnimationFrame(resolve)));
		const frame = document.body.createEl('iframe');
		const popout = frame.contentWindow;
		fixture.installDomHelpers(popout);
		popout.document.head.createEl('style', { text: document.head.querySelector('style').textContent });
		const mainObservers = trackBodyObservers(window);
		const popoutObservers = trackBodyObservers(popout);
		let cssChange;
		const app = { ...fixture.app, workspace: { ...fixture.app.workspace, on(name, callback) {
			if (name === 'css-change') cssChange = callback;
			return {};
		} } };
		const plugin = new fixture.AdvancedMermaidPlugin(app, { id: 'environment-fixture' });
		const updateSettings = fixture.DiagramController.prototype.updateSettings;
		let refreshes = 0;
		fixture.DiagramController.prototype.updateSettings = function () { refreshes++; updateSettings.call(this); };
		const hosts = [];
		let report;
		try {
			await plugin.onload();
			plugin.settings.style.global.colors.text = { light: '#123456', dark: '#654321' };
			const { handler } = plugin.processors.get('pele');
			const render = () => {
				const host = document.body.createDiv({ cls: 'fixture-diagram' });
				hosts.push(host);
				let controller;
				handler('flowchart LR\n A[Measured text] --> B[Other label]', host, {
					sourcePath: 'Environment.md', getSectionInfo: () => null,
					addChild(child) { child.load(); controller = child.controller; },
				});
				return { host, controller };
			};
			const { host: moved } = render();
			const { host: reading, controller } = render();
			const svg = host => host.querySelector('svg.pele');
			await wait(window);
			const shared = mainObservers.observers.size === 1;
			refreshes = 0;
			const inFlight = controller.snapshot().then(() => false, error => error.message.includes('The diagram changed'));
			document.body.classList.add('theme-dark');
			cssChange();
			const staleExportRejected = await inFlight;
			await wait(window);
			const coalesced = refreshes;
			const initial = svg(reading);
			document.body.style.setProperty('--font-text', 'Courier New');
			await wait(window);
			const fontMeasured = svg(reading) !== initial && svg(reading).getAttribute('width') !== initial.getAttribute('width');
			popout.document.body.append(moved);
			moved.dispatchEvent(new popout.Event('fixture-window-migrated'));
			const text = host => host.ownerDocument.defaultView.getComputedStyle(svg(host).querySelector('.pele-label')).fill;
			const separateThemes = text(moved) === 'rgb(18, 52, 86)' && text(reading) === 'rgb(101, 67, 33)';
			const popoutSubscribed = popoutObservers.observers.size === 1;
			popout.document.body.classList.add('theme-dark');
			await wait(popout);
			const popoutUpdated = text(moved) === 'rgb(101, 67, 33)';
			report = { shared, coalesced, staleExportRejected, fontMeasured, separateThemes, popoutSubscribed, popoutUpdated };
		} finally {
			plugin.unload();
			fixture.DiagramController.prototype.updateSettings = updateSettings;
			mainObservers.restore(); popoutObservers.restore();
			for (const host of hosts) host.remove();
			frame.remove();
			document.body.classList.remove('theme-dark');
			document.body.style.removeProperty('--font-text');
		}
		return { ...report, cleaned: mainObservers.observers.size === 0 && popoutObservers.observers.size === 0 };
	});
	assert.deepEqual(result, { shared: true, coalesced: 2, staleExportRejected: true, fontMeasured: true, separateThemes: true,
		popoutSubscribed: true, popoutUpdated: true, cleaned: true });
}

export async function runDiagramErrorChecks(page) {
	const result = await page.evaluate(async () => {
		const host = document.body.createDiv({ cls: 'fixture-diagram' });
		const settings = fixture.normalizeSettings(null);
		const source = 'flowchart LR\n A --> B';
		const controller = new fixture.DiagramController(host, source, () => settings, fixture.app, 'Error.md');
		const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
		const copied = [];
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { async writeText(text) { copied.push(text); } } });
		controller.load();
		try {
			const baseline = controller.cleanup.length;
			const feedback = host.querySelector('.advanced-mermaid-error');
			let firstButton;
			for (let i = 0; i < 40; i++) {
				controller.setSource('\n'.repeat(i) + '%% advanced-mermaid: align=invalid\n' + source);
				firstButton ??= feedback.querySelector('button');
			}
			const registrations = controller.cleanup.length - baseline;
			const buttons = feedback.querySelectorAll('button');
			const message = feedback.querySelector('.advanced-mermaid-error-message').textContent;
			const latestButton = buttons[0];
			if (firstButton !== latestButton) firstButton.click();
			latestButton.click();
			controller.unload();
			latestButton.click();
			return { registrations, buttons: buttons.length, copiedLatest: copied.length === 1 && copied[0] === message &&
				message.includes('line 40'), cleaned: controller.cleanup.length === 0 };
		} finally {
			if (host.firstChild) controller.unload();
			if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard); else delete navigator.clipboard;
			host.remove();
		}
	});
	console.log('Diagram error feedback checks:', JSON.stringify(result));
	assert.deepEqual(result, { registrations: 0, buttons: 1, copiedLatest: true, cleaned: true });
}

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
		fixture.app.plugins.manifests['obsidian-minimal-settings'] = { id: 'obsidian-minimal-settings' };
		fixture.app.plugins.plugins['obsidian-minimal-settings'] = { settings: { lineWidth: 40, lineWidthWide: 50, maxWidth: 88 } };
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
		delete fixture.app.plugins.manifests['obsidian-minimal-settings'];
		delete fixture.app.plugins.plugins['obsidian-minimal-settings'];
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
