/** Return a vault-relative folder, refusing traversal before normalization. */
export function exportFolder(input: string): string {
	const folder = input.trim();
	if (!folder) return '';
	if (folder.startsWith('/') || /[\\:<>"|?*]/.test(folder) || [...folder].some(controlCharacter)) throw new Error('Choose a folder inside this vault using forward slashes.');
	const parts = folder.replace(/\/+$/, '').split('/');
	if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) throw new Error('Choose a vault folder without empty, dot, or parent segments.');
	return parts.join('/');
}

export function exportBasename(sourcePath: string, suffix: string): string {
	let name = (sourcePath.split('/').pop() ?? '').replace(/\.md$/i, '')
		.replace(/[<>:"/\\|?*]/g, '-');
	name = [...name].map(char => controlCharacter(char) ? '-' : char).slice(0, 80).join('').replace(/[. ]+$/g, '');
	if (!name || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) name = 'diagram';
	return `${name}-diagram-${suffix.replace(/[^a-z\d-]/gi, '').slice(0, 32) || '1'}`;
}

function controlCharacter(char: string): boolean {
	const code = char.charCodeAt(0);
	return code < 32 || (code >= 127 && code <= 159);
}

export interface ExportVault {
	getAbstractFileByPath(path: string): unknown;
	create(path: string, data: string): Promise<unknown>;
	createBinary(path: string, data: ArrayBuffer): Promise<unknown>;
}

/** Creation (never modification) protects existing files, including racing saves. */
export async function saveExport(vault: ExportVault, folder: string, basename: string, extension: 'svg' | 'png', data: string | ArrayBuffer, current: () => boolean): Promise<string> {
	const safeFolder = exportFolder(folder);
	for (let attempt = 0; attempt < 100; attempt++) {
		const filename = `${basename}${attempt ? `-${attempt + 1}` : ''}.${extension}`;
		const path = safeFolder ? `${safeFolder}/${filename}` : filename;
		if (vault.getAbstractFileByPath(path)) continue;
		if (!current()) throw new Error('The diagram changed. Export it again.');
		try {
			if (typeof data === 'string') await vault.create(path, data);
			else await vault.createBinary(path, data);
			return path;
		} catch (error) {
			if (!vault.getAbstractFileByPath(path)) throw error;
		}
	}
	throw new Error('Could not find an unused filename. Choose another folder.');
}
