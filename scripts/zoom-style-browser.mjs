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
		const reading = { host: root.createDiv({ cls: 'markdown-preview-view' }).createDiv() };
		reading.child = new fixture.DiagramController(reading.host, source, () => settings, fixture.app, 'Zoom.md'); reading.child.load();
		const preview = { host: root.createDiv({ cls: 'cm-scroller' }).createDiv() };
		preview.child = new fixture.DiagramController(preview.host, source, () => settings, fixture.app, 'Zoom.md'); preview.child.load();
		const tab = new fixture.AdvancedMermaidSettingTab(fixture.app, {}, settings, () => { inline.refresh(); reading.child.updateSettings(); preview.child.updateSettings(); });
		tab.containerEl = root.createDiv(); tab.display();
		[...tab.containerEl.querySelectorAll('.setting-item')].find(row => [...row.querySelectorAll('label')].some(label => label.textContent === 'Zoom controls')).querySelector('button').click();
		const edit = (label, value) => { const input = tab.containerEl.querySelector(`[aria-label="${label}"]`); input.value = value; input.dispatchEvent(new Event('input')); return input; };
		const toggle = () => [...tab.containerEl.querySelectorAll('.setting-item')].find(row => [...row.querySelectorAll('label')].some(label => label.textContent === 'Use inherited colors')).querySelector('input').click();
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
			const globalHidesOverrides = !!tab.containerEl.querySelector('[aria-label="Zoom border color Light"]').closest('[hidden]');
			const retained = JSON.stringify(settings.liveEditor.style.zoom.colors) === saved;
			toggle(); await wait(); const returned = colors(reading.host).border === 'rgb(34, 51, 68)';
			const legacyCloseRetained = settings.liveEditor.style.colors.closeButtonText.light === '#abcdef' && !root.querySelector('[data-pele-button="close"]') && !tab.containerEl.textContent.includes('Close button');
			tab.containerEl.querySelector('[aria-label="Reset Zoom border color Light"]').click();
			const independentReset = !settings.liveEditor.style.zoom.colors.border.light && settings.liveEditor.style.zoom.colors.border.dark === '#223344';
			root.style.width = '300px';
			await wait();
			const surfaces = [reading.host, preview.host, root.querySelector('.advanced-mermaid-editor-render')];
			const select = (label, value) => {
				const input = tab.containerEl.querySelector(`[aria-label="Zoom button ${label}"]`);
				input.value = value; input.dispatchEvent(new Event('change'));
			};
			const placements = [];
			for (const orientation of ['vertical', 'horizontal']) {
				select('orientation', orientation);
				for (const placement of ['top-left', 'bottom-left', 'top-right', 'bottom-right']) {
					select('placement', placement);
					await wait();
					const matches = surfaces.map(surface => {
						const viewport = surface.querySelector('.advanced-mermaid-viewport').getBoundingClientRect();
						const svg = surface.querySelector('svg.pele').getBoundingClientRect();
						const rail = surface.querySelector('.pele-zoom');
						const { top, left, right, bottom } = rail.getBoundingClientRect();
						const [y, x] = placement.split('-');
						const separated = orientation === 'vertical' ? (x === 'left' ? right <= svg.left : left >= svg.right)
							: (y === 'top' ? bottom <= svg.top : top >= svg.bottom);
						return separated && Math.abs(Math.abs({ top, bottom }[y] - viewport[y]) - 8) < 1
							&& Math.abs(Math.abs({ left, right }[x] - viewport[x]) - 8) < 1
							&& getComputedStyle(rail).flexDirection === (orientation === 'vertical' ? 'column' : 'row')
							&& [...rail.querySelectorAll('button')].every(button => button.offsetWidth >= 24 && button.offsetHeight >= 24);
					});
					placements.push({ orientation, placement, matches });
				}
			}
			const views = surfaces.map(surface => {
				const mount = surface.querySelector('.advanced-mermaid-mount');
				const svg = mount.querySelector('svg.pele');
				const fit = svg.getAttribute('viewBox');
				surface.querySelector('.pele-zoom-in').click();
				return { mount, svg, fit, zoomed: svg.getAttribute('viewBox') };
			});
			select('placement', 'top-left'); await wait();
			const stable = surfaces.map((surface, index) => {
				const { mount, svg, fit, zoomed } = views[index];
				const moved = svg.getAttribute('viewBox');
				const sameMount = mount === surface.querySelector('.advanced-mermaid-mount') && svg === surface.querySelector('svg.pele');
				const canZoomOut = !surface.querySelector('.pele-zoom-out').disabled;
				return { sameMount, canZoomOut, fit, zoomed, moved };
			});
			select('orientation', 'vertical'); await wait();
			const resized = surfaces.map((surface, index) => {
				const { svg, fit } = views[index];
				const button = surface.querySelector('.pele-zoom-out');
				const stillZoomed = !button.disabled && svg.getAttribute('viewBox') !== fit;
				button.click();
				return { stillZoomed, restored: svg.getAttribute('viewBox'), fit };
			});
			const persisted = fixture.normalizeSettings(JSON.parse(JSON.stringify(settings)));
			const roundTrip = JSON.stringify(persisted.liveEditor.style.zoom) === JSON.stringify(settings.liveEditor.style.zoom);
			return { defaultIndependent, snapshots, invalidRetained, global, globalHidesOverrides, retained, returned, legacyCloseRetained, independentReset, roundTrip, placements, stable, resized };
		} finally { document.body.classList.remove('theme-dark'); tab.hide(); tab.containerEl.remove(); reading.child.unload(); preview.child.unload(); view.destroy(); inline.destroy(); root.remove(); }
	});
	for (const key of ['defaultIndependent', 'invalidRetained', 'globalHidesOverrides', 'retained', 'returned', 'legacyCloseRetained', 'independentReset', 'roundTrip']) assert.equal(report[key], true, key);
	for (const [i, snapshot] of report.snapshots.entries()) {
		const expected = i ? { border: 'rgb(34, 51, 68)', text: 'rgb(68, 85, 102)', background: 'rgb(102, 119, 136)', buttonBackground: 'rgb(102, 119, 136)' } : { border: 'rgb(17, 34, 51)', text: 'rgb(51, 68, 85)', background: 'rgb(85, 102, 119)', buttonBackground: 'rgb(85, 102, 119)' };
		assert.deepEqual(snapshot.live, expected); assert.deepEqual(snapshot.reading, expected);
	}
	assert.equal(report.global.live.border, 'rgb(0, 255, 0)'); assert.equal(report.global.reading.border, 'rgb(0, 255, 0)');
	assert.equal(report.global.live.text, 'rgb(35, 69, 103)'); assert.equal(report.global.reading.text, 'rgb(136, 153, 170)');
	for (const { placement, orientation, matches } of report.placements) assert.deepEqual(matches, [true, true, true], `${placement} ${orientation}`);
	for (const state of report.stable) {
		assert.ok(state.sameMount && state.canZoomOut && state.fit !== state.zoomed, JSON.stringify(state));
		assert.equal(state.moved, state.zoomed, 'Changing the corner retains the zoomed viewBox');
	}
	for (const state of report.resized) {
		assert.ok(state.stillZoomed, JSON.stringify(state));
		assert.equal(state.restored, state.fit, 'Zoom Out restores the fitted viewBox after changing orientation');
	}
	console.log('Zoom style checks passed: independent border/text/background precedence in both themes and view surfaces, inherited mode, retained overrides, resets, validation and persistence.');
}
