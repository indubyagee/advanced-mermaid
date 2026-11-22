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
				const source = fixture.sourceRoot(editor);
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
					gutterPosition: getComputedStyle(source.querySelector('.cm-gutters')).position,
					radius: parseFloat(getComputedStyle(source.querySelector('.cm-editor')).borderRadius),
					sourceTabs: box(editor.querySelector('[aria-label="Source format"]')), previewTabs: box(editor.querySelector('[aria-label="Preview format"]')),
					footer: box(footer), actions: actions.map(box), labels: actions.map(button => button.textContent),
					export: box(footer.querySelector('.advanced-mermaid-export button[aria-expanded]')),
					overflow: editor.scrollWidth > editor.clientWidth,
				};
			});
			assert.match(metrics.font, /Courier New/, `${theme}: ${JSON.stringify(metrics)}`); assert.equal(metrics.contentFont, metrics.font);
			assert.ok(metrics.gap >= 7, `${theme}: Source touches the gutter at ${width}px: ${metrics.gap}`);
			assert.equal(metrics.gutterPosition, 'sticky');
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
				const content = fixture.sourceRoot(layoutFixture.host).querySelector('.cm-content');
				const nested = fixture.EditorView.findFromDOM(content);
				nested.dispatch({ selection: { anchor: nested.state.doc.length }, scrollIntoView: true });
			});
			await page.waitForTimeout(80);
			const lastLine = await page.evaluate(() => {
				const source = fixture.sourceRoot(layoutFixture.host);
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
			const sizes = { source: getComputedStyle(fixture.sourceRoot(layoutFixture.host).querySelector('.cm-content')).fontSize,
				inherited: getComputedStyle(source).fontSize,
				parent: getComputedStyle(layoutFixture.view.scrollDOM).fontSize,
				preview: getComputedStyle(layoutFixture.host.querySelector('svg.pele text')).fontSize };
			const tab = new fixture.AdvancedMermaidSettingTab(fixture.app, {}, layoutFixture.settings, () => layoutFixture.inline.refresh());
			tab.containerEl = document.body.createDiv(); tab.display(); layoutFixture.fontTab = tab;
			[...tab.containerEl.querySelectorAll('.setting-item')].find(row => row.textContent.includes('Editor appearance')).querySelector('button').click();
			return sizes;
		});
		const fontSize = page.getByRole('spinbutton', { name: 'Source font size', exact: true });
		assert.equal(await fontSize.inputValue(), '10');
		assert.equal(originalSizes.source, '10px');
		await fontSize.fill('22');
		await page.waitForFunction(() => getComputedStyle(fixture.sourceRoot(document).querySelector('.cm-content')).fontSize === '22px');
		await page.locator('.advanced-mermaid-editor-source').scrollIntoViewIfNeeded();
		await page.evaluate(() => {
			const nested = fixture.EditorView.findFromDOM(fixture.sourceRoot(layoutFixture.host).querySelector('.cm-content'));
			nested.dispatch({ selection: { anchor: nested.state.doc.length }, scrollIntoView: true });
		});
		await page.waitForTimeout(80);
		const resized = await page.evaluate(() => {
			const source = fixture.sourceRoot(layoutFixture.host);
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
		await page.waitForFunction(() => getComputedStyle(fixture.sourceRoot(document).querySelector('.cm-content')).fontSize === '22px');
		await page.getByRole('tab', { name: 'CSS', exact: true }).click();
		assert.equal(await page.locator('.advanced-mermaid-editor-source .cm-content').evaluate(element => getComputedStyle(element).fontSize), '22px');
		await fontSize.fill('');
		await page.waitForFunction(size => getComputedStyle(fixture.sourceRoot(document).querySelector('.cm-content')).fontSize === size, originalSizes.inherited);
		assert.equal(await fontSize.getAttribute('aria-invalid'), 'false');
		assert.equal(await page.evaluate(() => layoutFixture.settings.liveEditor.fontSizePx), null);
		await page.getByRole('tab', { name: 'Mermaid', exact: true }).first().click();
		await page.evaluate(() => { layoutFixture.fontTab.hide(); layoutFixture.fontTab.containerEl.remove(); delete layoutFixture.fontTab; });
		await page.evaluate(() => {
			layoutFixture.settings.liveEditor.lineNumbers = false; layoutFixture.settings.liveEditor.wrapSource = false; layoutFixture.inline.refresh();
			const nested = fixture.EditorView.findFromDOM(fixture.sourceRoot(layoutFixture.host).querySelector('.cm-content'));
			const insert = '\n  ' + 'Long branch '.repeat(80);
			nested.dispatch({ changes: { from: nested.state.doc.length, insert }, selection: { anchor: nested.state.doc.length + insert.length }, scrollIntoView: true });
		});
		await page.locator('.advanced-mermaid-editor-source').scrollIntoViewIfNeeded();
		await page.waitForTimeout(100);
		const unwrapped = await page.evaluate(() => {
			const editor = layoutFixture.host.querySelector('.advanced-mermaid-editor');
			const source = fixture.sourceRoot(editor);
			const scroller = source.querySelector('.cm-scroller');
			return { gutters: source.querySelectorAll('.cm-gutters').length, scrolls: scroller.scrollWidth > scroller.clientWidth,
				contained: editor.scrollWidth <= editor.clientWidth, parentFont: getComputedStyle(layoutFixture.view.scrollDOM).fontFamily };
		});
		assert.equal(unwrapped.gutters, 0); assert.ok(unwrapped.scrolls && unwrapped.contained, JSON.stringify(unwrapped)); assert.equal(unwrapped.parentFont, 'Arial');
		await page.getByRole('tab', { name: 'CSS', exact: true }).click();
		assert.match(await page.locator('.advanced-mermaid-editor-source .cm-content').evaluate(element => getComputedStyle(element).fontFamily), /Courier New/);
		if (theme === 'Minimal') {
			const moved = await page.evaluate(() => {
				const { host, view } = layoutFixture;
				const sourcePane = host.querySelector('.advanced-mermaid-editor-source');
				const original = fixture.sourceRoot(host);
				const nested = fixture.EditorView.findFromDOM(original.querySelector('.cm-editor'));
				const frame = document.body.createEl('iframe');
				const other = frame.contentWindow;
				fixture.installDomHelpers(other);
				const move = target => {
					target.body.append(host);
					view.setRoot(target);
					sourcePane.dispatchEvent(new target.defaultView.Event('fixture-window-migrated'));
				};
				try {
					move(other.document);
					const root = fixture.sourceRoot(host);
					return {
						owner: root.ownerDocument === other.document,
						sameEditor: fixture.EditorView.findFromDOM(root.querySelector('.cm-editor')) === nested,
						font: other.getComputedStyle(root.querySelector('.cm-content')).fontFamily,
					};
				} finally {
					move(document);
					frame.remove();
				}
			});
			assert.ok(moved.owner && moved.sameEditor, JSON.stringify(moved));
			assert.match(moved.font, /Courier New/);
		}
		console.log(`Inline layout passed (${theme}): host CSS, monospace Mermaid/CSS, gutter spacing, rounded source, header/footer positions, responsive widths and live source font-size settings/validation/reset.`);
	} finally {
		await page.evaluate(() => { layoutFixture.fontTab?.hide(); layoutFixture.fontTab?.containerEl.remove(); layoutFixture.view.destroy(); layoutFixture.inline.destroy(); layoutFixture.host.remove(); delete window.layoutFixture; });
		await hostStyle.evaluate(element => element.remove());
		if (originalViewport) await page.setViewportSize(originalViewport);
	}
}

