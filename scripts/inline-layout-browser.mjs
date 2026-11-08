import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readHostArchive } from './host-assets.mjs';

/** Check nested CodeMirror geometry under the host's Markdown CSS cascade. */
export async function runInlineLayoutChecks(page, theme = 'default') {
	const originalViewport = page.viewportSize();
	let hostCss = `.markdown-source-view.mod-cm6 .cm-scroller { font-family: var(--font-text); }
	.markdown-source-view.mod-cm6 .cm-content { flex-basis: unset !important; width: 0; padding: 0; }
	.markdown-source-view.mod-cm6 .cm-line { padding: 0; }
	.markdown-source-view.mod-cm6 .cm-gutters { margin-inline-end: 24px; background-color: transparent; }
	.markdown-source-view.mod-cm6.is-readable-line-width .cm-content,
	.markdown-source-view.mod-cm6.is-readable-line-width .cm-line { max-width: 700px; }`;
	try {
		const archive = await readHostArchive();
		if (archive) {
			const header = JSON.parse(archive.subarray(16, 16 + archive.readUInt32LE(12)).toString());
			const asset = header.files['app.css']; const start = 8 + archive.readUInt32LE(4) + Number(asset.offset);
			const css = archive.subarray(start, start + asset.size).toString();
			// Use just the host rules relevant to nested editor geometry, without fonts/assets.
			hostCss = css.split('}').filter(rule => /^\s*\.markdown-source-view\.mod-cm6[^{}]*\.(?:cm-content|cm-line|cm-scroller|cm-gutters)\s*\{[^{}]*$/.test(rule)).map(rule => rule + '}').join('\n');
			assert.match(hostCss, /flex-basis:\s*unset\s*!important/);
			console.log('Inline layout: using installed Obsidian Markdown stylesheet rules.');
		} else console.log('Inline layout: using representative Obsidian Markdown stylesheet rules.');
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
		console.log('Inline layout: using representative Obsidian Markdown stylesheet rules.');
	}
	if (theme === 'Minimal') {
		// Minimal positions the note gutter outside normal flow and assigns an
		// editor font through .view-content. Both selectors also reach widgets.
		hostCss += `body :not(.canvas-node) .markdown-source-view.mod-cm6 .cm-gutters { position: absolute !important; z-index: 0; margin-inline-end: 0; }
		.view-content > .markdown-source-view.mod-cm6 .cm-scroller { font-family: var(--font-editor); }`;
		if (process.env.ADVANCED_MERMAID_LAYOUT_THEME_CSS) {
			hostCss += await readFile(process.env.ADVANCED_MERMAID_LAYOUT_THEME_CSS, 'utf8');
			console.log('Inline layout: also using the complete supplied theme stylesheet.');
		}
	}
	const hostStyle = await page.addStyleTag({ content: hostCss });
	await page.evaluate(() => {
		const host = document.body.createDiv({ cls: 'view-content' });
		const markdown = host.createDiv({ cls: 'markdown-source-view mod-cm6 is-readable-line-width' });
		host.style.cssText = '--font-monospace: "Courier New"; --font-text: Arial; --font-editor: Arial; --file-folding-offset: 24px; --file-line-width:700px; --background-primary:white; --radius-m:8px;';
		const settings = fixture.normalizeSettings(null); settings.liveEditor.layout = 'side-by-side';
		const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const source = 'mindmap\n root((Root))\n' + Array.from({ length: 210 }, (_, i) => `  Branch ${i + 1}`).join('\n');
		const text = 'Before\n\n```pele\n' + source + '\n```\n\nAfter';
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const view = new fixture.EditorView({ parent: markdown, state: fixture.EditorState.create({ doc: text, extensions: [language, fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension] }) });
		view.dispatch({ selection: { anchor: text.indexOf('mindmap') } }); view.focus(); inline.toggle();
		window.layoutFixture = { host, view, inline, settings };
	});
	try {
		for (const width of [1440, 1024, 768, 320]) {
			await page.setViewportSize({ width: width + 32, height: 900 });
			await page.evaluate(width => { layoutFixture.host.style.width = `${width}px`; }, width);
			await page.waitForFunction(width => document.querySelector('.advanced-mermaid-editor').dataset.layout === (width < 520 ? 'stacked' : 'side-by-side'), width);
			await page.waitForTimeout(100);
			const metrics = await page.evaluate(() => {
				const editor = layoutFixture.host.querySelector('.advanced-mermaid-editor');
				const source = editor.querySelector('.advanced-mermaid-editor-source');
				const scroller = source.querySelector('.cm-scroller');
				const content = source.querySelector('.cm-content');
				const line = content.querySelector('.cm-line');
				const range = document.createRange(); range.selectNodeContents(line);
				const box = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
				const footer = editor.querySelector('.advanced-mermaid-editor-footer');
				const actions = [...footer.querySelector('.advanced-mermaid-draft-actions').children];
				return {
					font: getComputedStyle(scroller).fontFamily, contentFont: getComputedStyle(content).fontFamily,
					gap: range.getBoundingClientRect().left - source.querySelector('.cm-gutters').getBoundingClientRect().right,
					radius: parseFloat(getComputedStyle(source.querySelector('.cm-editor')).borderRadius),
					sourceTabs: box(editor.querySelector('[aria-label="Source format"]')), previewTabs: box(editor.querySelector('[aria-label="Preview format"]')),
					footer: box(footer), actions: actions.map(box), labels: actions.map(button => button.textContent),
					export: box(footer.querySelector('.advanced-mermaid-export summary')),
					overflow: editor.scrollWidth > editor.clientWidth,
				};
			});
			assert.match(metrics.font, /Courier New/, `${theme}: ${JSON.stringify(metrics)}`); assert.equal(metrics.contentFont, metrics.font);
			assert.ok(metrics.gap >= 7, `${theme}: Source touches the gutter at ${width}px: ${metrics.gap}`);
			assert.ok(metrics.radius > 0); assert.equal(metrics.overflow, false);
			assert.deepEqual(metrics.labels, ['Copy draft', 'Discard changes', 'Use note version', 'Render now']);
			assert.ok(Math.abs(metrics.export.right - metrics.footer.right) <= 1);
			if (width >= 768) {
				assert.equal(metrics.sourceTabs.top, metrics.previewTabs.top);
				assert.ok(Math.abs(metrics.previewTabs.right - metrics.footer.right) <= 1);
				assert.ok(metrics.actions.every(action => action.top === metrics.actions[0].top));
				assert.equal(metrics.actions[0].left, metrics.footer.left);
			}
			await page.evaluate(() => {
				const content = layoutFixture.host.querySelector('.advanced-mermaid-editor-source .cm-content');
				const nested = fixture.EditorView.findFromDOM(content);
				nested.dispatch({ selection: { anchor: nested.state.doc.length }, scrollIntoView: true });
			});
			await page.waitForTimeout(80);
			const lastLine = await page.evaluate(() => {
				const source = layoutFixture.host.querySelector('.advanced-mermaid-editor-source');
				const line = [...source.querySelectorAll('.cm-line')].at(-1);
				const range = document.createRange(); range.selectNodeContents(line);
				const number = [...source.querySelectorAll('.cm-lineNumbers .cm-gutterElement')].find(element => element.textContent === '212');
				return { gap: range.getBoundingClientRect().left - source.querySelector('.cm-gutters').getBoundingClientRect().right,
					alignment: number ? Math.abs(number.getBoundingClientRect().top - line.getBoundingClientRect().top) : Infinity };
			});
			assert.ok(lastLine.gap >= 7 && lastLine.alignment < 1, `Three-digit gutter misaligned at ${width}px: ${JSON.stringify(lastLine)}`);
		}
		const originalSizes = await page.evaluate(() => {
			const source = layoutFixture.host.querySelector('.advanced-mermaid-editor-source');
			const sizes = { source: getComputedStyle(source.querySelector('.cm-content')).fontSize,
				parent: getComputedStyle(layoutFixture.view.scrollDOM).fontSize,
				preview: getComputedStyle(layoutFixture.host.querySelector('svg.pele text')).fontSize };
			const tab = new fixture.AdvancedMermaidSettingTab(fixture.app, {}, layoutFixture.settings, () => layoutFixture.inline.refresh());
			tab.containerEl = document.body.createDiv(); tab.display(); layoutFixture.fontTab = tab;
			[...tab.containerEl.querySelectorAll('.setting-item')].find(row => row.textContent.includes('Editor style settings')).querySelector('button').click();
			return sizes;
		});
		const fontSize = page.getByRole('spinbutton', { name: 'Source font size', exact: true });
		assert.equal(await fontSize.inputValue(), '');
		await fontSize.fill('22');
		await page.waitForFunction(() => getComputedStyle(document.querySelector('.advanced-mermaid-editor-source .cm-content')).fontSize === '22px');
		await page.locator('.advanced-mermaid-editor-source').scrollIntoViewIfNeeded();
		await page.evaluate(() => {
			const nested = fixture.EditorView.findFromDOM(layoutFixture.host.querySelector('.advanced-mermaid-editor-source .cm-content'));
			nested.dispatch({ selection: { anchor: nested.state.doc.length }, scrollIntoView: true });
		});
		await page.waitForTimeout(80);
		const resized = await page.evaluate(() => {
			const source = layoutFixture.host.querySelector('.advanced-mermaid-editor-source');
			const line = [...source.querySelectorAll('.cm-line')].at(-1);
			const number = [...source.querySelectorAll('.cm-lineNumbers .cm-gutterElement')].find(element => element.textContent === '212');
			return { saved: fixture.normalizeSettings(JSON.parse(JSON.stringify(layoutFixture.settings))).liveEditor.fontSizePx,
				line: getComputedStyle(line).fontSize, alignment: Math.abs(number.getBoundingClientRect().top - line.getBoundingClientRect().top),
				gutterFont: getComputedStyle(number).fontSize, numberTop: number.getBoundingClientRect().top, lineTop: line.getBoundingClientRect().top,
				parent: getComputedStyle(layoutFixture.view.scrollDOM).fontSize,
				preview: getComputedStyle(layoutFixture.host.querySelector('svg.pele text')).fontSize };
		});
		assert.equal(resized.saved, 22); assert.equal(resized.line, '22px'); assert.ok(resized.alignment < 1, JSON.stringify(resized));
		assert.equal(resized.parent, originalSizes.parent); assert.equal(resized.preview, originalSizes.preview);
		for (const invalid of ['7', '41', '12.5']) {
			await fontSize.fill(invalid);
			assert.equal(await fontSize.getAttribute('aria-invalid'), 'true');
			assert.equal(await page.evaluate(() => layoutFixture.settings.liveEditor.fontSizePx), 22);
		}
		await page.locator('.advanced-mermaid-editor-mode').first().getByRole('button', { name: 'Rendered view', exact: true }).click();
		await page.evaluate(() => { if (!layoutFixture.inline.openAt('InlineEditor.md', 2)) throw new Error('Could not reopen the inline editor'); });
		await page.waitForFunction(() => getComputedStyle(document.querySelector('.advanced-mermaid-editor-source .cm-content')).fontSize === '22px');
		await page.getByRole('tab', { name: 'CSS', exact: true }).click();
		assert.equal(await page.locator('.advanced-mermaid-editor-source .cm-content').evaluate(element => getComputedStyle(element).fontSize), '22px');
		await fontSize.fill('');
		await page.waitForFunction(size => getComputedStyle(document.querySelector('.advanced-mermaid-editor-source .cm-content')).fontSize === size, originalSizes.source);
		assert.equal(await fontSize.getAttribute('aria-invalid'), 'false');
		assert.equal(await page.evaluate(() => layoutFixture.settings.liveEditor.fontSizePx), null);
		await page.getByRole('tab', { name: 'Mermaid', exact: true }).first().click();
		await page.evaluate(() => { layoutFixture.fontTab.hide(); layoutFixture.fontTab.containerEl.remove(); delete layoutFixture.fontTab; });
		await page.evaluate(() => {
			layoutFixture.settings.liveEditor.lineNumbers = false; layoutFixture.settings.liveEditor.wrapSource = false; layoutFixture.inline.refresh();
			const nested = fixture.EditorView.findFromDOM(layoutFixture.host.querySelector('.advanced-mermaid-editor-source .cm-content'));
			const insert = '\n  ' + 'Long branch '.repeat(80);
			nested.dispatch({ changes: { from: nested.state.doc.length, insert }, selection: { anchor: nested.state.doc.length + insert.length }, scrollIntoView: true });
		});
		await page.locator('.advanced-mermaid-editor-source').scrollIntoViewIfNeeded();
		await page.waitForTimeout(100);
		const unwrapped = await page.evaluate(() => {
			const editor = layoutFixture.host.querySelector('.advanced-mermaid-editor');
			const scroller = editor.querySelector('.advanced-mermaid-editor-source .cm-scroller');
			return { gutters: editor.querySelectorAll('.cm-gutters').length, scrolls: scroller.scrollWidth > scroller.clientWidth,
				contained: editor.scrollWidth <= editor.clientWidth, parentFont: getComputedStyle(layoutFixture.view.scrollDOM).fontFamily };
		});
		assert.equal(unwrapped.gutters, 0); assert.ok(unwrapped.scrolls && unwrapped.contained, JSON.stringify(unwrapped)); assert.equal(unwrapped.parentFont, 'Arial');
		await page.getByRole('tab', { name: 'CSS', exact: true }).click();
		assert.match(await page.locator('.advanced-mermaid-editor-source .cm-content').evaluate(element => getComputedStyle(element).fontFamily), /Courier New/);
		console.log(`Inline layout passed (${theme}): host CSS, monospace Mermaid/CSS, gutter spacing, rounded source, header/footer positions, responsive widths and live source font-size settings/validation/reset.`);
	} finally {
		await page.evaluate(() => { layoutFixture.fontTab?.hide(); layoutFixture.fontTab?.containerEl.remove(); layoutFixture.view.destroy(); layoutFixture.inline.destroy(); layoutFixture.host.remove(); delete window.layoutFixture; });
		await hostStyle.evaluate(element => element.remove());
		if (originalViewport) await page.setViewportSize(originalViewport);
	}
}
