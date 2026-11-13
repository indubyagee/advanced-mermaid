import type { App } from 'obsidian';
import { DIAGRAM_WIDTH_RANGES, type DiagramWidths } from '../display-settings';
import { boundedNumber, isStyleRecord } from '../styles/validate';

const MINIMAL_ID = 'obsidian-minimal-settings';
// Obsidian's plugin registry is not exposed in the public App typings.
type AppWithPlugins = App & { plugins?: {
	plugins?: Record<string, { settings?: unknown } | undefined>;
} };

export function minimalEnabled(app: App): boolean {
	return !!(app as AppWithPlugins).plugins?.plugins?.[MINIMAL_ID];
}

function parseWidths(value: unknown): DiagramWidths {
	const data = isStyleRecord(value) ? value : {};
	const width = (key: keyof DiagramWidths, setting: string): number => {
		const { min, max, fallback } = DIAGRAM_WIDTH_RANGES[key];
		const candidate = data[setting];
		return boundedNumber(candidate, min, max) ? candidate : fallback;
	};
	return { normalRem: width('normalRem', 'lineWidth'), wideRem: width('wideRem', 'lineWidthWide'), maximumPercent: width('maximumPercent', 'maxWidth') };
}

export function minimalThemeWidths(app: App): DiagramWidths | undefined {
	const plugin = (app as AppWithPlugins).plugins?.plugins?.[MINIMAL_ID];
	return plugin ? parseWidths(plugin.settings) : undefined;
}
