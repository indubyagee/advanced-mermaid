import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

export async function runEditorStyleChecks(page) {
	// Mirror the outer note's shrinking content track. Nested editor content is
	// independently sized by the plugin, as in the installed Obsidian CSS.
	const hostStyle = await page.addStyleTag({ content: `
		.editor-style-fixture { --input-height:48px; --input-radius:7px; --button-radius:6px; }
		.theme-dark .editor-style-fixture { --text-normal: #ddd; }
		.editor-style-fixture > .cm-editor > .cm-scroller > .cm-content { width: 0; flex-basis: unset !important; }
		.editor-style-fixture button, .editor-style-fixture :where(select) { box-shadow: 0 1px 2px #666; background-image: linear-gradient(#eee, #ccc); }
	` });
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
			const pageRow = [...tab.containerEl.querySelectorAll('.setting-item')].find(row => row.textContent.includes('Editor appearance'));
			const moved = !tab.containerEl.querySelector('[aria-label="Source font size"]'); pageRow.querySelector('button').click();
			const edit = (label, value) => { const input = tab.containerEl.querySelector(`input[aria-label="${label}"]`); input.value = value; input.dispatchEvent(new Event('input')); return input; };
			const originalDiagram = getComputedStyle(host.querySelector('svg.pele text')).fill;
			const originalDiagramSize = getComputedStyle(host.querySelector('svg.pele text')).fontSize;
			const paired = tab.containerEl.querySelectorAll('input[type="color"]').length === 28;
			const noClose = !tab.containerEl.textContent.includes('Close button') && ![...host.querySelectorAll('button')].some(button => button.textContent === 'Close Editor');
			const sliders = tab.containerEl.querySelectorAll('input[type="range"]').length === 4;
			const radius = element => getComputedStyle(element).borderTopLeftRadius;
			const themeDefaults = () =>
				[...host.querySelectorAll('button, select, .advanced-mermaid-export summary')].every(control => getComputedStyle(control).borderTopWidth === '0px') &&
				radius(host.querySelector('.advanced-mermaid-editor-mode button')) === '6px' &&
				radius(host.querySelector('.advanced-mermaid-editor select')) === '7px' &&
				radius(host.querySelector('.advanced-mermaid-export summary')) === '4px';
			const defaults = themeDefaults();
			const caretColor = () => getComputedStyle(fixture.sourceRoot(host).querySelector('.cm-content')).caretColor;
			const lightCaret = caretColor();
			document.body.classList.add('theme-dark');
			const darkCaret = caretColor();
			document.body.classList.remove('theme-dark');
			const defaultCaret = [lightCaret, darkCaret];
			edit('Source font size', '21'); edit('Button font size', '17');
			edit('Line number font size', '34');
			edit('Button corner radius slider', '14');
			const values = {
				'Source font color': ['#123456', '#abcdef'], 'Source background color': ['#f0e0d0', '#102030'],
				'Line number font color': ['#123789', '#ba7654'],
				'Indent guide color': ['#135724', '#ace024'], 'Expand/collapse arrow color': ['#246813', '#bdf135'],
				'Active buttons font color': ['#223344', '#334455'], 'Inactive buttons font color': ['#445566', '#556677'],
				'Export button font color': ['#8899aa', '#99aabb'],
				'Active buttons background color': ['#aabbcc', '#bbccdd'], 'Inactive buttons background color': ['#ccddee', '#ddeeff'],
				'Export button background color': ['#345cde', '#456def'],
				'Active buttons border color': ['#123abc', '#234bcd'], 'Inactive buttons border color': ['#345cde', '#456def'],
				'Export button border color': ['#567efa', '#678fab'],
			};
			for (const [name, pair] of Object.entries(values)) { edit(name + ' Light', pair[0]); edit(name + ' Dark', pair[1]); }
			const snapshot = JSON.stringify(settings.liveEditor);
			const themes = [];
			for (const theme of ['light', 'dark']) {
				document.body.classList.toggle('theme-dark', theme === 'dark');
				await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
				const editor = host.querySelector('.advanced-mermaid-editor'); const source = fixture.sourceRoot(editor);
				const paint = element => {
					const css = getComputedStyle(element);
					return [css.color, css.backgroundColor, css.borderTopStyle === 'solid' && css.borderTopWidth === '1px' ? css.borderTopColor : null];
				};
				const buttons = [...host.querySelectorAll('button, .advanced-mermaid-export summary')];
				const dropdowns = [...editor.querySelectorAll('select')];
				const flat = buttons.every(button => {
					const css = getComputedStyle(button);
					return css.boxShadow === 'none' && css.backgroundImage === 'none';
				});
				const dropdownsFlat = dropdowns.every(select => {
					const css = getComputedStyle(select);
					return css.appearance === 'none' && css.boxShadow === 'none';
				});
				const rounded = [...buttons.filter(button => !button.closest('.pele-zoom')), ...dropdowns].every(control => radius(control) === '14px');
				const content = source.querySelector('.cm-content');
				const lineNumber = getComputedStyle(source.querySelector('.cm-lineNumbers .cm-gutterElement'));
				themes.push({ theme, source: paint(content)[0], caret: caretColor(), token: paint(content.querySelector('span'))[0], background: getComputedStyle(source.querySelector('.cm-editor')).backgroundColor,
					guide: getComputedStyle(source.querySelector('.am-indent-guides')).backgroundImage,
					arrow: getComputedStyle(source.querySelector('.am-fold-arrow')).color,
					gutter: getComputedStyle(source.querySelector('.cm-gutters')).backgroundColor,
					number: { font: lineNumber.fontSize, color: lineNumber.color, rowHeight: getComputedStyle(content.querySelector('.cm-line')).lineHeight },
					font: getComputedStyle(content).fontSize, flat, dropdownsFlat, rounded, sizes: buttons.map(button => getComputedStyle(button).fontSize),
					dropdowns: Object.fromEntries(dropdowns.map(select => [select.getAttribute('aria-label'), paint(select)])),
					active: paint(editor.querySelector('button[aria-selected="true"]')), inactive: paint(editor.querySelector('.advanced-mermaid-draft-actions button')),
					export: paint(editor.querySelector('.advanced-mermaid-export summary')),
					exportActions: Object.fromEntries([...editor.querySelectorAll('.advanced-mermaid-export button:not([hidden])')].map(button => [button.textContent, paint(button)])),
					mode: paint(host.querySelector('.advanced-mermaid-editor-mode button[aria-pressed="true"]')),
					inactiveMode: paint(host.querySelector('.advanced-mermaid-editor-mode button[aria-pressed="false"]')),
					statusSize: getComputedStyle(editor.querySelector('.advanced-mermaid-editor-status')).fontSize,
					detailsSize: getComputedStyle(editor.querySelector('.advanced-mermaid-renderer-details summary')).fontSize });
			}
			const invalid = edit('Source font color Light', 'url(https://invalid.example)');
			const invalidRetained = invalid.getAttribute('aria-invalid') === 'true' && JSON.stringify(settings.liveEditor) === snapshot;
			const invalidRadius = edit('Button corner radius', '33').getAttribute('aria-invalid') === 'true' && settings.liveEditor.style.buttonRadiusPx === 14;
			edit('Source font color Light', 'rgba(12, 34, 56, .5)');
			const colorRow = invalid.closest('.setting-item'); colorRow.querySelector('input[type="color"]').value = '#aabbcc'; colorRow.querySelector('input[type="color"]').dispatchEvent(new Event('input'));
			const alpha = settings.liveEditor.style.colors.sourceText.light === '#aabbcc80';
			const roundTrip = JSON.stringify(fixture.normalizeSettings(JSON.parse(JSON.stringify(settings))).liveEditor) === JSON.stringify(settings.liveEditor);
			const exportSummary = () => host.querySelector('.advanced-mermaid-export summary');
			tab.containerEl.querySelector('[aria-label="Reset Export button border color Dark"]').click();
			const inheritedExport = [getComputedStyle(exportSummary()).borderTopColor, settings.liveEditor.style.colors.exportButtonBorder.light];
			for (const button of tab.containerEl.querySelectorAll('button[aria-label^="Reset "]')) button.click();
			const reset = settings.liveEditor.fontSizePx === null && settings.liveEditor.style.lineNumberFontSizePx === null && settings.liveEditor.style.buttonFontSizePx === null &&
				settings.liveEditor.style.buttonRadiusPx === null && Object.keys(settings.liveEditor.style.colors).length === 0 && themeDefaults();
			document.body.classList.remove('theme-dark');
			const diagramUnchanged = getComputedStyle(host.querySelector('svg.pele text')).fill === originalDiagram && getComputedStyle(host.querySelector('svg.pele text')).fontSize === originalDiagramSize;
			const summary = exportSummary(); const box = summary.getBoundingClientRect();
			const range = document.createRange(); range.selectNodeContents(summary); const text = range.getBoundingClientRect();
			const exportCentered = Math.abs(text.top + text.height / 2 - box.top - box.height / 2) < 1 && Math.abs(text.left + text.width / 2 - box.left - box.width / 2) < 1;
			return { moved, paired, noClose, sliders, themes, invalidRetained, invalidRadius, alpha, roundTrip, defaults, defaultCaret, inheritedExport, reset, diagramUnchanged, exportCentered };
		});
		for (const name of ['moved', 'paired', 'noClose', 'sliders', 'invalidRetained', 'invalidRadius', 'alpha', 'roundTrip', 'defaults', 'reset', 'diagramUnchanged', 'exportCentered']) assert.equal(report[name], true, name);
		assert.deepEqual(report.inheritedExport, ['rgb(69, 109, 239)', '#567efa'], 'Resetting the dark Export border uses the inactive border and keeps the light override');
		assert.deepEqual(report.defaultCaret, ['rgb(34, 34, 34)', 'rgb(221, 221, 221)'], 'The source caret follows the Obsidian text color on theme changes');
		const rgb = hex => `rgb(${hex.match(/../g).map(byte => parseInt(byte, 16)).join(', ')})`;
		for (const [i, result] of report.themes.entries()) {
			assert.equal(result.source, rgb(i ? 'abcdef' : '123456')); assert.equal(result.background, rgb(i ? '102030' : 'f0e0d0')); assert.equal(result.gutter, result.background);
			assert.equal(result.caret, result.source, 'The source caret follows the selected source color');
			assert.equal(result.token, result.source, 'The selected source color applies to syntax tokens');
			assert.equal(result.font, '21px'); assert.ok(result.sizes.every(size => size === '17px'), JSON.stringify(result.sizes));
			assert.deepEqual(result.number, { font: '34px', color: rgb(i ? 'ba7654' : '123789'), rowHeight: '34px' });
			assert.ok(result.guide.includes(rgb(i ? 'ace024' : '135724'))); assert.equal(result.arrow, rgb(i ? 'bdf135' : '246813'));
			assert.ok(result.flat && result.dropdownsFlat && result.rounded, `Flat controls with the configured radius in ${result.theme}`);
			const colors = {
				active: i ? ['334455', 'bbccdd', '234bcd'] : ['223344', 'aabbcc', '123abc'],
				inactive: i ? ['556677', 'ddeeff', '456def'] : ['445566', 'ccddee', '345cde'],
				export: i ? ['99aabb', '456def', '678fab'] : ['8899aa', '345cde', '567efa'],
			};
			for (const [key, values] of Object.entries(colors)) assert.deepEqual(result[key], values.map(rgb), key);
			assert.deepEqual(Object.keys(result.dropdowns), ['Diagram type', 'Orientation', 'Insert diagram component', 'Presets / Palette', 'Insert local override', 'Local style theme']);
			for (const [label, paint] of Object.entries(result.dropdowns)) assert.deepEqual(paint, result.inactive, label);
			assert.deepEqual(result.mode, result.active); assert.deepEqual(result.inactiveMode, result.inactive);
			assert.deepEqual(Object.keys(result.exportActions), ['Copy SVG', 'Save SVG', 'Copy PNG', 'Save PNG', 'Save canvas']);
			for (const [label, paint] of Object.entries(result.exportActions)) assert.deepEqual(paint, result.export, label);
			assert.equal(result.statusSize, '12px'); assert.equal(result.detailsSize, '12px');
		}
		await page.locator('.editor-style-fixture .advanced-mermaid-editor-mode button').first().focus();
		await page.keyboard.press('Tab');
		assert.ok(await page.evaluate(() => {
			const active = document.activeElement;
			const css = getComputedStyle(active);
			return active.matches('.advanced-mermaid-editor-mode button:focus-visible') && css.outlineStyle === 'solid' && css.outlineWidth === '2px';
		}), 'Keyboard focus stays visible on flat buttons');
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
		await checkSyntaxAppearance(page);
		console.log('Editor style checks passed: settings page, paired colors, size controls, centered Export, hidden Close controls, live updates, validation, alpha, resets, persistence round trip and diagram isolation.');
	} finally {
		await page.evaluate(() => { document.body.classList.remove('theme-dark'); editorStyles.tab.hide(); editorStyles.tab.containerEl.remove(); editorStyles.view.destroy(); editorStyles.inline.destroy(); editorStyles.host.remove(); delete window.editorStyles; });
		await hostStyle.evaluate(element => element.remove());
	}
}

