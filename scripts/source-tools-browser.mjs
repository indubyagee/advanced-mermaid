import assert from 'node:assert/strict';

export async function runSourceToolsChecks(page) {
	// Same representative Minimal selectors as the existing editor layout fixture.
	const theme = await page.addStyleTag({ content: `
		body :not(.canvas-node) .source-tools-fixture .cm-gutters { position:absolute !important; z-index:0; }
		.source-tools-fixture .cm-line { color: red; max-width: 700px; }
	` });
	await page.evaluate(() => {
		const host = document.body.createDiv({ cls: 'source-tools-fixture' }); host.style.width = '900px';
		const settings = fixture.normalizeSettings(null);
		settings.liveEditor.wrapSource = true;
		const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const source = '---\nconfig:\n  flowchart:\n    curve: basis\n---\n%%{init: {"theme": "base"}}%%\nflowchart TD\nsubgraph Group\n\tsubgraph Nested\n\t\tA["Quoted label"] --> B\n\n\t\t%% comment\n\tend\nend';
		const text = 'Before\n\n```pele\n' + source + '\n```\n\nAfter';
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const indentWidth = new fixture.Compartment();
		const indentation = new fixture.Compartment();
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({ doc: text, extensions: [language, indentWidth.of(fixture.EditorState.tabSize.of(4)), indentation.of(fixture.indentUnit.of('    ')), fixture.history(), fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension] }) });
		view.dispatch({ selection: { anchor: text.indexOf('flowchart TD') } }); view.focus(); inline.toggle();
		window.sourceToolsFixture = { host, settings, inline, view, source, indentWidth, indentation,
			nested: () => fixture.EditorView.findFromDOM(fixture.sourceRoot(host).querySelector('.cm-editor')) };
	});
	const foldCount = () => page.evaluate(() => fixture.foldedRanges(sourceToolsFixture.nested().state).size);
	try {
		await page.waitForFunction(() => fixture.sourceRoot(sourceToolsFixture.host).querySelector('.am-source-comment'));
		const colors = await page.evaluate(() => {
			const root = fixture.sourceRoot(sourceToolsFixture.host);
			const result = [];
			for (const dark of [false, true]) {
				document.body.classList.toggle('theme-dark', dark);
				result.push(['declaration', 'keyword', 'operator', 'string', 'comment', 'frontmatter', 'directive'].map(type => {
					const token = root.querySelector('.am-source-' + type);
					return getComputedStyle(token).color;
				}));
			}
			document.body.classList.remove('theme-dark');
			return result;
		});
		for (const themeColors of colors) assert.equal(new Set(themeColors).size, 7, 'Distinct visible token colors in each theme');
		assert.ok(colors[0].every((value, index) => value !== colors[1][index]), 'Token colors switch with the theme');
		for (const char of ['    ', '\t']) {
			await page.evaluate(char => {
				const f = sourceToolsFixture;
				f.view.dispatch({ effects: f.indentation.reconfigure(fixture.indentUnit.of(char)) });
				const nested = f.nested();
				nested.dispatch({ selection: { anchor: nested.state.doc.line(7).to } });
				nested.focus();
			}, char);
			await page.keyboard.press('Tab');
			assert.ok(await page.evaluate(char => sourceToolsFixture.view.state.doc.toString().includes('\n' + char + 'flowchart TD\n'), char), 'Tab forwards the configured indentation to the note');
			await page.keyboard.press('Shift+Tab');
			assert.ok(await page.evaluate(() => sourceToolsFixture.nested().state.doc.toString() === sourceToolsFixture.source), 'Shift+Tab removes the same indentation');
		}
		await page.waitForTimeout(500); // Let initial preview work settle before counting fold-only activity.
		await page.evaluate(() => {
			const f = sourceToolsFixture;
			f.parentChanges = 0; f.renderCalls = 0;
			f.originalRender = fixture.DiagramController.prototype.render;
			fixture.DiagramController.prototype.render = function (...args) { f.renderCalls++; return f.originalRender.apply(this, args); };
			f.before = f.view.state.doc.toString();
			f.originalDispatch = f.view.dispatch;
			f.view.dispatch = function (...args) { f.parentChanges++; return f.originalDispatch.apply(this, args); };
			const nested = f.nested(); const header = nested.state.doc.line(8);
			nested.dispatch({ selection: { anchor: header.from + 3, head: header.to } }); nested.focus();
		});
		await page.keyboard.press('Control+Shift+{');
		assert.equal(await foldCount(), 1, 'Keyboard folds an indented block');
		await page.keyboard.press('Control+Shift+}');
		assert.equal(await foldCount(), 0, 'Keyboard unfolds the same block');
		assert.equal(await page.evaluate(() => sourceToolsFixture.parentChanges), 0);
		const group = page.locator('.source-tools-fixture .cm-content .cm-line').filter({ hasText: 'subgraph Group' });
		const arrow = group.getByRole('button');
		assert.equal(await arrow.getAttribute('aria-expanded'), 'true');
		const measure = () => page.evaluate(() => {
			const f = sourceToolsFixture; const root = fixture.sourceRoot(f.host);
			const lines = [...root.querySelectorAll('.cm-content .cm-line')];
			const header = lines.find(line => line.textContent.includes('subgraph Nested'));
			const child = lines.find(line => line.textContent.includes('Quoted label'));
			const blank = lines[lines.indexOf(child) + 1];
			const next = lines[lines.indexOf(child) + 2];
			const guides = getComputedStyle(child).backgroundPosition.split(',').map(value => parseFloat(value));
			const center = header.querySelector('.am-fold-arrow').getBoundingClientRect();
			return {
				tabSize: f.nested().state.tabSize, guide: Math.max(...guides), outerGuide: Math.min(...guides),
				arrow: center.left + center.width / 2 - header.getBoundingClientRect().left,
				blankGuides: getComputedStyle(blank).backgroundPosition,
				childGuides: getComputedStyle(child).backgroundPosition,
				continuous: child.getBoundingClientRect().bottom === blank.getBoundingClientRect().top &&
					blank.getBoundingClientRect().bottom === next.getBoundingClientRect().top,
				gutters: [...root.querySelector('.cm-gutters').children].map(gutter => gutter.className),
			};
		});
		const original = await measure();
		assert.equal(original.tabSize, 4);
		assert.ok(original.continuous && original.blankGuides === original.childGuides);
		assert.ok(Math.abs(original.arrow - original.guide) < 1, JSON.stringify(original));
		assert.deepEqual(original.gutters, ['cm-gutter cm-lineNumbers']);
		await page.evaluate(() => {
			const f = sourceToolsFixture;
			f.view.dispatch({ effects: f.indentWidth.reconfigure(fixture.EditorState.tabSize.of(8)) });
			f.parentChanges = 0;
		});
		const wider = await measure();
		assert.equal(wider.tabSize, 8);
		assert.ok(Math.abs(wider.arrow - wider.guide) < 1 && Math.abs((wider.guide - wider.outerGuide) / (original.guide - original.outerGuide) - 2) < 0.05);
		const direction = () => arrow.evaluate(button => getComputedStyle(button, '::before').transform);
		const down = await direction();
		await arrow.click();
		assert.equal(await foldCount(), 1, 'Pointer folds the block');
		assert.equal(await arrow.getAttribute('aria-expanded'), 'false');
		assert.notEqual(await direction(), down);
		assert.ok(await page.evaluate(() => {
			const lines = fixture.sourceRoot(sourceToolsFixture.host).querySelectorAll('.cm-content .cm-line');
			const closing = Array.from(lines).find(line => line.textContent === 'end');
			return closing && !closing.classList.contains('am-indent-guides');
		}), 'Collapsed block removes its own guide');
		const folded = await page.evaluate(() => {
			const root = fixture.sourceRoot(sourceToolsFixture.host);
			return { header: root.textContent.includes('subgraph Group'), closing: root.querySelector('.cm-content').textContent.includes('end'),
				content: sourceToolsFixture.view.state.doc.toString() === sourceToolsFixture.before,
				renderCalls: sourceToolsFixture.renderCalls, parentChanges: sourceToolsFixture.parentChanges };
		});
		assert.deepEqual(folded, { header: true, closing: true, content: true, renderCalls: 0, parentChanges: 0 });
		await page.evaluate(() => {
			const f = sourceToolsFixture; f.view.dispatch = f.originalDispatch;
			fixture.DiagramController.prototype.render = f.originalRender;
			f.selection = f.nested().state.selection.toJSON();
			f.beforeNested = f.nested();
			f.settings.liveEditor.lineNumbers = false;
			f.settings.liveEditor.fontSizePx = 18;
			f.settings.liveEditor.style.colors.indentGuide = { light: '#123456', dark: '#abcdef' };
			f.settings.liveEditor.style.colors.foldArrow = { light: '#246813', dark: '#bdf135' };
			f.inline.refresh();
		});
		await page.waitForTimeout(100);
		assert.ok(await page.evaluate(() => sourceToolsFixture.beforeNested === sourceToolsFixture.nested()), 'Appearance refresh retains the nested editor');
		assert.equal(await foldCount(), 1, 'Settings refresh retains the active fold');
		const appearance = await page.evaluate(() => {
			const f = sourceToolsFixture; const root = fixture.sourceRoot(f.host); const results = [];
			for (const dark of [false, true]) {
				document.body.classList.toggle('theme-dark', dark);
				results.push({ arrow: getComputedStyle(root.querySelector('.am-fold-arrow')).color,
					guide: getComputedStyle(root.querySelector('.am-indent-guides')).backgroundImage });
			}
			document.body.classList.remove('theme-dark');
			return { results, noNumbers: !root.querySelector('.cm-lineNumbers'), selection: f.nested().state.selection.toJSON(), before: f.selection };
		});
		assert.equal(appearance.noNumbers, true); assert.deepEqual(appearance.selection, appearance.before);
		assert.equal(appearance.results[0].arrow, 'rgb(36, 104, 19)'); assert.equal(appearance.results[1].arrow, 'rgb(189, 241, 53)');
		assert.match(appearance.results[0].guide, /rgb\(18, 52, 86\)/); assert.match(appearance.results[1].guide, /rgb\(171, 205, 239\)/);
		await page.evaluate(() => {
			const f = sourceToolsFixture; const nested = f.nested(); fixture.unfoldCode(nested);
			const from = nested.state.doc.toString().indexOf('\t\tA[');
			nested.dispatch({ changes: { from, insert: '\t\tC["' + 'long label '.repeat(30) + '"]\n' } });
			const header = nested.state.doc.line(9); nested.dispatch({ selection: { anchor: header.from } }); fixture.foldCode(nested);
			f.host.style.width = '340px';
		});
		assert.equal(await foldCount(), 1, 'Folding recomputes ranges after source changes');
		await page.evaluate(() => fixture.unfoldCode(sourceToolsFixture.nested()));
		await page.waitForTimeout(100);
		const wrapped = await page.evaluate(() => {
			const f = sourceToolsFixture; const view = f.nested();
			const line = view.state.doc.line(10); const block = view.lineBlockAt(line.from);
			const dom = view.domAtPos(line.from).node.parentElement.closest('.cm-line');
			return { wraps: block.height > view.defaultLineHeight * 2, guideSize: getComputedStyle(dom).backgroundSize,
				singlePreview: f.host.querySelectorAll('.advanced-mermaid-editor-render svg.pele').length === 1 };
		});
		assert.ok(wrapped.wraps && wrapped.singlePreview); assert.match(wrapped.guideSize, /^1px 100%/, 'Guides span wrapped visual rows');
		await page.evaluate(() => {
			const f = sourceToolsFixture; const view = f.nested();
			view.dispatch({ changes: { from: view.state.doc.length, insert: '\nsubgraph Long\n' + Array.from({ length: 300 }, (_, i) => '  N' + i + '-->N' + (i + 1)).join('\n') + '\nend' } });
			view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
		});
		await page.waitForTimeout(120);
		assert.ok(await page.evaluate(() => {
			const root = fixture.sourceRoot(sourceToolsFixture.host);
			return root.querySelector('.cm-scroller').scrollTop > 0 && root.querySelectorAll('.am-indent-guides').length > 0 && root.querySelectorAll('.am-indent-guides').length < 300;
		}), 'Guides follow scrolling and remain limited to visible lines');
		console.log('Source tools: token colors, Minimal isolation, keyboard/pointer folding, note/render isolation, refresh retention, theme pairs, wrapping, changed ranges and visible-range scrolling passed.');
	} finally {
		await page.evaluate(() => {
			const f = sourceToolsFixture;
			if (f.originalRender) fixture.DiagramController.prototype.render = f.originalRender;
			if (f.originalDispatch) f.view.dispatch = f.originalDispatch;
			f.view.destroy(); f.inline.destroy(); f.host.remove(); delete window.sourceToolsFixture;
			document.body.classList.remove('theme-dark');
		});
		await theme.evaluate(element => element.remove());
	}
}
