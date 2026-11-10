import assert from 'node:assert/strict';

/** Live Preview's native Mermaid widget bypasses Markdown code block processors. */
export async function runMermaidPreviewChecks(page) {
	const theme = await page.addStyleTag({ content: `
		.mermaid-preview-fixture > .cm-editor > .cm-scroller > .cm-content > div {
			width: 400px; max-width: 90%; margin-inline: auto !important;
		}
		.mermaid-preview-fixture button, .reading-export-fixture button {
			box-shadow: 0 1px 2px #666;
			background-image: linear-gradient(#eee, #ccc);
		}
	` });
	await page.evaluate(async () => {
		const plugin = new fixture.AdvancedMermaidPlugin(fixture.app, { id: 'mermaid-preview-fixture' });
		plugin.data = { schemaVersion: 4, alignment: 'right', style: { global: { colors: { text: { light: '#123456', dark: '#654321' } } } } };
		await plugin.onload();
		const source = 'Before\n\n```mermaid\nflowchart LR\n A[Global] --> B[Settings]\n```\n\n~~~mermaid\n%% advanced-mermaid: align=left\n%% advanced-mermaid-style:v1\n%% .pele { --pele-fg: #abcdef; }\n%% advanced-mermaid-style:end\nflowchart LR\n C[Local] --> D[Overrides]\n~~~\n\nAfter';
		class NativeMermaid extends fixture.WidgetType {
			toDOM() { const element = document.createElement('div'); element.className = 'fixture-native-mermaid'; element.textContent = 'Native Mermaid'; return element; }
		}
		const nativeDecorations = state => fixture.Decoration.set(fixture.diagramFences(state)
			.filter(range => range.language === 'mermaid' && state.field(fixture.editorLivePreviewField, false) && !state.selection.ranges.some(selection => selection.from <= range.to && selection.to >= range.from))
			.map(range => fixture.Decoration.replace({ block: true, widget: new NativeMermaid() }).range(range.from, range.to)), true);
		const native = fixture.StateField.define({ create: nativeDecorations, update: (_old, transaction) => nativeDecorations(transaction.state), provide: field => fixture.EditorView.decorations.from(field) });
		const host = document.body.createDiv({ cls: 'mermaid-preview-fixture' }); host.style.width = '900px';
		const extension = new fixture.Compartment(); const preview = new fixture.Compartment();
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({ doc: source, extensions: [language, fixture.history(), fixture.editorInfoField, preview.of(fixture.editorLivePreviewField), native, extension.of(plugin.extensions)] }) });
		view.scrollDOM.style.paddingInline = '24px';
		window.mermaidPreviewFixture = { plugin, host, view, extension, preview, source };
	});
	try {
		const previews = page.locator('.advanced-mermaid-rendered-preview');
		assert.equal(await previews.count(), 2, 'Rendered Live Preview must use Advanced Mermaid without invoking its Markdown processor');
		assert.equal(await page.locator('.advanced-mermaid-rendered-preview[data-rendered-live-preview]').count(), 2);
		assert.equal(await page.locator('.fixture-native-mermaid').count(), 0, 'The built-in widget must not render over Advanced Mermaid');
		const initial = await page.evaluate(() => [...mermaidPreviewFixture.host.querySelectorAll('.advanced-mermaid-rendered-preview')].map(host => ({ align: host.dataset.align, text: getComputedStyle(host.querySelector('.pele-label')).fill })));
		assert.deepEqual(initial, [{ align: 'right', text: 'rgb(18, 52, 86)' }, { align: 'left', text: 'rgb(171, 205, 239)' }]);
		const assertZoomCorners = async corners => {
			const insets = await previews.evaluateAll(blocks => blocks.map(block => {
				const viewport = block.querySelector('.advanced-mermaid-viewport').getBoundingClientRect();
				const zoom = block.querySelector('.pele-zoom').getBoundingClientRect();
				return { left: zoom.left - viewport.left, right: viewport.right - zoom.right, bottom: viewport.bottom - zoom.bottom };
			}));
			assert.equal(insets.length, corners.length);
			corners.forEach((corner, index) => {
				const inset = insets[index];
				assert.ok(Math.abs(inset[corner] - 8) < 1 && Math.abs(inset.bottom - 8) < 1, JSON.stringify({ corner, inset }));
			});
		};
		await assertZoomCorners(['left', 'right']);
		for (const alignment of ['left', 'center']) {
			await page.evaluate(alignment => {
				const { plugin } = mermaidPreviewFixture;
				plugin.settings.alignment = alignment;
				plugin.inline.refresh();
			}, alignment);
			await assertZoomCorners([alignment === 'left' ? 'right' : 'left', 'right']);
		}
		const width = await page.evaluate(async () => {
			const { plugin, view, host } = mermaidPreviewFixture;
			const text = host.querySelector('.cm-line');
			const before = text.getBoundingClientRect();
			plugin.settings.maxWidth = 'maximum';
			plugin.settings.diagramWidths.maximumPercent = 80;
			plugin.inline.refresh();
			await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			const after = text.getBoundingClientRect();
			const pane = view.scrollDOM.getBoundingClientRect();
			const block = host.querySelector('.advanced-mermaid-rendered-preview .advanced-mermaid-layout').getBoundingClientRect();
			return { actual: block.width, expected: (view.scrollDOM.clientWidth - 48) * .8,
				centered: Math.abs(block.left + block.right - pane.left - pane.right) < 1,
				textStable: before.left === after.left && before.width === after.width };
		});
		assert.ok(Math.abs(width.actual - width.expected) < .05 && width.centered && width.textStable, JSON.stringify(width));
		const modes = page.locator('.advanced-mermaid-editor-mode').first();
		await modes.getByRole('button', { name: 'Live editor', exact: true }).click();
		assert.equal(await previews.count(), 1); assert.equal(await page.locator('.advanced-mermaid-editor').count(), 1);
		await page.waitForFunction(() => {
			const column = mermaidPreviewFixture.host.querySelector('.advanced-mermaid-editor-preview');
			return Math.abs(column.querySelector('.advanced-mermaid-layout').getBoundingClientRect().width - column.clientWidth * .8) < .05;
		});
		await modes.getByRole('button', { name: 'Rendered view', exact: true }).click();
		assert.equal(await previews.count(), 2); assert.equal(await page.locator('.advanced-mermaid-editor').count(), 0);
		await modes.getByRole('button', { name: 'Static editor', exact: true }).click();
		assert.equal(await previews.count(), 1, 'Selecting source must reveal the original fence');
		await modes.getByRole('button', { name: 'Rendered view', exact: true }).click();
		const updated = await page.evaluate(async () => {
			const { plugin, view, host } = mermaidPreviewFixture;
			plugin.settings.style.global.colors.text.light = '#2468ac';
			plugin.settings.alignment = 'left';
			const editorStyle = plugin.settings.liveEditor.style;
			editorStyle.colors.exportButtonText = { light: '#112233', dark: '#223344' };
			editorStyle.colors.exportButtonBackground = { light: '#d0dfe0' };
			editorStyle.colors.exportButtonBorder = { light: '#123abc' };
			editorStyle.colors.inactiveButtonBackground = { dark: '#aabbcc' };
			editorStyle.colors.inactiveButtonBorder = { dark: '#234bcd' };
			editorStyle.buttonRadiusPx = 14;
			editorStyle.buttonFontSizePx = 17;
			plugin.inline.refresh();
			const pane = document.body.createDiv({ cls: 'markdown-preview-view reading-export-fixture' });
			const child = new fixture.DiagramController(pane.createDiv(), 'flowchart LR\n A[Read] --> B[Export]', () => plugin.settings, fixture.app, 'Export.md');
			mermaidPreviewFixture.reading = { pane, child };
			child.load();
			const source = view.state.doc.toString();
			const alignment = source.indexOf('align=left');
			const color = source.indexOf('#abcdef');
			view.dispatch({ changes: [
				{ from: alignment, to: alignment + 'align=left'.length, insert: 'align=center' },
				{ from: color, to: color + 7, insert: '#102030' },
			] });
			await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			return [...host.querySelectorAll('.advanced-mermaid-rendered-preview')].map(host => getComputedStyle(host.querySelector('.pele-label')).fill);
		});
		assert.deepEqual(updated, ['rgb(36, 104, 172)', 'rgb(16, 32, 48)']);
		await assertZoomCorners(['right', 'left']);
		const exportMenus = page.locator('.advanced-mermaid-rendered-preview .advanced-mermaid-export, .reading-export-fixture .advanced-mermaid-export');
		const assertExportStyles = async (text, background, border) => {
			const menus = await exportMenus.evaluateAll(menus => menus.map(menu => [...menu.querySelectorAll('summary, button')].map(control => {
				const css = getComputedStyle(control);
				return { label: control.textContent, text: css.color, background: css.backgroundColor, border: css.borderTopColor,
					radius: css.borderTopLeftRadius, size: css.fontSize, flat: css.boxShadow === 'none' && css.backgroundImage === 'none' };
			})));
			assert.equal(menus.length, 3);
			for (const menu of menus) {
				assert.deepEqual(menu.map(control => control.label), ['Export', 'Copy SVG', 'Save SVG', 'Copy PNG', 'Save PNG']);
				for (const { label, ...style } of menu) {
					assert.deepEqual(style, { text, background, border, radius: '14px', size: '17px', flat: true }, label);
				}
			}
		};
		await assertExportStyles('rgb(17, 34, 51)', 'rgb(208, 223, 224)', 'rgb(18, 58, 188)');
		await page.evaluate(() => document.body.classList.add('theme-dark'));
		await page.waitForFunction(() => getComputedStyle(document.querySelector('.advanced-mermaid-rendered-preview .pele-label')).fill === 'rgb(101, 67, 33)');
		await assertExportStyles('rgb(34, 51, 68)', 'rgb(170, 187, 204)', 'rgb(35, 75, 205)');
		await page.evaluate(() => { const { plugin } = mermaidPreviewFixture; plugin.settings.liveEditor.enabled = false; plugin.inline.refresh(); });
		assert.equal(await previews.count(), 2, 'Rendering must work when the optional inline editor is disabled');
		assert.equal(await page.locator('.advanced-mermaid-editor-mode').count(), 0);
		await page.evaluate(() => { const { view, preview } = mermaidPreviewFixture; view.dispatch({ effects: preview.reconfigure([]) }); });
		assert.equal(await previews.count(), 0, 'Source mode must remain plain Markdown');
		await page.evaluate(() => { const { view, preview } = mermaidPreviewFixture; view.dispatch({ effects: preview.reconfigure(fixture.editorLivePreviewField) }); });
		assert.equal(await previews.count(), 2);
		await page.evaluate(() => { const { view, extension, plugin } = mermaidPreviewFixture; view.dispatch({ effects: extension.reconfigure([]) }); plugin.unload(); });
		assert.equal(await previews.count(), 0); assert.equal(await page.locator('.fixture-native-mermaid').count(), 2, 'Unloading must restore native rendering');
		console.log('Mermaid Live Preview passed: native-widget precedence, global settings, local overrides, settings/source/theme updates, editor transitions, disabled inline editor, Source mode and unload.');
	} finally {
		await page.evaluate(() => {
			const { view, host, plugin, reading } = mermaidPreviewFixture;
			reading?.child.destroy(); reading?.pane.remove();
			view.destroy(); plugin.unload(); host.remove(); document.body.classList.remove('theme-dark'); delete window.mermaidPreviewFixture;
		});
		await theme.evaluate(style => style.remove());
	}
}
