interface DocumentEnvironment {
	refreshers: Set<() => void>;
	readonly scheduled: boolean;
	schedule(): void;
	dispose(): void;
}

const environments = new Map<Document, DocumentEnvironment>();

export function scheduleDiagramEnvironmentRefresh(): void {
	for (const environment of environments.values()) environment.schedule();
}

export function hasPendingDiagramEnvironmentRefresh(doc: Document): boolean {
	return environments.get(doc)?.scheduled === true;
}

function documentEnvironment(doc: Document): DocumentEnvironment {
	const existing = environments.get(doc);
	if (existing) return existing;
	const view = doc.defaultView!;
	const refreshers = new Set<() => void>();
	let frame: number | undefined;
	const schedule = (): void => {
		if (frame !== undefined || refreshers.size === 0) return;
		frame = view.requestAnimationFrame(() => {
			frame = undefined;
			for (const refresh of refreshers) refresh();
		});
	};
	// Minimal Theme Settings publishes vault-wide layout changes in the main window.
	const observer = new view.MutationObserver(doc === document ? scheduleDiagramEnvironmentRefresh : schedule);
	observer.observe(doc.body, { attributes: true, attributeFilter: ['class', 'style'] });
	const environment = {
		refreshers, schedule,
		get scheduled() { return frame !== undefined; },
		dispose() {
			observer.disconnect();
			if (frame !== undefined) view.cancelAnimationFrame(frame);
			environments.delete(doc);
		},
	};
	environments.set(doc, environment);
	return environment;
}

function subscribe(doc: Document, refresh: () => void): () => void {
	const main = documentEnvironment(document);
	const environment = documentEnvironment(doc);
	environment.refreshers.add(refresh);
	return () => {
		environment.refreshers.delete(refresh);
		if (doc !== document && environment.refreshers.size === 0) environment.dispose();
		if (environments.size === 1 && main.refreshers.size === 0) main.dispose();
	};
}

export function observeDiagramEnvironment(element: HTMLElement, refresh: () => void): () => void {
	let unsubscribe = subscribe(element.ownerDocument, refresh);
	const stopMigration = element.onWindowMigrated(() => {
		unsubscribe();
		unsubscribe = subscribe(element.ownerDocument, refresh);
		refresh();
	});
	return () => { stopMigration(); unsubscribe(); };
}