/** The full-screen split follows the pane aspect ratio and contains both scroll areas. */
export async function runFullScreenLayoutChecks(page) {
	const viewport = page.viewportSize();
	await page.setViewportSize({ width: 1400, height: 1150 });
	await page.evaluate(() => {
		const host = document.body.createDiv({ cls: 'view-content advanced-mermaid-full-screen-view' });
		const settings = fixture.normalizeSettings({ liveEditor: { fullScreen: true, layout: 'stacked' } });
		const source = 'flowchart LR\n A[Start] --> B[End]\n' + '%% Scrollable source\n'.repeat(150);
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const parent = new fixture.EditorView({ state: fixture.EditorState.create({
			doc: '```mermaid\n' + source + '```',
			extensions: [language, fixture.editorInfoField, fixture.editorLivePreviewField],
		}) });
		const bridge = fixture.sourceBridge(parent, () => fixture.diagramFences(parent.state)[0]);
		const editor = new fixture.LiveEditor(fixture.app, () => settings, bridge, () => 'Test.md', () => {},
			() => editor.setFullScreen(!editor.element.hasAttribute('data-full-screen')));
		host.append(editor.element);
		window.fullScreenFixture = { host, parent, editor };
	});
	const root = page.locator('.advanced-mermaid-full-screen-view > .advanced-mermaid-editor');
	const preview = root.locator('.advanced-mermaid-editor-preview');
	const checkZoom = async () => {
		const svg = preview.locator('svg.pele');
		const fitted = await svg.getAttribute('viewBox');
		await preview.getByRole('button', { name: 'Zoom In', exact: true }).click();
		assert.notEqual(await svg.getAttribute('viewBox'), fitted);
		const bounds = await preview.evaluate(pane => {
			const preview = pane.getBoundingClientRect();
			const drawing = pane.querySelector('svg.pele').getBoundingClientRect();
			const rail = pane.querySelector('.pele-zoom').getBoundingClientRect();
			return { width: drawing.width - preview.width, height: drawing.height - preview.height,
				left: rail.left - preview.left, bottom: preview.bottom - rail.bottom };
		});
		assert(Math.abs(bounds.width) <= 1 && Math.abs(bounds.height) <= 1, JSON.stringify(bounds));
		assert(Math.abs(bounds.left - 8) <= 1 && Math.abs(bounds.bottom - 8) <= 1, JSON.stringify(bounds));
		await preview.getByRole('button', { name: 'Reset Zoom', exact: true }).click();
		assert.equal(await svg.getAttribute('viewBox'), fitted);
	};
	try {
		const toolbar = root.locator('.advanced-mermaid-editor-header');
		const open = toolbar.getByRole('button', { name: 'Open full-screen' });
		assert.deepEqual(await toolbar.locator('button').allTextContents(), ['Mermaid', 'CSS', 'Open full-screen', 'Pele', 'SVG']);
		assert(await open.evaluate(button => parseFloat(getComputedStyle(button.parentElement).borderInlineStartWidth) > 0));
		await page.evaluate(() => { fullScreenFixture.host.style.cssText = 'width: 1200px; height: 680px'; });
		await open.click();
		await root.locator('svg.pele').waitFor();
		for (const [width, height, ratio] of [[1200, 680, 0.3], [980, 1060, 0.5], [450, 710, 0.5], [1200, 680, 0.3]]) {
			await page.evaluate(({ width, height }) => {
				fullScreenFixture.host.style.cssText = `width: ${width}px; height: ${height}px`;
			}, { width, height });
			const layout = ({ ratio, details }) => {
				const { host, editor } = fullScreenFixture;
				const source = host.querySelector('.advanced-mermaid-editor-source');
				const preview = host.querySelector('.advanced-mermaid-editor-preview');
				const diagram = preview.querySelector('svg.pele');
				const left = source.getBoundingClientRect();
				const right = preview.getBoundingClientRect();
				const svg = diagram?.getBoundingClientRect();
				const scroller = fixture.sourceRoot(editor.element).querySelector('.cm-scroller');
				const checks = {
					split: Math.abs(left.width / (left.width + right.width) - ratio) < 0.01,
					aligned: left.right < right.left && left.top === right.top && left.bottom === right.bottom,
					diagram: !!svg && svg.width > 0 && svg.height > 0 && svg.left >= right.left - 1 &&
						svg.right <= right.right + 1 && svg.top >= right.top && svg.bottom <= right.bottom,
					sourceScroll: scroller.scrollHeight > scroller.clientHeight,
					paneFits: host.scrollWidth <= host.clientWidth + 1 && host.scrollHeight <= host.clientHeight + 1,
				};
				return details ? {
					...checks,
					paneHeight: [host.clientHeight, host.scrollHeight],
					paneWidth: [host.clientWidth, host.scrollWidth],
					sourceHeight: [left.height, scroller.clientHeight, scroller.scrollHeight],
				} : Object.values(checks).every(Boolean);
			};
			await page.waitForFunction(layout, { ratio }, { timeout: 4000 }).catch(async error => {
				const checks = await page.evaluate(layout, { ratio, details: true });
				throw new Error(`Full-screen layout at ${width} × ${height}: ${JSON.stringify(checks)}`, { cause: error });
			});
		}
		await checkZoom();
		await toolbar.getByRole('button', { name: 'Return to note' }).click();
		assert.equal(await root.getAttribute('data-full-screen'), null);
		assert.equal(await root.locator('.advanced-mermaid-editor-columns').evaluate(columns =>
			getComputedStyle(columns).gridTemplateColumns.split(' ').length), 1);
		await checkZoom();
		console.log('Full-screen layout passed: toolbar order, 30/70 and 50/50 splits, diagram placement, source scrolling and return to inline.');
	} finally {
		await page.evaluate(() => {
			const { editor, parent, host } = fullScreenFixture;
			editor.destroy(); parent.destroy(); host.remove();
			delete window.fullScreenFixture;
		});
		await page.setViewportSize(viewport);
	}
}
