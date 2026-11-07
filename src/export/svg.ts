import type { RenderResult } from 'pele';

export interface SvgSnapshot {
	svg: string;
	width: number;
	height: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const preparations = new WeakMap<HTMLElement, (svg: SVGSVGElement) => void>();

/** A controller applies the same local variables to its live SVG and export clone. */
export function registerSvgPreparation(container: HTMLElement, prepare: (svg: SVGSVGElement) => void): () => void {
	preparations.set(container, prepare);
	return () => { if (preparations.get(container) === prepare) preparations.delete(container); };
}
const VISUAL_PROPERTIES = [
	'color', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
	'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap',
	'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'font-family', 'font-size',
	'font-weight', 'font-style', 'font-variant', 'letter-spacing', 'word-spacing',
	'text-anchor', 'dominant-baseline', 'alignment-baseline', 'baseline-shift',
	'text-decoration', 'paint-order', 'vector-effect', 'rx', 'ry', 'r',
	'clip-path', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end',
	'visibility', 'display', 'white-space', 'text-transform', 'direction',
];

/** Restore local fragment references expanded to absolute URLs by computed styles. */
function localReferences(value: string): string {
	return value.replace(/url\(["']?([^"')]+)["']?\)/g, (_match: string, target: string) => {
		const hash = target.indexOf('#');
		if (hash < 0) throw new Error('The diagram contains an external rendering resource.');
		return `url(${target.slice(hash)})`;
	});
}

/** Freeze an unzoomed render in its containing document, then remove the host. */
export async function createSvgSnapshot(result: RenderResult, container: HTMLElement, current: () => boolean): Promise<SvgSnapshot> {
	const doc = container.ownerDocument;
	const view = doc.defaultView;
	if (!view) throw new Error('The diagram window is unavailable.');
	if (!Number.isFinite(result.width) || !Number.isFinite(result.height) || result.width <= 0 || result.height <= 0) {
		throw new Error('The diagram has invalid export dimensions.');
	}
	await doc.fonts.ready;
	if (!current()) throw new Error('The diagram changed. Export it again.');
	const parsed = new view.DOMParser().parseFromString(result.svg, 'image/svg+xml');
	if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') throw new Error('The rendered SVG is invalid.');
	const svg = doc.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
	if (svg.querySelector('script, image, foreignObject, style, iframe')) throw new Error('The SVG contains unsupported rendering resources.');
	preparations.get(container)?.(svg);
	const holder = container.createDiv({ cls: 'advanced-mermaid-snapshot advanced-mermaid-mount' });
	holder.setAttribute('aria-hidden', 'true');
	holder.style.setProperty('width', `${result.width}px`);
	holder.append(svg);
	container.append(holder);
	try {
		svg.setAttribute('width', String(result.width));
		svg.setAttribute('height', String(result.height));
		svg.style.setProperty('width', `${result.width}px`);
		svg.style.setProperty('height', `${result.height}px`);
		// White underlay makes even an alpha custom background opaque.
		for (const fill of ['#ffffff', 'var(--pele-bg,#ffffff)'].reverse()) {
			const background = doc.createElementNS(SVG_NS, 'rect');
			background.setAttribute('width', String(result.width));
			background.setAttribute('height', String(result.height));
			background.setAttribute('fill', fill);
			svg.prepend(background);
		}
		const elements = [svg, ...Array.from(svg.querySelectorAll<SVGElement>('*'))];
		// Read all computed styles before changing inheritance on any element.
		const styles = elements.map(element => {
			const computed = view.getComputedStyle(element);
			return VISUAL_PROPERTIES.map(property => [property, localReferences(computed.getPropertyValue(property))] as const);
		});
		for (let index = 0; index < elements.length; index++) {
			const element = elements[index]!;
			for (const attribute of Array.from(element.attributes)) {
				if (attribute.name.startsWith('on')) throw new Error('The SVG contains an event handler.');
				if ((attribute.localName === 'href') && element.localName !== 'a' && !attribute.value.startsWith('#')) throw new Error('The SVG contains an external rendering resource.');
				if (attribute.name !== 'style' && attribute.value.includes('var(')) element.removeAttribute(attribute.name);
			}
			element.removeAttribute('style');
			for (const [property, value] of styles[index]!) if (value) element.style.setProperty(property, value);
		}
		// Display sizing belongs to the viewport; exported dimensions are intrinsic.
		svg.style.removeProperty('display');
		if (!current()) throw new Error('The diagram changed. Export it again.');
		const serialized = new view.XMLSerializer().serializeToString(svg);
		if (serialized.includes('var(')) throw new Error('Some diagram styles could not be resolved for export.');
		return { svg: serialized, width: result.width, height: result.height };
	} finally { holder.remove(); }
}
