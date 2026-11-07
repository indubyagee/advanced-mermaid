import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

export async function runEditorStyleChecks(page) {
	// Mirror the outer note's shrinking content track. Nested editor content is
	// independently sized by the plugin, as in the installed Obsidian CSS.
	const hostStyle = await page.addStyleTag({ content: '.editor-style-fixture { --input-height:48px; } .editor-style-fixture > .cm-editor > .cm-scroller > .cm-content { width: 0; flex-basis: unset !important; }' });
	await page.evaluate(() => {
		const host = document.body.createDiv({ cls: 'editor-style-fixture' }); host.style.width = '900px';
		const settings = fixture.normalizeSettings(null); const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const text = 'Before\n\n```pele\nflowchart LR\n A[Start] --> B[End]\n```\n\nAfter';
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({ doc: text, extensions: [language, fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension] }) });
		view.dispatch({ selection: { anchor: text.indexOf('flowchart') } }); view.focus(); inline.toggle();
		const tab = new fixture.AdvancedMermaidSettingTab(fixture.app, {}, settings, () => inline.refresh()); tab.containerEl = document.body.createDiv(); tab.display();
		window.editorStyles = { host, settings, inline, view, tab };
	});
	try {
		const report = await page.evaluate(async () => {
			const { host, settings, tab } = editorStyles;
			const pageRow = [...tab.containerEl.querySelectorAll('.setting-item')].find(row => row.textContent.includes('Editor style settings'));
			const moved = !tab.containerEl.querySelector('[aria-label="Source font size"]'); pageRow.querySelector('button').click();
			const edit = (label, value) => { const input = tab.containerEl.querySelector(`input[aria-label="${label}"]`); input.value = value; input.dispatchEvent(new Event('input')); return input; };
			const originalDiagram = getComputedStyle(host.querySelector('svg.pele text')).fill;
			const originalDiagramSize = getComputedStyle(host.querySelector('svg.pele text')).fontSize;
			const paired = tab.containerEl.querySelectorAll('input[type="color"]').length === 22;
			const noClose = !tab.containerEl.textContent.includes('Close button') && ![...host.querySelectorAll('button')].some(button => button.textContent === 'Close Editor');
			const sliders = tab.containerEl.querySelectorAll('input[type="range"]').length === 2;
			edit('Source font size', '21'); edit('Button font size', '17');
			const values = {
				'Source font color': ['#123456', '#abcdef'], 'Source background color': ['#f0e0d0', '#102030'],
				'Active buttons font color': ['#223344', '#334455'], 'Inactive buttons font color': ['#445566', '#556677'],
				'Export button font color': ['#8899aa', '#99aabb'],
				'Active buttons background color': ['#aabbcc', '#bbccdd'], 'Inactive buttons background color': ['#ccddee', '#ddeeff'],
				'Export button background color': ['#345cde', '#456def'],
			};
			for (const [name, pair] of Object.entries(values)) { edit(name + ' Light', pair[0]); edit(name + ' Dark', pair[1]); }
			const snapshot = JSON.stringify(settings.liveEditor);
			const themes = [];
			for (const theme of ['light', 'dark']) {
				document.body.classList.toggle('theme-dark', theme === 'dark');
				await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
				const editor = host.querySelector('.advanced-mermaid-editor'); const source = editor.querySelector('.cm-content');
				const paint = element => { const css = getComputedStyle(element); return [css.color, css.backgroundColor]; };
				themes.push({ theme, source: paint(source)[0], background: getComputedStyle(editor.querySelector('.cm-editor')).backgroundColor,
					gutter: getComputedStyle(editor.querySelector('.cm-gutters')).backgroundColor,
					font: getComputedStyle(source).fontSize, sizes: [...host.querySelectorAll('button, .advanced-mermaid-export summary')].map(button => getComputedStyle(button).fontSize),
					active: paint(editor.querySelector('button[aria-selected="true"]')), inactive: paint(editor.querySelector('.advanced-mermaid-draft-actions button')),
					export: paint(editor.querySelector('.advanced-mermaid-export summary')),
					mode: paint(host.querySelector('.advanced-mermaid-editor-mode button[aria-pressed="true"]')),
					statusSize: getComputedStyle(editor.querySelector('.advanced-mermaid-editor-status')).fontSize,
					detailsSize: getComputedStyle(editor.querySelector('.advanced-mermaid-renderer-details summary')).fontSize });
			}
			const invalid = edit('Source font color Light', 'url(https://invalid.example)');
			const invalidRetained = invalid.getAttribute('aria-invalid') === 'true' && JSON.stringify(settings.liveEditor) === snapshot;
			edit('Source font color Light', 'rgba(12, 34, 56, .5)');
			const colorRow = invalid.closest('.setting-item'); colorRow.querySelector('input[type="color"]').value = '#aabbcc'; colorRow.querySelector('input[type="color"]').dispatchEvent(new Event('input'));
			const alpha = settings.liveEditor.style.colors.sourceText.light === '#aabbcc80';
			const roundTrip = JSON.stringify(fixture.normalizeSettings(JSON.parse(JSON.stringify(settings))).liveEditor) === JSON.stringify(settings.liveEditor);
			for (const button of tab.containerEl.querySelectorAll('button[aria-label^="Reset "]')) button.click();
			const reset = settings.liveEditor.fontSizePx === null && settings.liveEditor.style.buttonFontSizePx === null && Object.keys(settings.liveEditor.style.colors).length === 0;
			const diagramUnchanged = getComputedStyle(host.querySelector('svg.pele text')).fill === originalDiagram && getComputedStyle(host.querySelector('svg.pele text')).fontSize === originalDiagramSize;
			const summary = host.querySelector('.advanced-mermaid-export summary'); const box = summary.getBoundingClientRect();
			const range = document.createRange(); range.selectNodeContents(summary); const text = range.getBoundingClientRect();
			const exportCentered = Math.abs(text.top + text.height / 2 - box.top - box.height / 2) < 1 && Math.abs(text.left + text.width / 2 - box.left - box.width / 2) < 1;
			return { moved, paired, noClose, sliders, themes, invalidRetained, alpha, roundTrip, reset, diagramUnchanged, exportCentered };
		});
		for (const name of ['moved', 'paired', 'noClose', 'sliders', 'invalidRetained', 'alpha', 'roundTrip', 'reset', 'diagramUnchanged', 'exportCentered']) assert.equal(report[name], true, name);
		const rgb = hex => `rgb(${hex.match(/../g).map(byte => parseInt(byte, 16)).join(', ')})`;
		for (const [i, result] of report.themes.entries()) {
			assert.equal(result.source, rgb(i ? 'abcdef' : '123456')); assert.equal(result.background, rgb(i ? '102030' : 'f0e0d0')); assert.equal(result.gutter, result.background);
			assert.equal(result.font, '21px'); assert.ok(result.sizes.every(size => size === '17px'), JSON.stringify(result.sizes));
			for (const [key, colors] of Object.entries({ active: i ? ['334455', 'bbccdd'] : ['223344', 'aabbcc'], inactive: i ? ['556677', 'ddeeff'] : ['445566', 'ccddee'], export: i ? ['99aabb', '456def'] : ['8899aa', '345cde'] })) assert.deepEqual(result[key], colors.map(rgb), key);
			assert.deepEqual(result.mode, result.active); assert.equal(result.statusSize, '12px'); assert.equal(result.detailsSize, '12px');
		}
		await page.evaluate(() => {
			document.body.classList.remove('theme-dark'); editorStyles.host.style.width = '320px';
			editorStyles.settings.liveEditor.style.buttonFontSizePx = 40; editorStyles.inline.refresh();
		});
		await page.waitForTimeout(100);
		const largeButtons = await page.locator('.editor-style-fixture').evaluate(host => {
			const editor = host.querySelector('.advanced-mermaid-editor');
			return { contained: editor.scrollWidth <= editor.clientWidth && editor.getBoundingClientRect().width <= host.getBoundingClientRect().width + 1,
				fits: [...editor.querySelectorAll('button')].filter(button => button.textContent && button.getBoundingClientRect().width).every(button => button.scrollHeight <= button.clientHeight + 1) };
		});
		assert.ok(largeButtons.contained && largeButtons.fits, 'Large button text must wrap without clipping in narrow panes: ' + JSON.stringify(largeButtons));
		await page.evaluate(() => { editorStyles.settings.liveEditor.style.buttonFontSizePx = 15; editorStyles.inline.refresh(); });
		await page.waitForTimeout(100);
		await mkdir('test-results', { recursive: true });
		await page.locator('.editor-style-fixture').screenshot({ path: 'test-results/v022-editor-narrow.png' });
		await page.evaluate(() => { editorStyles.host.style.width = '900px'; });
		await page.waitForTimeout(100);
		await page.locator('.editor-style-fixture').screenshot({ path: 'test-results/v022-editor-wide.png' });
		console.log('Editor style checks passed: settings page, paired colors, size controls, centered Export, hidden Close controls, live updates, validation, alpha, resets, persistence round trip and diagram isolation.');
	} finally {
		await page.evaluate(() => { document.body.classList.remove('theme-dark'); editorStyles.tab.hide(); editorStyles.tab.containerEl.remove(); editorStyles.view.destroy(); editorStyles.inline.destroy(); editorStyles.host.remove(); delete window.editorStyles; });
		await hostStyle.evaluate(element => element.remove());
	}
}
