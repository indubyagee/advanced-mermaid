/** Match the renderer's default budget before any plugin preprocessing. */
export const MAX_DIAGRAM_SOURCE_LENGTH = 50_000;

export function checkDiagramSource(source: string): void {
	if (source.length > MAX_DIAGRAM_SOURCE_LENGTH) throw new Error('Diagram source exceeds 50,000 characters.');
}
