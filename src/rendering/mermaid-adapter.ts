import { loadMermaid } from 'obsidian';
import { safeMermaidSource } from './mermaid-source';

interface NativeApi { render(id: string, source: string, host?: HTMLElement): Promise<{ svg: string }>; mermaidAPI?: { getConfig?(): unknown } }
let serial = Promise.resolve();
let nextId = 0;
/** Serialize the host's own per-diagram render path. Never initialize it or write defaults. */
export async function renderNativeMermaid(source: string, host: HTMLElement, current: () => boolean): Promise<void> {
	const safe = safeMermaidSource(source);
	const operation = serial.then(async () => {
		const loaded: unknown = await loadMermaid();
		if (!loaded || typeof loaded !== 'object' || !('render' in loaded) || typeof loaded.render !== 'function') throw new Error('The host does not expose the native Mermaid render API.');
		if (!current()) return;
		const api = loaded as NativeApi;
		if (typeof api.mermaidAPI?.getConfig !== 'function') throw new Error('Native comparison is unavailable: this host cannot expose its renderer configuration for offline checks.');
		const id = 'advanced-mermaid-native-' + (++nextId);
		const temporary = host.ownerDocument.createElement('div'); temporary.id = id + '-host'; host.append(temporary);
		try {
			// Preserve the host configuration. The preflight admits only plain text
			// labels and structural syntax, so HTML/image/link/config syntax cannot
			// cause requests during layout, even before SVG resource validation.
			const config = JSON.stringify(api.mermaidAPI.getConfig());
			if (/url\s*\(|@import|https?:|data:/i.test(config)) throw new Error('Native comparison is unavailable with resource-bearing host configuration.');
			const result = await api.render(id, safe, temporary);
			if (!current()) return;
			const parsed = new host.ownerDocument.defaultView!.DOMParser().parseFromString(result.svg, 'image/svg+xml');
			const unsupported = parsed.querySelector('parsererror,script,image,iframe,a,link,object,embed');
			if (unsupported) throw new Error('Native output contains unsupported resources: ' + unsupported.localName);
			for (const element of Array.from(parsed.querySelectorAll('*'))) for (const attribute of Array.from(element.attributes)) {
				if (attribute.name.startsWith('on') || attribute.localName === 'href') throw new Error('Native output contains an external reference.');
				for (const reference of attribute.value.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) if (!reference[1]?.startsWith('#')) throw new Error('Native output contains an external reference.');
			}
			host.replaceChildren(host.ownerDocument.importNode(parsed.documentElement, true));
		} finally { temporary.remove(); host.ownerDocument.getElementById('d' + id)?.remove(); }
	});
	serial = operation.catch(() => {});
	return operation;
}
