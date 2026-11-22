import assert from 'node:assert/strict';

export async function runInlineSettingsChecks(page) {
	const result = await page.evaluate(async () => {
		const settings = fixture.normalizeSettings(null); settings.alignment = 'right';
		settings.style.global.colors.text = { light: '#123', dark: '#abc' };
		settings.style.diagrams.state = { useGlobal: false, overrides: { colors: { text: { dark: '#def' } }, elements: {} } };
		const plugin = { manifest: { name: 'Advanced Mermaid', description: 'Manage Mermaid diagrams.', version: '1.2.3' } };
		const tab = new fixture.AdvancedMermaidSettingTab(fixture.app, plugin, settings, () => {});
		tab.containerEl = document.body.createDiv(); tab.update();
		const row = name => [...tab.containerEl.querySelectorAll('.setting-item')].find(item => [...item.querySelectorAll('label')].some(label => label.textContent === name));
		const open = name => row(name).querySelector('button').click();
		const back = () => tab.containerEl.querySelector('button[aria-label="Back"]').click();
		const edit = (label, value) => { const input = tab.containerEl.querySelector(`input[aria-label="${label}"]`); input.value = value; input.dispatchEvent(new Event('input')); };
		const showExample = async () => {
			const disclosure = tab.containerEl.querySelector('.advanced-mermaid-settings-example');
			disclosure.querySelector('summary').click();
			await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			return disclosure;
		};
		const widthControl = () => tab.containerEl.querySelector('[aria-label="Diagram max width"]');
		const width = widthControl();
		const widthOptions = [...width.options].map(option => option.textContent);
		const widthDefaults = width.value === 'default' && !row('Fill available space').querySelector('input').checked;
		// Native settings can reuse definitions indexed before MTS was installed.
		const definitions = tab.settingItems;
		const getDefinitions = tab.getSettingDefinitions;
		tab.getSettingDefinitions = () => definitions;
		fixture.app.plugins.manifests['obsidian-minimal-settings'] = { id: 'obsidian-minimal-settings' };
		tab.update();
		const disabledWidthOptions = [...widthControl().options].map(option => option.textContent);
		fixture.app.plugins.plugins['obsidian-minimal-settings'] = { settings: { lineWidth: 40, lineWidthWide: 50, maxWidth: 88 } };
		tab.update();
		const mtsWidth = widthControl();
		const enabledWidthOptions = [...mtsWidth.options].map(option => option.textContent);
		mtsWidth.value = 'wide'; mtsWidth.dispatchEvent(new Event('change'));
		const widthSaved = fixture.normalizeSettings(settings).maxWidth === 'wide';
		delete fixture.app.plugins.plugins['obsidian-minimal-settings']; tab.update();
		const legacySelection = widthControl().value === 'default' && settings.maxWidth === 'wide';
		delete fixture.app.plugins.manifests['obsidian-minimal-settings'];
		const widthControlsRemoved = !row('Normal line width') && !row('Wide line width') && !row('Maximum line width');
		tab.getSettingDefinitions = getDefinitions;
		const comparisonRemoved = !row('Enable Mermaid comparison');
		const rootGroups = [...tab.containerEl.querySelectorAll('h3')].map(heading => heading.textContent);
		const generalPages = tab.settingItems[0].items.map(item => item.name);
		const displayLabels = ['Diagram alignment', 'Diagram max width', 'Diagram max height'].every(name =>
			row(name)?.querySelector(`[aria-label="${name}"]`));
		const editorEssentials = !!row('Editor layout') && !!row('Wrap source') && !row('Preview delay')
			&& row('Enable full-screen editor')?.querySelector('input[type="checkbox"]')?.checked === true;
		open('About');
		const aboutVersion = row('Advanced Mermaid').textContent.includes('Version 1.2.3');
		back();
		const displayExample = await showExample();
		const displayPreview = !!displayExample.querySelector('svg.pele');
		open('Preview timing');
		edit('Preview delay', '350');
		const previewTiming = settings.liveEditor.debounceMs === 350;
		const displayCleanup = !displayExample.querySelector('svg.pele');
		back();
		open('Editor appearance');
		edit('Source font size', '21'); const fontSize = settings.liveEditor.fontSizePx;
		tab.containerEl.querySelector('[aria-label="Reset Source font size"]').click(); const fontReset = settings.liveEditor.fontSizePx === null;
		back();
		open('All diagrams');
		const colorRows = tab.containerEl.querySelectorAll('.advanced-mermaid-color-row').length;
		const paired = row('Primary text').querySelectorAll('input[type="color"]').length === 2;
		const sharedExample = await showExample();
		edit('Primary text Light', 'rgba(255, 0, 0, .5)'); const rgba = settings.style.global.colors.text.light;
		const liveStylePreview = sharedExample.querySelector('.advanced-mermaid')?.style.getPropertyValue('--pele-fg') === '#ff000080';
		tab.containerEl.querySelector('[aria-label="Reset Primary text Light"]').click(); const independent = !settings.style.global.colors.text.light && settings.style.global.colors.text.dark === '#abc';
		open('Reset shared styles');
		await Promise.resolve();
		const undoButton = row('Reset shared styles').querySelector('button:last-child');
		const inlineUndo = undoButton.textContent === 'Undo reset' && undoButton === document.activeElement
			&& row('Reset shared styles').querySelector('[role="status"]')?.textContent.includes('reset');
		const globalReset = !Object.keys(settings.style.global.colors).length && settings.style.diagrams.state.overrides.colors.text.dark === '#def';
		open('Reset shared styles');
		settings.alignment = 'left'; undoButton.click();
		const undoScope = settings.alignment === 'left' && settings.style.global.colors.text.dark === '#abc';
		back(); open('By diagram type'); open('Flowchart');
		const inheritance = row('Use styles from All diagrams').querySelector('input');
		const inherited = inheritance.checked && row('Primary text').closest('[hidden]') !== null;
		inheritance.focus(); inheritance.click();
		const keptFocus = document.activeElement === inheritance && row('Primary text').closest('[hidden]') === null;
		edit('Primary text Light', '#456');
		const sparse = settings.style.diagrams.flowchart.overrides.colors.text.light === '#445566' && settings.style.diagrams.flowchart.overrides.colors.text.dark === undefined;
		inheritance.click(); const retained = settings.style.diagrams.flowchart.overrides.colors.text.light === '#445566';
		open('Reset Flowchart styles'); const typeReset = settings.style.diagrams.flowchart === undefined && settings.style.diagrams.state.overrides.colors.text.dark === '#def';
		back(); back(); open('Preset classes');
		const generatedCodeCollapsed = !row('Preset text').querySelector('details').open;
		open('Preset text');
		const modal = document.querySelector('.modal'); const source = modal.querySelector('textarea'); source.value = 'preset:\n  - alias: Custom\n    fill: #12345680\n    width: 2.5px'; source.dispatchEvent(new Event('input'));
		[...modal.querySelectorAll('button')].find(button => button.textContent === 'Save').click();
		const presetSaved = settings.presets.length === 1 && settings.presets[0].alias === 'Custom' && settings.presets[0].width === 2.5;
		open('Preset text'); const invalidModal = document.querySelector('.modal'); const invalid = invalidModal.querySelector('textarea'); invalid.value = 'preset:\n  - alias: Bad\n    fill: url(remote)'; invalid.dispatchEvent(new Event('input'));
		[...invalidModal.querySelectorAll('button')].find(button => button.textContent === 'Save').click(); const invalidRetained = settings.presets[0].alias === 'Custom' && !!document.querySelector('.modal');
		[...invalidModal.querySelectorAll('button')].find(button => button.textContent === 'Cancel').click();
		back(); open('Help');
		const example = await showExample();
		const preview = example.querySelectorAll('svg.pele').length;
		back(); const destroyed = !example.querySelector('svg.pele'); tab.hide(); tab.containerEl.remove();
		return { widthOptions, disabledWidthOptions, enabledWidthOptions, widthSaved, legacySelection, widthControlsRemoved, widthDefaults, comparisonRemoved, rootGroups, generalPages, displayLabels, aboutVersion, editorEssentials, previewTiming, displayPreview, displayCleanup, liveStylePreview, colorRows, paired, rgba, independent, globalReset, inlineUndo, undoScope, inherited, keptFocus, sparse, retained, typeReset, preview, destroyed, fontSize, fontReset, generatedCodeCollapsed, presetSaved, invalidRetained };
	});
	assert.equal(result.colorRows, 11); assert.equal(result.rgba, '#ff000080'); assert.equal(result.fontSize, 21); assert.equal(result.preview, 1);
	assert.deepEqual(result.widthOptions, ['Default', 'Full']);
	assert.deepEqual(result.disabledWidthOptions, ['Default', 'Full']);
	assert.deepEqual(result.enabledWidthOptions, ['Default', 'Normal', 'Wide', 'Maximum', 'Full Pane']);
	assert.deepEqual(result.rootGroups, ['General', 'Live Editor', 'Diagram Display', 'Diagram Styles']);
	assert.deepEqual(result.generalPages, ['About', 'Zoom controls', 'Preset classes', 'Help']);
	for (const [key, value] of Object.entries(result)) {
		if (!Array.isArray(value) && typeof value !== 'number' && key !== 'rgba') assert.equal(value, true, key);
	}
	console.log('Inline settings passed: native definitions/pages, paired colors, resets/undo, sparse type profiles, numeric inheritance, atomic presets and example cleanup.');
}
