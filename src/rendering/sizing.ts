import type { ResolvedDisplaySettings } from './overrides';

export interface Dimensions { width: number; height: number }
export interface DisplayBox extends Dimensions { containerWidth: number; portrait: boolean }

/** Fit only from intrinsic dimensions, so editing a limit never compounds scaling. */
export function fitDiagram(intrinsic: Dimensions, paneWidth: number, viewportHeight: number, rem: number, settings: ResolvedDisplaySettings, navigationSpace = 0, textWidth = paneWidth): DisplayBox {
	const portrait = intrinsic.height > intrinsic.width;
	const preset = settings.maxWidth === 'auto' ? (portrait ? 'none' : 'normal') : settings.maxWidth;
	const { normalRem, wideRem, maximumPercent } = settings.diagramWidths;
	const maximum = paneWidth * maximumPercent / 100;
	const columnWidth = Math.min(textWidth, paneWidth);
	const limits = { default: columnWidth, full: columnWidth, normal: Math.min(normalRem * rem, maximum), wide: Math.min(wideRem * rem, maximum), maximum, none: paneWidth };
	const containerWidth = Math.max(0, limits[preset]);
	const drawableWidth = Math.max(0, containerWidth - navigationSpace);
	const fill = settings.fillAvailable && preset !== 'default';
	let height = settings.maxHeight === 'auto' ? (portrait ? 'medium' : 'none') : settings.maxHeight;
	height = ({ short: '30vh', medium: '50vh', tall: '75vh' } as Record<string, string>)[height] ?? height;
	const limit = height === 'none' ? Infinity : Number.parseFloat(height) * (height.endsWith('vh') ? viewportHeight / 100 : height.endsWith('rem') ? rem : 1);
	const scale = Math.min(drawableWidth / intrinsic.width, limit / intrinsic.height, fill ? Infinity : 1);
	let width = intrinsic.width * scale;
	let fittedHeight = intrinsic.height * scale;
	if (!settings.maintainAspectRatio) {
		width = fill ? drawableWidth : Math.min(drawableWidth, intrinsic.width);
		fittedHeight = Number.isFinite(limit) ? (settings.fillAvailable ? limit : Math.min(limit, intrinsic.height)) : intrinsic.height * width / intrinsic.width;
	}
	return { containerWidth, width, height: fittedHeight, portrait };
}
