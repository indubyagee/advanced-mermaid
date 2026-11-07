import assert from 'node:assert/strict';

export async function runZoomStyleChecks(page) {
	const report = await page.evaluate(async () => {
		const root = document.body.createDiv(); root.style.cssText = 'width:900px;--text-normal:#222222;--background-primary:#eeeeee;--background-modifier-border:#888888;';
		const settings = fixture.normalizeSettings({ schemaVersion: 4, style: { global: { colors: { border: { light: '#ff0000', dark: '#00ff00' } } } },
			liveEditor: { style: { colors: { inactiveButtonText: { light: '#123456', dark: '#234567' }, inactiveButtonBackground: { light: '#345678', dark: '#456789' }, closeButtonText: { light: '#abcdef' } } } } });
		const source = '%% advanced-mermaid-style:v1\n%% .pele { --pele-border: #ff0000; --pele-bg: #445566; --pele-fg: #778899; }\n%% .theme-dark .pele { --pele-border: #00ff00; --pele-bg: #556677; --pele-fg: #8899aa; }\n%% advanced-mermaid-style:end\nflowchart LR\n A[Zoom] --> B[Styles]';
		const text = 'Before\n\n```pele\n' + source + '\n```\n\nAfter';
		const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const view = new fixture.EditorView({ parent: root, state: fixture.EditorState.create({ doc: text, extensions: [language, fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension] }) });
		view.dispatch({ selection: { anchor: text.indexOf('flowchart') } }); view.focus(); inline.toggle();
		const reading = { host: root.createDiv() };
		reading.child = new fixture.DiagramController(reading.host, source, () => settings, fixture.app, 'Zoom.md'); reading.child.load();
		const tab = new fixture.AdvancedMermaidSettingTab(fixture.app, {}, settings, () => { inline.refresh(); reading.child.updateSettings(); });
		tab.containerEl = root.createDiv(); tab.display();
		[...tab.containerEl.querySelectorAll('.setting-item')].find(row => row.textContent.includes('Editor style settings')).querySelector('button').click();
		const edit = (label, value) => { const input = tab.containerEl.querySelector(`[aria-label="${label}"]`); input.value = value; input.dispatchEvent(new Event('input')); return input; };
		const toggle = () => [...tab.containerEl.querySelectorAll('.setting-item')].find(row => [...row.querySelectorAll('label')].some(label => label.textContent === 'Use global styles')).querySelector('input').click();
		const wait = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const colors = host => {
			const zoom = host.querySelector('.pele-zoom'); const button = zoom.querySelector('button');
			return { border: getComputedStyle(zoom).borderColor, text: getComputedStyle(button).color, background: getComputedStyle(zoom).backgroundColor, buttonBackground: getComputedStyle(button).backgroundColor };
		};
		try {
			await wait();
			const defaultIndependent = colors(reading.host).border === 'rgb(136, 136, 136)' && colors(root.querySelector('.advanced-mermaid-editor')).border === 'rgb(136, 136, 136)';
			for (const [name, light, dark] of [['border', '#112233', '#223344'], ['font', '#334455', '#445566'], ['background', '#556677', '#667788']]) {
				edit('Zoom ' + name + ' color Light', light); edit('Zoom ' + name + ' color Dark', dark);
			}
			const snapshots = [];
			for (const dark of [false, true]) {
				document.body.classList.toggle('theme-dark', dark); await wait();
				snapshots.push({ live: colors(root.querySelector('.advanced-mermaid-editor')), reading: colors(reading.host) });
			}
			const saved = JSON.stringify(settings.liveEditor.style.zoom.colors);
			const invalid = edit('Zoom border color Light', 'var(--pele-border)');
			const invalidRetained = invalid.getAttribute('aria-invalid') === 'true' && JSON.stringify(settings.liveEditor.style.zoom.colors) === saved;
			toggle(); await wait();
			const global = { live: colors(root.querySelector('.advanced-mermaid-editor')), reading: colors(reading.host) };
			const globalHidesOverrides = !tab.containerEl.querySelector('[aria-label="Zoom border color Light"]');
			const retained = JSON.stringify(settings.liveEditor.style.zoom.colors) === saved;
			toggle(); await wait(); const returned = colors(reading.host).border === 'rgb(34, 51, 68)';
			const legacyCloseRetained = settings.liveEditor.style.colors.closeButtonText.light === '#abcdef' && !root.querySelector('[data-pele-button="close"]') && !tab.containerEl.textContent.includes('Close button');
			tab.containerEl.querySelector('[aria-label="Reset Zoom border color Light"]').click();
			const independentReset = !settings.liveEditor.style.zoom.colors.border.light && settings.liveEditor.style.zoom.colors.border.dark === '#223344';
			const persisted = fixture.normalizeSettings(JSON.parse(JSON.stringify(settings)));
			const roundTrip = JSON.stringify(persisted.liveEditor.style.zoom) === JSON.stringify(settings.liveEditor.style.zoom);
			return { defaultIndependent, snapshots, invalidRetained, global, globalHidesOverrides, retained, returned, legacyCloseRetained, independentReset, roundTrip };
		} finally { document.body.classList.remove('theme-dark'); tab.hide(); tab.containerEl.remove(); reading.child.unload(); view.destroy(); inline.destroy(); root.remove(); }
	});
	for (const key of ['defaultIndependent', 'invalidRetained', 'globalHidesOverrides', 'retained', 'returned', 'legacyCloseRetained', 'independentReset', 'roundTrip']) assert.equal(report[key], true, key);
	for (const [i, snapshot] of report.snapshots.entries()) {
		const expected = i ? { border: 'rgb(34, 51, 68)', text: 'rgb(68, 85, 102)', background: 'rgb(102, 119, 136)', buttonBackground: 'rgb(102, 119, 136)' } : { border: 'rgb(17, 34, 51)', text: 'rgb(51, 68, 85)', background: 'rgb(85, 102, 119)', buttonBackground: 'rgb(85, 102, 119)' };
		assert.deepEqual(snapshot.live, expected); assert.deepEqual(snapshot.reading, expected);
	}
	assert.equal(report.global.live.border, 'rgb(0, 255, 0)'); assert.equal(report.global.reading.border, 'rgb(0, 255, 0)');
	assert.equal(report.global.live.text, 'rgb(35, 69, 103)'); assert.equal(report.global.reading.text, 'rgb(136, 153, 170)');
	console.log('Zoom style checks passed: independent border/text/background precedence in both themes and view surfaces, inherited mode, retained overrides, resets, validation and persistence.');
}
