const SVG_NS = 'http://www.w3.org/2000/svg';
let nextMaskId = 0;

/** Use Pele's title underlays to cut gaps in the edges behind the text. */
export function maskClusterTitleOverlaps(svg: SVGSVGElement): void {
	const titles = svg.querySelector(':scope > .pele-cluster-titles');
	if (!titles) return;
	const underlays = titles.querySelectorAll<SVGTextElement>('.pele-cluster-title > text[fill="none"][stroke]');
	const edges = svg.querySelector(':scope > .pele-edges');
	if (!underlays.length || !edges) return;

	const doc = svg.ownerDocument;
	const mask = doc.createElementNS(SVG_NS, 'mask');
	mask.id = `advanced-mermaid-cluster-title-mask-${++nextMaskId}`;
	mask.setAttribute('maskUnits', 'userSpaceOnUse');
	mask.setAttribute('mask-type', 'luminance');
	const visible = doc.createElementNS(SVG_NS, 'rect');
	visible.setAttribute('width', '100%');
	visible.setAttribute('height', '100%');
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
