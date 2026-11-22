import assert from 'node:assert/strict';

const series = '#26a421';
const fallback = '#3756db';
const samples = [
	['GitGraph', 'gitGraph LR:\n commit id: "Started"\n branch review\n checkout review\n commit id: "Reviewed"', { git0: series }],
	['Mindmap', 'mindmap\n Root((Root))\n   First[First]\n     Child[Child]\n   Second[Second]', { cScale1: series }],
	['Timeline', 'timeline\n section Plan\n  2026 : Kickoff\n section Deliver\n  2027 : Launch', { cScale0: series }],
	['Radar', 'radar-beta\n axis A, B, C\n curve First{1,2,3}\n curve Second{2,1,3}', { cScale0: series }],
	['Treemap', 'treemap\n "Plan"\n   "Kickoff": 10\n "Deliver"\n   "Launch": 12', { cScale0: series }],
	['Pie', 'pie\n "One": 10\n "Two": 20\n "Three": 30', { pie1: series, pie2: 'not a color', pie3: '#a6caf880' }],
	['XY', 'xychart\n x-axis [A, B, C]\n bar [3,5,6]\n line [1,4,3]\n line [2,3,5]\n bar [3,1,2]', { xyChart: { plotColorPalette: series + ', #ad3168' } }],
	['Venn', 'venn-beta\n set A["Alpha"]: 10\n set B["Beta"]: 11\n set C["Gamma"]: 12\n union A,B: 2', { venn1: series, venn2: '#ad3168' }],
];

export async function runPelePaletteChecks(page) {
	const report = await page.evaluate(async ({ cases, series, fallback }) => {
		const result = [];
		const settings = fixture.normalizeSettings(null);
		const bothThemes = color => ({ light: color, dark: color });
		settings.style.global.colors.series1 = bothThemes(fallback);
		settings.style.global.colors.series2 = bothThemes(fallback);
		settings.style.global.colors.foregroundOnLight = bothThemes('#101010');
		settings.style.global.colors.foregroundOnDark = bothThemes('#f0f0f0');
		const paint = svg => [...svg.querySelectorAll('rect, path, circle, polygon, polyline, text, tspan')]
			.flatMap(element => {
				const style = getComputedStyle(element);
				return [style.fill, style.stroke];
			});
		for (const [name, body, variables] of cases) {
			const authored = '---\n' + JSON.stringify({ config: { themeVariables: variables } }) + '\n---\n' + body;
			const host = document.body.createDiv();
			host.style.width = '700px';
			const controller = new fixture.DiagramController(host, authored, () => settings, fixture.app, 'Palette.md');
			const defaults = fixture.diagram(body, settings);
			try {
				controller.load();
				const svg = host.querySelector('.advanced-mermaid-mount svg.pele');
				const defaultSvg = defaults.host.querySelector('svg.pele');
				const colors = paint(svg);
				const expected = 'rgb(38, 164, 33)';
				const snapshot = await controller.snapshot();
				const checks = {
					name,
					authored: colors.includes(expected) && !paint(defaultSvg).includes(expected),
					defaults: paint(defaultSvg).includes('rgb(55, 86, 219)'),
					svg: snapshot.svg.includes(expected) && !snapshot.svg.includes('--pele-series-'),
				};
				if (name === 'XY' || name === 'Venn') {
					checks.repeat = [series, '#ad3168', series, '#ad3168'].every((value, index) =>
						svg.style.getPropertyValue('--pele-series-' + (index + 1)).trim() === value);
				}
				if (name === 'Pie') {
					checks.invalidFallback = colors.includes('rgb(55, 86, 219)') && !svg.style.getPropertyValue('--pele-series-2');
					checks.alpha = colors.some(color => /^rgba\(166, 202, 248, 0\.5(?:0\d*)?\)$/.test(color));
					const contrast = fixture.diagram('---\nconfig:\n  themeVariables:\n    pie1: "#111111"\n    pie2: "#ffffee"\n---\npie\n"Dark": 20\n"Light": 10', settings);
					try {
						const labels = [...contrast.host.querySelectorAll('svg text')];
						const color = text => getComputedStyle(labels.find(label => label.textContent === text)).fill;
						checks.contrast = color('67%') === 'rgb(240, 240, 240)' && color('33%') === 'rgb(16, 16, 16)';
					} finally {
						contrast.child.unload();
						contrast.host.remove();
					}
					const blob = await fixture.createPng(snapshot, document, new AbortController().signal);
					const bitmap = await createImageBitmap(blob);
					try {
						const canvas = document.createElement('canvas');
						canvas.width = bitmap.width;
						canvas.height = bitmap.height;
						const context = canvas.getContext('2d');
						context.drawImage(bitmap, 0, 0);
						const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
						checks.png = pixels.some((value, index) => index % 4 === 0 &&
							value === 38 && pixels[index + 1] === 164 && pixels[index + 2] === 33 && pixels[index + 3] === 255);
					} finally { bitmap.close(); }
				}
				result.push(checks);
			} finally {
				controller.destroy();
				defaults.child.unload();
				defaults.host.remove();
				host.remove();
			}
		}
		const chartTypes = { Pie: 'pie', XY: 'xychart', Venn: 'venn' };
		const typePalettes = {
			pie: { pie1: '#df6021' },
			xychart: { xyChart: { plotColorPalette: '#df6021, #ad3168' } },
			venn: { venn1: '#df6021' },
		};
		const isDark = document.body.classList.contains('theme-dark');
		try {
			for (const [name, body, variables] of cases.filter(([name]) => Object.hasOwn(chartTypes, name))) {
				const category = chartTypes[name];
				const profile = {
					useGlobal: false,
					overrides: { colors: { series1: { light: '#af1843', dark: '#06a6af' } }, elements: {} },
					frontmatter: { enabled: false, yaml: JSON.stringify({ config: { themeVariables: typePalettes[category] } }) },
				};
				settings.style.diagrams[category] = profile;
				const hasColor = (source, expected) => {
					const entry = fixture.diagram(source, settings);
					try { return paint(entry.host.querySelector('svg.pele')).includes(expected); }
					finally { entry.child.unload(); entry.host.remove(); }
				};
				const checks = { name: name + ' scoped palette' };
				for (const [mode, color] of [['light', 'rgb(175, 24, 67)'], ['dark', 'rgb(6, 166, 175)']]) {
					document.body.classList.toggle('theme-dark', mode === 'dark');
					profile.frontmatter.enabled = false;
					checks[mode + ' scoped color'] = hasColor(body, color);
					profile.frontmatter.enabled = true;
					checks[mode + ' type frontmatter'] = hasColor(body, 'rgb(223, 96, 33)');
					const authored = '---\n' + JSON.stringify({ config: { themeVariables: variables } }) + '\n---\n' + body;
					checks[mode + ' authored color'] = hasColor(authored, 'rgb(38, 164, 33)');
				}
				delete settings.style.diagrams[category];
				result.push(checks);
			}
		} finally { document.body.classList.toggle('theme-dark', isDark); }
		return result;
	}, { cases: samples, series, fallback });
	for (const { name, ...checks } of report) {
		for (const [check, passed] of Object.entries(checks)) assert.equal(passed, true, name + ' ' + check);
	}
	console.log('Pele palettes passed: eight mappings, scoped and authored Pie/XY/Venn palettes in both themes, invalid values, alpha, and SVG/PNG paint.');
}
