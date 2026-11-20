import assert from 'node:assert/strict';

export async function runDiagramStyleChecks(page) {
	const report = await page.evaluate(async () => {
		const width = svg => Number(svg.getAttribute('width'));
		const height = svg => Number(svg.getAttribute('height'));
		const gradientIds = svg => [...svg.querySelectorAll('linearGradient[id]')].map(gradient => gradient.id);
		const sliceLabelX = svg => Number(svg.querySelector('.pele-slice-labels text')?.getAttribute('x'));
		const quadrantFonts = size => ({
			titleFontSize: size, xAxisLabelFontSize: size, yAxisLabelFontSize: size,
			quadrantLabelFontSize: size, pointLabelFontSize: size,
		});
		const quadrantLabels = ['Release priorities', 'Low effort', 'High impact', 'Plan', 'Quick fix'];
		const labelSize = (svg, text) => {
			const label = [...svg.querySelectorAll('text')].find(label => label.textContent === text);
			return label ? getComputedStyle(label).fontSize : undefined;
		};
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
			packet: {
				defaults: { config: { packet: { bitsPerRow: 16 } } },
				authored: { config: { packet: { bitsPerRow: 32 } } },
				labels: ['Version', 'Length', 'Payload', '47'],
				effect: (configured, authored) => height(configured) > height(authored) && width(configured) < width(authored),
				exportImages: true,
			},
			block: {
				defaults: { config: { block: { padding: 32 } } },
				authored: { config: { block: { padding: 8 } } },
				labels: ['Draft', 'Review', 'Revise', 'Publish'],
				effect: (configured, authored) => height(configured) > height(authored) &&
					configured.querySelectorAll('.pele-cluster').length === 2,
				exportImages: true,
			},
			sankey: {
				defaults: { config: { sankey: { linkColor: 'gradient' } } },
				authored: { config: { sankey: { linkColor: 'source' } } },
				labels: ['Draft', 'Review, edit', 'Published', 'Deferred'],
				effect: (configured, authored) => {
					const ids = gradientIds(configured);
					const links = [...configured.querySelectorAll('.pele-sankey-link')];
					return ids.length === 3 && links.length === 3 && gradientIds(authored).length === 0 &&
						links.every(link => ids.some(id => link.getAttribute('fill')?.includes('url(#' + id + ')')));
				},
				exportImages: true,
			},
			pie: {
				defaults: { config: { pie: { textPosition: 0.5 } } },
				authored: { config: { pie: { textPosition: 0.9 } } },
				labels: ['Written', 'Reviewed', 'Published', '50%'],
				effect: (configured, authored) => sliceLabelX(configured) < sliceLabelX(authored),
			},
			quadrantChart: {
				defaults: { config: { quadrantChart: quadrantFonts(24) } },
				authored: { config: { quadrantChart: quadrantFonts(16) } },
				labels: quadrantLabels,
				effect: (configured, authored) => quadrantLabels.every(label =>
					labelSize(configured, label) === '24px' && labelSize(authored, label) === '16px'),
			},
			xychart: {
				defaults: { config: { xyChart: { width: 900 } } },
				authored: { config: { xyChart: { width: 640 } } },
				labels: ['Jan', 'Feb', 'Mar'],
				effect: (configured, authored) => width(configured) === 900 && width(authored) === 640 &&
					!!configured.querySelector('.pele-series.pele-bars') && !!configured.querySelector('.pele-series.pele-line'),
			},
			venn: {
				defaults: { config: { themeVariables: { venn1: '#df6021' } } },
				authored: { config: { themeVariables: { venn1: '#267e00' } } },
				labels: ['Writing', 'Review', 'Both'],
				effect: (configured, authored) => getComputedStyle(configured.querySelector('.pele-venn-set')).fill === 'rgb(223, 96, 33)' &&
					getComputedStyle(authored.querySelector('.pele-venn-set')).fill === 'rgb(38, 126, 0)',
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
		const registry = Object.entries(fixture.DIAGRAM_REGISTRY);
		const scoped = Object.fromEntries(registry.map(([category]) => [category, {
			useGlobal: false,
			overrides: { colors: {
				background: { light: '#d7eae4', dark: '#d7eae4' },
				series1: { light: '#af1843', dark: '#af1843' },
			} },
			...(cases[category] ? { frontmatter: { enabled: true, yaml: JSON.stringify(cases[category].defaults) } } : {}),
		}]));
		const plugin = new fixture.AdvancedMermaidPlugin(fixture.app, { id: 'diagram-style-fixture' });
		plugin.data = { ...legacy, style: { ...legacy.style, diagrams: { ...legacy.style.diagrams, ...scoped } } };
		const settings = fixture.normalizeSettings(plugin.data);
		await plugin.onload();

		const failures = [];
		const familySources = new Map(registry.map(([category, { declarations }]) => [category, declarations.map(declaration => [
			declaration, fixture.styleExampleSources[category].replace(/^[^\n]*/, declaration),
		])]));
		for (const diagram of fixture.DIAGRAM_SYNTAX) {
			if (familySources.has(diagram.type)) continue;
			const body = diagram.type === 'railroad' ? fixture.diagramComponents(diagram)[0].text : fixture.syntaxBodies[diagram.type];
			familySources.set(diagram.type, [[diagram.declaration, diagram.declaration + '\n' + body]]);
		}
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
		const verifyImages = async (source, test, declaration, liveSvg) => {
			const host = document.body.createDiv({ cls: 'fixture-diagram' });
			const controller = new fixture.DiagramController(host, source, () => settings, fixture.app, 'Styles.md');
			try {
				controller.load();
				const snapshot = await controller.snapshot();
				const svg = new DOMParser().parseFromString(snapshot.svg, 'image/svg+xml').documentElement;
				if (svg.localName !== 'svg' || !test.labels.every(label => svg.textContent.includes(label)) ||
					snapshot.width !== width(liveSvg) || snapshot.height !== height(liveSvg)) failures.push(declaration + ' exported SVG geometry and labels');
				if (test === cases.sankey) {
					const fills = [...renderedSvg(host).querySelectorAll('linearGradient stop')].map(stop => getComputedStyle(stop).stopColor);
					const exported = [...svg.querySelectorAll('linearGradient stop')].map(stop => stop.style.stopColor);
					if (!fills.includes('rgb(175, 24, 67)') || exported.join() !== fills.join()) failures.push(declaration + ' exported gradient stop colors');
				}
				const png = await fixture.createPng(snapshot, document, new AbortController().signal);
				const bitmap = await createImageBitmap(png);
				try {
					const canvas = document.createElement('canvas');
					canvas.width = canvas.height = 1;
					const context = canvas.getContext('2d');
					context.drawImage(bitmap, 0, 0);
					const firstPixel = context.getImageData(0, 0, 1, 1).data;
					if (firstPixel.join() !== '215,234,228,255') failures.push(declaration + ' exported PNG background');
				} finally { bitmap.close(); }
			} finally { controller.destroy(); host.remove(); }
		};

		try {
			let checked = 0;
			for (const [category, sources] of familySources) {
				const test = cases[category];
				const styled = Object.hasOwn(fixture.DIAGRAM_REGISTRY, category);
				for (const [declaration, source] of sources) {
					const fence = checked++ % 2 ? 'pele' : 'mermaid';
					const noteStart = 'Before\n\n\x60\x60\x60' + fence + '\n';
					const note = noteStart + source + '\n\x60\x60\x60\n\nAfter';
					const inherited = test && fixture.diagram(source, legacy);
					const reading = renderReading(source, fence);
					const authored = test && renderReading('---\n' + JSON.stringify(test.authored) + '\n---\n' + source, fence);
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
						const inline = renderedSvg(host);
						if (view.state.doc.toString() !== note) failures.push(declaration + ' note text changed');
						if (![defaults, inline].every(svg => svg?.closest('.advanced-mermaid')?.dataset.category === (styled ? category : 'other'))) {
							failures.push(declaration + ' renders in Reading view and Live Editor');
							continue;
						}
						const paint = styled ? background : 'rgb(237, 242, 247)';
						if ([defaults, inline].some(svg => getComputedStyle(svg).backgroundColor !== paint)) failures.push(declaration + ' diagram background');
						if (!test) continue;
						const overridden = renderedSvg(authored.host);
						if (![defaults, overridden, inline].every(svg => svg && test.labels.every(label => svg.textContent.includes(label)))) {
							failures.push(declaration + ' example labels');
							continue;
						}
						if (!test.effect(defaults, overridden) || !test.effect(inline, overridden)) failures.push(declaration + ' authored/default configuration');
						if (getComputedStyle(renderedSvg(inherited.host)).backgroundColor !== 'rgb(237, 242, 247)') failures.push(declaration + ' inherited background');
						if (category === 'sankey' && gradientIds(defaults).some(id => gradientIds(inline).includes(id))) failures.push(declaration + ' duplicate gradient IDs');
						if (test.exportImages) await verifyImages(source, test, declaration, defaults);
					} finally {
						view.destroy();
						host.remove();
						authored?.destroy();
						reading.destroy();
						inherited?.child.unload();
						inherited?.host.remove();
					}
				}
			}
			return { families: familySources.size, declarations: checked, failures };
		} finally { plugin.unload(); }
	});
	assert.deepEqual(report, { families: 33, declarations: 43, failures: [] });
	console.log('Diagram styles passed: 33 families through Reading view and Live Editor, scoped styles for 27, authored configuration, and SVG/PNG export.');
}
