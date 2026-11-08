import type { SvgSnapshot } from './svg';

export const PNG_SCALE = 2;
// Conservative product budgets, not a claim about any particular device's limit.
export const MAX_PNG_SIDE = 8192;
export const MAX_PNG_PIXELS = 16_000_000;

export function pngDimensions(width: number, height: number): { width: number; height: number } {
	const scaledWidth = Math.ceil(width * PNG_SCALE);
	const scaledHeight = Math.ceil(height * PNG_SCALE);
	if (!(scaledWidth > 0 && scaledHeight > 0) || !Number.isFinite(scaledWidth * scaledHeight)
		|| scaledWidth > MAX_PNG_SIDE || scaledHeight > MAX_PNG_SIDE || scaledWidth * scaledHeight > MAX_PNG_PIXELS) {
		throw new Error('This diagram is too large for PNG export (8192 px per side, 16 million pixels). Save SVG instead.');
	}
	return { width: scaledWidth, height: scaledHeight };
}

export async function createPng(snapshot: SvgSnapshot, doc: Document, signal: AbortSignal): Promise<Blob> {
	const view = doc.defaultView;
	if (!view) throw new Error('The diagram window is unavailable.');
	const size = pngDimensions(snapshot.width, snapshot.height);
	// Create a detached element in its owning document, including pop-outs.
	const canvas = doc.createElement('canvas');
	const image = new view.Image();
	const url = view.URL.createObjectURL(new view.Blob([snapshot.svg], { type: 'image/svg+xml' }));
	let abort: (() => void) | undefined;
	let timer: number | undefined;
	try {
		if (signal.aborted) throw new Error('The export was cancelled.');
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error('Could not decode the diagram for PNG export.'));
			abort = () => reject(new Error('The export was cancelled.'));
			signal.addEventListener('abort', abort, { once: true });
			timer = view.setTimeout(() => reject(new Error('PNG decoding timed out. Save SVG instead.')), 15000);
			image.src = url;
		});
		if (signal.aborted) throw new Error('The export was cancelled.');
		canvas.width = size.width;
		canvas.height = size.height;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('PNG export is unavailable in this window.');
		context.drawImage(image, 0, 0, size.width, size.height);
		const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => {
			if (value) resolve(value);
			else reject(new Error('Could not encode the PNG. Save SVG instead.'));
		}, 'image/png'));
		if (signal.aborted) throw new Error('The export was cancelled.');
		return blob;
	} finally {
		if (abort) signal.removeEventListener('abort', abort);
		view.clearTimeout(timer);
		image.onload = null;
		image.onerror = null;
		image.src = '';
		view.URL.revokeObjectURL(url);
		canvas.width = canvas.height = 0;
	}
}
