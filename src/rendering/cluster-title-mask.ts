const SVG_NS = 'http://www.w3.org/2000/svg';
let nextMaskId = 0;

/** Use Pele's title underlays to cut gaps in the edges behind the text. */
export function maskClusterTitleOverlaps(svg: SVGSVGElement): void {
	const titles = svg.querySelector(':scope > .pele-cluster-titles');
	if (!titles) return;
	const underlays = titles.querySelectorAll<SVGTextElement>('.pele-cluster-title > text[fill="none"][stroke]');
	const edges = svg.querySelector(':scope > .pele-edges');
	const width = svg.getAttribute('width');
	const height = svg.getAttribute('height');
	if (!underlays.length || !edges || !width || !height) return;

	const doc = svg.ownerDocument;
	const mask = doc.createElementNS(SVG_NS, 'mask');
	mask.id = `advanced-mermaid-cluster-title-mask-${++nextMaskId}`;
	mask.setAttribute('maskUnits', 'userSpaceOnUse');
	mask.setAttribute('mask-type', 'luminance');
	// Pele zoom changes the viewBox, so percentage bounds would shrink with it.
	mask.setAttribute('x', '0');
	mask.setAttribute('y', '0');
	mask.setAttribute('width', width);
	mask.setAttribute('height', height);
	const visible = doc.createElementNS(SVG_NS, 'rect');
	visible.setAttribute('width', width);
	visible.setAttribute('height', height);
	visible.setAttribute('fill', 'white');
	mask.append(visible);
	underlays.forEach(underlay => {
		underlay.setAttribute('fill', 'black');
		underlay.setAttribute('stroke', 'black');
		mask.append(underlay);
	});
	svg.append(mask);
	edges.setAttribute('mask', `url(#${mask.id})`);
}
