import assert from 'node:assert/strict';

export async function runSubgraphTitleChecks(page) {
	const reports = await page.evaluate(async () => {
		const source = `flowchart TD
			Start -->|label| ParentNode
			subgraph Parent["Parent title"]
			  ParentNode -->|label| InnerNode
			  subgraph Inner["Layer 2 title"]
			    InnerNode["In group<br/>second line"]
			  end
			  subgraph Clear["Uncrossed title"]
			    Other["Separate"]
			  end
			end
			Start -->|label| SingleNode
			subgraph Single["Standalone title"]
			  SingleNode["In group<br/>second line"]
			end`;
		const reading = fixture.diagram(source);
		const settings = fixture.normalizeSettings(null);
		const inline = fixture.createInlineExtension(fixture.app, () => settings);
		const language = new fixture.Language(fixture.defineLanguageFacet(), fixture.markdownParser);
		const host = document.body.createDiv();
		const view = new fixture.EditorView({ parent: host, state: fixture.EditorState.create({
			doc: `Before\n\n\`\`\`mermaid\n${source}\n\`\`\`\n\nAfter`, extensions: [language, fixture.editorInfoField, fixture.editorLivePreviewField, inline.extension],
		}) });
		const wait = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const maskForEdges = svg => {
			const mask = svg.querySelector('.pele-edges').getAttribute('mask')?.match(/^url\(#([\w-]+)\)$/)?.[1];
			return svg.querySelector(`mask[id="${mask}"]`);
		};
		const inspect = (name, svg) => {
			const crossing = [...svg.querySelectorAll('.pele-cluster-title > .pele-cluster-label')].map(text => text.textContent).sort();
			const clear = svg.querySelector('.pele-cluster[data-id="Clear"] > .pele-cluster-label')?.textContent;
			const outlines = [...svg.querySelectorAll('.pele-cluster-title > text')].filter(text => getComputedStyle(text).stroke !== 'none').length;
			const edgeCount = svg.querySelectorAll('.pele-edges .pele-edge').length;
			return { name, crossing, clear, outlines, edgeCount, mask: maskForEdges(svg)?.id };
		};
		const chooseMode = label => [...host.querySelectorAll('.advanced-mermaid-editor-mode button')].find(button => button.textContent === label).click();
		try {
			const results = [];
			for (const theme of ['light', 'dark']) {
				document.body.classList.toggle('theme-dark', theme === 'dark');
				chooseMode('Rendered view');
				await wait();
				results.push(inspect(`Rendered view (${theme})`, host.querySelector('.advanced-mermaid-rendered-preview svg.pele')));
				results.push(inspect(`Reading view (${theme})`, reading.host.querySelector('svg.pele')));
				chooseMode('Live editor');
				await wait();
				results.push(inspect(`Live Editor (${theme})`, host.querySelector('.advanced-mermaid-editor-render svg.pele')));
			}
			const liveSvg = host.querySelector('.advanced-mermaid-editor-render svg.pele');
			const fittedView = liveSvg.getAttribute('viewBox');
			const bounds = () => {
				const { width, height } = maskForEdges(liveSvg).querySelector('rect').getBBox();
				return [width, height];
			};
			const fittedMask = bounds();
			host.querySelector('.pele-zoom-in').click();
			host.querySelector('.pele-zoom-in').click();
			const zoomedView = liveSvg.getAttribute('viewBox');
			const zoomedMask = bounds();
			liveSvg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
			const pannedMask = bounds();
			[...host.querySelectorAll('[role="tab"]')].find(tab => tab.textContent === 'SVG').click();
			await wait();
			const svgSource = host.querySelector('.advanced-mermaid-svg-source').value;
			const exported = new DOMParser().parseFromString(svgSource, 'image/svg+xml').documentElement;
			const exportedMask = maskForEdges(exported);
			const nested = fixture.EditorView.findFromDOM(fixture.sourceRoot(host).querySelector('.cm-editor'));
			nested.dispatch({ changes: { from: 0, to: nested.state.doc.length, insert: 'Invalid diagram' } });
			[...host.querySelectorAll('button')].find(button => button.textContent === 'Render now').click();
			results.push(inspect('Last valid Live Editor preview', host.querySelector('.advanced-mermaid-stale svg.pele')));
			return { results, fittedView, zoomedView, fittedMask, zoomedMask, pannedMask,
				exportedUnderlays: exportedMask?.querySelectorAll('text').length };
		} finally {
			document.body.classList.remove('theme-dark');
			view.destroy(); inline.destroy(); host.remove();
			reading.child.unload(); reading.host.remove();
		}
	});
	for (const { name, crossing, clear, outlines, edgeCount, mask } of reports.results) {
		assert.deepEqual(crossing, ['Layer 2 title', 'Standalone title'], name);
		assert.equal(clear, 'Uncrossed title', name);
		assert.equal(outlines, 0, `Subgraph titles have no accent outline in ${name}`);
		assert.equal(edgeCount, 3, name);
		assert.ok(mask, `Crossing edges are masked behind title text in ${name}`);
	}
	assert.notEqual(reports.results[0].mask, reports.results[1].mask, 'Each diagram has its own mask');
	assert.notEqual(reports.zoomedView, reports.fittedView);
	assert.deepEqual(reports.zoomedMask, reports.fittedMask, 'The edge mask keeps its original bounds when zooming');
	assert.deepEqual(reports.pannedMask, reports.fittedMask, 'The edge mask also covers panned edges');
	assert.equal(reports.exportedUnderlays, 2, 'The SVG output includes the mask for each crossed title');
	console.log('Subgraph titles passed in both themes in Rendered view, Reading view, and the Live Editor, including its last valid preview.');
}
