import assert from 'node:assert/strict';

export async function runDiagramStyleChecks(page) {
	const failures = await page.evaluate(async () => {
		const width = svg => Number(svg.getAttribute('width'));
		const height = svg => Number(svg.getAttribute('height'));
		const cases = {
			class: {
				defaults: { config: { class: { hideEmptyMembersBox: true } } },
				authored: { config: { class: { hideEmptyMembersBox: false } } },
				labels: ['+String title', '+lend()', 'borrows'],
				effect: (configured, authored) => height(configured) < height(authored),
			},
			er: {
				defaults: { config: { er: { rankSpacing: 160 } } },
				authored: { config: { er: { rankSpacing: 60 } } },
				labels: ['READER', 'LOAN', 'BOOK', 'borrows', 'includes'],
				effect: (configured, authored) => height(configured) > height(authored) &&
					configured.querySelectorAll('.pele-er-identifying').length === 2,
			},
			requirement: {
				defaults: { title: 'Requirements defaults' },
				authored: { title: 'Authored requirements' },
				labels: ['backup', 'archive', 'satisfies'],
				effect: (configured, authored) => configured.textContent.includes('Requirements defaults') &&
					authored.textContent.includes('Authored requirements'),
			},
			usecase: {
				defaults: { config: { usecase: { rankSpacing: 160 } } },
				authored: { config: { usecase: { rankSpacing: 40 } } },
				labels: ['Reader', 'Library', 'Borrow book', 'Renew loan'],
				effect: (configured, authored) => width(configured) > width(authored) &&
					configured.querySelectorAll('.pele-boundary').length === 1,
			},
		};
		const legacy = {
			schemaVersion: 6,
			style: {
				global: { colors: { background: { light: '#edf2f7', dark: '#edf2f7' } } },
				diagrams: { flowchart: { useGlobal: false, overrides: { colors: { background: { light: '#fff' } } } } },
			},
		};
		const background = 'rgb(215, 234, 228)';
		const scoped = Object.fromEntries(Object.entries(cases).map(([category, test]) => [category, {
			useGlobal: false,
			overrides: { colors: { background: { light: '#d7eae4', dark: '#d7eae4' } } },
			frontmatter: { enabled: true, yaml: JSON.stringify(test.defaults) },
		}]));
		const plugin = new fixture.AdvancedMermaidPlugin(fixture.app, { id: 'diagram-style-fixture' });
		plugin.data = { ...legacy, style: { ...legacy.style, diagrams: { ...legacy.style.diagrams, ...scoped } } };
		await plugin.onload();

		const failures = [];
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const renderReading = (source, fence) => {
			const host = document.body.createDiv({ cls: 'fixture-diagram' });
			let child;
			plugin.processors.get(fence).handler(source, host, {
				sourcePath: 'Styles.md', getSectionInfo: () => null, addChild: value => { child = value; child.load(); },
			});
			return { host, destroy: () => { child?.unload(); host.remove(); } };
		};
		const renderedSvg = host => host.querySelector('.advanced-mermaid-mount > svg.pele');
		const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

		try {
			for (const [category, test] of Object.entries(cases)) {
				for (const [index, declaration] of fixture.DIAGRAM_REGISTRY[category].declarations.entries()) {
					const source = fixture.styleExampleSources[category].replace(/^[^\n]*/, declaration);
					const fence = index % 2 ? 'pele' : 'mermaid';
					const noteStart = 'Before\n\n\x60\x60\x60' + fence + '\n';
					const note = noteStart + source + '\n\x60\x60\x60\n\nAfter';
					const inherited = fixture.diagram(source, legacy);
					const reading = renderReading(source, fence);
					const authored = renderReading('---\n' + JSON.stringify(test.authored) + '\n---\n' + source, fence);
					const host = document.body.createDiv({ cls: 'fixture-diagram' });
					const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({
						doc: note, selection: { anchor: noteStart.length },
						extensions: [language, fixture.editorInfoField, fixture.editorLivePreviewField, plugin.extensions],
					}) });
					try {
						view.focus();
						if (!plugin.inline.toggle()) throw new Error('Could not open Live Editor for ' + declaration);
						await nextFrame();
						const defaults = renderedSvg(reading.host);
						const overridden = renderedSvg(authored.host);
						const inline = renderedSvg(host);
						if (![defaults, overridden, inline].every(svg => svg && test.labels.every(label => svg.textContent.includes(label)))) {
							failures.push(declaration + ' labels in Reading view and Live Editor');
							continue;
						}
						if (!test.effect(defaults, overridden) || !test.effect(inline, overridden)) failures.push(declaration + ' authored/default configuration');
						if ([defaults, overridden, inline].some(svg => getComputedStyle(svg).backgroundColor !== background)) failures.push(declaration + ' scoped background');
						if (getComputedStyle(renderedSvg(inherited.host)).backgroundColor !== 'rgb(237, 242, 247)') failures.push(declaration + ' inherited background');
						if (view.state.doc.toString() !== note) failures.push(declaration + ' note text changed');
					} finally {
						view.destroy();
						host.remove();
						authored.destroy();
						reading.destroy();
						inherited.child.unload();
						inherited.host.remove();
					}
				}
			}
		} finally { plugin.unload(); }
		return failures;
	});
	assert.deepEqual(failures, []);
	console.log('Scoped diagram styles passed: inherited and scoped paint, authored configuration precedence, Reading view and Live Editor.');
}
