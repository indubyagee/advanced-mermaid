import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeSettings, labelPixels, validThemeValue } from '../src/settings';
import { fitDiagram } from '../src/rendering/sizing';
import { resolveDisplay } from '../src/rendering/overrides';

void test('default uses native size while Full can fill the text column inside a wider pane', () => {
	const settings = { ...DEFAULT_SETTINGS, fillAvailable: true };
	assert.deepEqual(fitDiagram({ width: 200, height: 100 }, 1200, 800, 16, settings, 0, 600), { width: 200, height: 100, containerWidth: 600, portrait: false });
	assert.deepEqual(fitDiagram({ width: 1000, height: 500 }, 1200, 800, 16, settings, 40, 600), { width: 560, height: 280, containerWidth: 600, portrait: false });
	assert.deepEqual(fitDiagram({ width: 200, height: 100 }, 1200, 800, 16, { ...settings, maxWidth: 'full' }, 0, 600), { width: 600, height: 300, containerWidth: 600, portrait: false });
	assert.equal(fitDiagram({ width: 100, height: 500 }, 1200, 800, 16, DEFAULT_SETTINGS).height, 400);
});

void test('width presets use configured rem and pane percentages before reserving the zoom rail', () => {
	const intrinsic = { width: 200, height: 100 };
	const settings = { ...DEFAULT_SETTINGS, maxWidth: 'normal', fillAvailable: true, diagramWidths: { normalRem: 30, wideRem: 70, maximumPercent: 80 } } as const;
	for (const [maxWidth, wide, narrow] of [['normal', 480, 240], ['wide', 960, 240], ['maximum', 960, 240], ['none', 1200, 300]] as const) {
		for (const [paneWidth, expected] of [[1200, wide], [300, narrow]] as const) {
			const fitted = fitDiagram(intrinsic, paneWidth, 800, 16, { ...settings, maxWidth }, 40);
			assert.equal(fitted.containerWidth, expected, maxWidth);
			assert.ok(Math.abs(fitted.width - (expected - 40)) < 0.001, maxWidth);
		}
	}
	assert.equal(fitDiagram(intrinsic, 1200, 800, 20, settings).containerWidth, 600);
});

void test('authored orientation and full pane directives override the saved width', () => {
	const settings = { ...DEFAULT_SETTINGS, maxWidth: 'wide' } as const;
	const auto = resolveDisplay('%% advanced-mermaid: max-width=auto fill=true\nflowchart LR', settings);
	assert.equal(fitDiagram({ width: 100, height: 100 }, 1200, 800, 16, auto).width, 640);
	assert.deepEqual(fitDiagram({ width: 100, height: 400 }, 1200, 800, 16, auto), { width: 100, height: 400, containerWidth: 1200, portrait: true });
	const full = resolveDisplay('%% advanced-mermaid: max-width=none\nflowchart LR', settings);
	assert.equal(fitDiagram({ width: 100, height: 100 }, 1200, 800, 16, full).containerWidth, 1200);
	assert.equal(settings.maxWidth, 'wide');
});

void test('limits are monotonic, pane-bounded, and independent of editing history', () => {
	for (const intrinsic of [{ width: 700, height: 64 }, { width: 64, height: 700 }]) {
		let previous = 0;
		for (const height of ['1vh', '2vh', '4vh', '5vh', '10vh', '25vh', '50vh', '100vh', 'none']) {
			const fitted = fitDiagram(intrinsic, 300, 800, 16, { ...DEFAULT_SETTINGS, maxHeight: height });
			assert.ok(fitted.height >= previous);
			assert.ok(fitted.width <= 300);
			assert.ok(Math.abs(fitted.width / fitted.height - intrinsic.width / intrinsic.height) < 0.0001);
			previous = fitted.height;
		}
		const settings = { ...DEFAULT_SETTINGS, maxHeight: '4vh' };
		assert.deepEqual(fitDiagram(intrinsic, 300, 800, 16, settings), fitDiagram(intrinsic, 300, 800, 16, { ...settings }));
	}
});

void test('legacy settings retain height, text color, and no-enlargement after round trip', () => {
	const settings = normalizeSettings({ alignment: 'right', maxHeight: 'none', theme: { foreground: '#602020' } });
	assert.equal(settings.maxHeight, 'none');
	assert.equal(settings.fillAvailable, false);
	assert.deepEqual(settings.theme, { text: '#602020' });
	assert.deepEqual(normalizeSettings(settings), settings);
	assert.equal(fitDiagram({ width: 200, height: 100 }, 1000, 800, 16, settings).width, 200);
	assert.equal(normalizeSettings({ theme: { foreground: '#111', text: '#222' } }).theme.text, '#222');
});

void test('independent fitting fills bounded dimensions and unlimited height stays proportional', () => {
	const settings = { ...DEFAULT_SETTINGS, maintainAspectRatio: false, maxHeight: '10rem', maxWidth: 'none', fillAvailable: true } as const;
	assert.equal(fitDiagram({ width: 200, height: 100 }, 300, 800, 20, settings).height, 200);
	assert.equal(fitDiagram({ width: 200, height: 100 }, 300, 800, 20, settings).width, 300);
	assert.equal(fitDiagram({ width: 200, height: 100 }, 300, 800, 20, { ...settings, maxHeight: 'none' }).height, 150);
});

void test('new directives retain source locations and explicit values override orientation', () => {
	const settings = resolveDisplay('%% advanced-mermaid: max-width=wide max-height=tall aspect-ratio=false fill=false\nflowchart LR\n A-->B', { ...DEFAULT_SETTINGS });
	assert.equal(settings.maxWidth, 'wide'); assert.equal(settings.maxHeight, 'tall');
	assert.equal(settings.maintainAspectRatio, false); assert.equal(settings.fillAvailable, false);
	for (const key of ['max-width=bad', 'max-height=zero', 'aspect-ratio=yes', 'fill=1']) assert.throws(() => resolveDisplay(`%% advanced-mermaid: ${key}\nflowchart LR`, { ...DEFAULT_SETTINGS }));
});

void test('measured label sizes and stroke widths have bounded numeric validation', () => {
	assert.equal(labelPixels('12pt'), 16);
	for (const value of ['0px', '129px', 'var(--x)', '1em']) assert.equal(labelPixels(value), undefined);
	assert.ok(validThemeValue('edgeWidth', '0px'));
	for (const value of ['-1px', '21px', 'url(x)']) assert.ok(!validThemeValue('edgeWidth', value));
});
