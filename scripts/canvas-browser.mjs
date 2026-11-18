import assert from 'node:assert/strict';

export async function runCanvasChecks(page) {
	const report = await page.evaluate(async () => {
		const parent = document.body.createDiv();
		const initial = new Set(fixture.saved.keys());
		const items = [];
		const render = source => {
			const item = fixture.diagram(source, undefined, parent, 'notes/nested/Canvas source.md');
			items.push(item);
			return item;
		};
		const button = (root, text) => [...root.querySelectorAll('button')].find(candidate => candidate.textContent === text);
		const find = async lookup => {
			for (let attempt = 0; attempt < 150; attempt++) {
				const value = lookup();
				if (value) return value;
				await new Promise(resolve => setTimeout(resolve, 10));
			}
			throw new Error('Canvas export did not reach the expected state: ' + parent.textContent);
		};
		const chooser = () => document.querySelector('.modal');
		const startSave = async item => {
			const action = await find(() => {
				const candidate = button(item.host, 'Save canvas');
				return candidate && !candidate.disabled && candidate;
			});
			action.click();
			return find(chooser);
		};
		try {
			const flowchart = render('graph LR\nA["Start"] -->|Next| B["Finish"]');
			const modal = await startSave(flowchart);
			const folder = modal.querySelector('input').value;
			const previewPath = [...modal.querySelectorAll('p')].find(p => p.textContent.startsWith('Save as: ')).textContent.slice(9);
			fixture.saved.set(previewPath, 'original canvas');
			button(modal, 'Save').click();
			const status = flowchart.host.querySelector('.advanced-mermaid-export-status');
			const path = await find(() => status.textContent.startsWith('Saved ') && status.textContent.slice(6));
			const savedData = JSON.parse(fixture.saved.get(path));
			button(flowchart.host, 'Open canvas').click();
			const opened = await find(() => fixture.opened.at(-1));

			const before = fixture.saved.size;
			const stale = await startSave(flowchart);
			flowchart.child.setInlineOwned(false, 'flowchart TB\nC["Updated"] --> D');
			button(stale, 'Save').click();
			const retry = await find(() => stale.querySelector('[role=status]').textContent.includes('diagram changed'));
			button(stale, 'Cancel').click();
			const cancelled = await startSave(flowchart);
			button(cancelled, 'Cancel').click();
			const cancelDidNotWrite = fixture.saved.size === before;

			const unsupported = render('sequenceDiagram\nA->>B: Hello');
			const invalid = render('%% advanced-mermaid-style:v1\n%% .pele { color: red; }\n%% advanced-mermaid-style:end\nflowchart TD\nA --> B');
			const empty = render('flowchart TD');
			button(empty.host, 'Save canvas').click();
			await find(() => empty.host.querySelector('.advanced-mermaid-export-status').textContent.includes('Add a node or group'));
			const emptyDidNotWrite = fixture.saved.size === before && !chooser();

			const agent = render('agentflow-beta LR\nA@{ shape: task, label: "Work" } --> B');
			await startSave(agent);
			items.pop().child.unload();
			return {
				folder, path, previewPath, opened, untouched: fixture.saved.get(previewPath) === 'original canvas',
				cards: savedData.nodes.map(node => node.text), edge: savedData.edges[0]?.label, retry, cancelDidNotWrite,
				unsupported: button(unsupported.host, 'Save canvas').hidden && !button(unsupported.host, 'Save SVG').disabled,
				invalid: invalid.host.querySelector('.advanced-mermaid-actions').hidden,
				emptyDidNotWrite, unloaded: !chooser() && fixture.saved.size === before,
			};
		} finally {
			for (const item of items) item.child.unload();
			for (const path of fixture.saved.keys()) if (!initial.has(path)) fixture.saved.delete(path);
			fixture.opened.length = 0;
			parent.remove();
		}
	});
	assert.equal(report.folder, 'notes/nested');
	assert.equal(report.path, report.previewPath.replace(/\.canvas$/, '-2.canvas'));
	assert.equal(report.opened, report.path);
	assert.deepEqual(report.cards, ['Start', 'Finish']);
	assert.equal(report.edge, 'Next');
	for (const key of ['untouched', 'retry', 'cancelDidNotWrite', 'unsupported', 'invalid', 'emptyDidNotWrite', 'unloaded']) {
		assert.equal(report[key], true, key);
	}
	console.log('Canvas export passed: save, open, collision handling, stale and invalid previews, cancellation, and unload.');
}
