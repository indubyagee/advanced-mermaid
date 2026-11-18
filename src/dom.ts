/** Create an unattached element in the document that owns its editor or export. */
export function createDetachedEl<K extends keyof HTMLElementTagNameMap>(
	doc: Document, tag: K, options?: DomElementInfo,
): HTMLElementTagNameMap[K] {
	const fragment = createFragment();
	const local = fragment.ownerDocument === doc ? fragment : doc.importNode(fragment, false);
	const element = local.createEl(tag, options);
	element.remove();
	return element;
}
