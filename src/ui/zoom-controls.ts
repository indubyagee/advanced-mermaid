import { setIcon, type Component } from 'obsidian';
import type { Mounted } from 'pele';

type Zoom = NonNullable<Mounted['zoom']>;
const ZOOM_STEP = 1.25 ** 2;

export function zoomLimit(host: HTMLElement): number {
	// A small diagram may be enlarged past Pele's default absolute cap.
	const intrinsic = Number(host.querySelector('svg.pele')?.getAttribute('width'));
	const fittedWidth = Number.parseFloat(host.style.getPropertyValue('--advanced-mermaid-fitted-width'));
	return Math.max(3, intrinsic > 0 ? 8 * (fittedWidth || intrinsic) / intrinsic : 3);
}

export function createZoomControls(frame: HTMLElement, host: HTMLElement, owner: Component, currentZoom: () => Zoom | undefined): () => void {
	const rail = frame.createDiv({ cls: 'pele pele-zoom', attr: { role: 'group', 'aria-label': 'Diagram zoom' } });
	rail.remove();
	for (const event of ['click', 'dblclick', 'pointerdown'] as const) {
		owner.registerDomEvent(rail, event, evt => evt.stopPropagation());
	}
	const addButton = (name: string, icon: string, label: string, action: (zoom: Zoom) => void): HTMLButtonElement => {
		const button = rail.createEl('button', {
			cls: 'pele-zoom-' + name,
			attr: { type: 'button', 'aria-label': label },
			title: label,
		});
		setIcon(button, icon);
		owner.registerDomEvent(button, 'click', () => {
			const zoom = currentZoom();
			if (!zoom) return;
			action(zoom);
			sync();
		});
		return button;
	};
	const zoomIn = addButton('in', 'plus', 'Zoom In', zoom => zoom.zoomBy(ZOOM_STEP));
	const zoomOut = addButton('out', 'minus', 'Zoom Out', zoom => zoom.zoomBy(1 / ZOOM_STEP));
	addButton('reset', 'rotate-ccw', 'Reset Zoom', zoom => zoom.reset());

	function sync(): void {
		const zoom = currentZoom();
		if (!zoom) { rail.remove(); return; }
		if (rail.parentElement !== frame) frame.append(rail);
		const scale = zoom.scale;
		zoomIn.disabled = scale >= Math.max(zoom.fit, zoomLimit(host)) * 0.999;
		zoomOut.disabled = scale <= zoom.fit;
	}

	// Pele also changes the viewBox in response to wheel, pinch, and key input.
	const observer = new host.ownerDocument.defaultView!.MutationObserver(sync);
	observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['viewBox'] });
	owner.register(() => observer.disconnect());
	return sync;
}
