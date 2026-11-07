import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeSettings, labelPixels, validThemeValue } from '../src/settings';
import { fitDiagram } from '../src/rendering/sizing';
import { resolveDisplay } from '../src/rendering/overrides';

void test('orientation defaults enlarge proportionally and square uses landscape limits', () => {
	assert.deepEqual(fitDiagram({ width: 200, height: 100 }, 1200, 800, 16, { ...DEFAULT_SETTINGS }), { width: 700, height: 350, containerWidth: 700, portrait: false });
	assert.equal(fitDiagram({ width: 100, height: 400 }, 1200, 800, 16, { ...DEFAULT_SETTINGS }).height, 400);
	assert.equal(fitDiagram({ width: 100, height: 100 }, 1200, 800, 16, { ...DEFAULT_SETTINGS }).width, 700);
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
	const settings = { ...DEFAULT_SETTINGS, maintainAspectRatio: false, maxHeight: '10rem' };
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