async function checkSyntaxAppearance(page) {
	const report = await page.evaluate(() => {
		const { tab, settings, host, inline, view } = editorStyles;
		const source = fixture.sourceRoot(host);
		const originalNote = view.state.doc.toString();
		const style = token => {
			const css = getComputedStyle(source.querySelector('.am-source-' + token));
			return [css.color, css.fontWeight];
		};
		const edit = (label, value, event = 'input') => {
			const control = tab.containerEl.querySelector(`[aria-label="${label}"]`);
			control.value = value;
			control.dispatchEvent(new Event(event));
			return control;
		};
		edit('Source font color Light', '#334455');
		const pageRow = [...tab.containerEl.querySelectorAll('.setting-item')].find(row => row.textContent.includes('Syntax highlighting'));
		pageRow.querySelector('button').click();
		const swatches = ['Light', 'Dark'].map(mode => tab.containerEl.querySelector(`[aria-label="Diagram declaration color ${mode} picker"]`).value);
		edit('Diagram declaration color Light', '#ab1234');
		edit('Diagram declaration color Dark', '#abcdef');
		edit('Diagram declaration font weight', '400', 'change');
		edit('Keyword font weight', '800', 'change');
		const light = [style('declaration'), style('keyword')];
		document.body.classList.add('theme-dark');
		const dark = [style('declaration'), style('keyword')];
		const invalid = edit('Diagram declaration color Dark', 'var(--invalid)').getAttribute('aria-invalid');
		const saved = fixture.normalizeSettings(JSON.parse(JSON.stringify(settings))).liveEditor.style.syntax;
		tab.containerEl.querySelector('[aria-label="Reset Diagram declaration color Dark"]').click();
		edit('Diagram declaration font weight', 'default', 'change');
		const resetDark = style('declaration');
		document.body.classList.remove('theme-dark');
		const resetLight = style('declaration');
		const noteUnchanged = view.state.doc.toString() === originalNote;
		edit('CSS property color Light', '#183759');
		edit('CSS property font weight', '600', 'change');
		host.querySelector('[aria-label="Source format"] button:nth-child(2)').click();
		const nested = fixture.EditorView.findFromDOM(source.querySelector('.cm-editor'));
		nested.dispatch({ changes: { from: 0, insert: '.pele { --pele-fg: #abc; }' } });
		const css = style('property');
		inline.refresh();
		return { swatches, light, dark, invalid, saved, resetDark, resetLight, noteUnchanged, css };
	});
	assert.deepEqual(report.swatches, ['#334455', '#79c0ff']);
	assert.deepEqual(report.light, [['rgb(171, 18, 52)', '400'], ['rgb(51, 68, 85)', '800']]);
	assert.deepEqual(report.dark, [['rgb(171, 205, 239)', '400'], ['rgb(210, 168, 255)', '800']]);
	assert.equal(report.invalid, 'true');
	assert.deepEqual(report.saved, { declaration: { colors: { light: '#ab1234', dark: '#abcdef' }, weight: 400 }, keyword: { weight: 800 } });
	assert.deepEqual(report.resetDark, ['rgb(121, 192, 255)', '700']);
	assert.deepEqual(report.resetLight, ['rgb(171, 18, 52)', '700']);
	assert.deepEqual(report.css, ['rgb(24, 55, 89)', '600']);
	assert.ok(report.noteUnchanged);
}
