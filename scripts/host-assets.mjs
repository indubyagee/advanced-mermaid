import { readFile } from 'node:fs/promises';

/** Host assets are optional and explicitly selected by the test operator. */
export async function readHostArchive() {
	const archive = process.env.ADVANCED_MERMAID_OBSIDIAN_ASAR;
	return archive ? readFile(archive) : undefined;
}
