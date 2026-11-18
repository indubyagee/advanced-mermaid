/** Return a vault-relative folder, refusing traversal before normalization. */
export function exportFolder(input: string): string {
	const folder = input.trim();
	if (!folder)
		return '';
	if (folder.startsWith('/') || /[\\:<>"|?*]/.test(folder) || [...folder].some(controlCharacter))
		throw new Error('Choose a folder inside this vault using forward slashes.');
	const parts = folder.replace(/\/+$/, '').split('/');
	if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part)))
		throw new Error('Choose a vault folder without empty, dot, or parent segments.');
	return parts.join('/');
}

export function exportBasename(sourcePath: string, suffix: string): string {
	const name = fileStem((sourcePath.split('/').pop() ?? '').replace(/\.md$/i, '')) || 'diagram';
	return `${name}-diagram-${suffix.replace(/[^a-z\d-]/gi, '').slice(0, 32) || '1'}`;
}

export function documentBasename(title: string, id: string): string {
	const stem = (value: string): string => {
		const firstLine = value.trim().split('\n', 1)[0]!.trim();
		return fileStem(firstLine.replace(/^[.\s]+/, '').replace(/\.md$/i, '').replace(/[#^[\]]/g, '-'));
	};
	return stem(title) || stem(id) || 'document';
}

function fileStem(value: string): string {
	const name = [...value.replace(/[<>:"/\\|?*]/g, '-')]
		.map(char => controlCharacter(char) ? '-' : char).slice(0, 80).join('').replace(/[. ]+$/g, '');
	return /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name) ? '' : name;
}

function controlCharacter(char: string): boolean {
	const code = char.charCodeAt(0);
	return code < 32 || (code >= 127 && code <= 159);
}

export interface ExportVault {
	adapter?: { exists(path: string, sensitive?: boolean): Promise<boolean> };
	getAbstractFileByPath(path: string): unknown;
	create(path: string, data: string): Promise<unknown>;
	createBinary(path: string, data: ArrayBuffer): Promise<unknown>;
}

export type ExportExtension = 'svg' | 'png' | 'canvas';
type ExportDestination = Pick<ExportVault, 'adapter' | 'getAbstractFileByPath'>;
const pendingPaths = new WeakMap<ExportDestination, Set<string>>();

/** Creation (never modification) protects existing files, including racing saves. */
export async function saveExport(
	vault: ExportVault,
	folder: string,
	basename: string,
	extension: ExportExtension,
	data: string | ArrayBuffer,
	current: () => boolean
): Promise<string> {
	const result = await createUniqueExport(vault, folder, basename, extension, current,
		path => typeof data === 'string' ? vault.create(path, data) : vault.createBinary(path, data));
	return result.path;
}

export async function createUniqueExport<T>(
	vault: ExportDestination,
	folder: string,
	basename: string,
	extension: ExportExtension | 'md',
	current: () => boolean,
	create: (path: string) => Promise<T>,
): Promise<{ path: string; file: T }> {
	const safeFolder = exportFolder(folder);
	let pending = pendingPaths.get(vault);
	if (!pending) {
		pending = new Set();
		pendingPaths.set(vault, pending);
	}
	const attempts = extension === 'md' ? 1_000 : 100;
	for (let attempt = 0; attempt < attempts; attempt++) {
		const filename = `${basename}${attempt ? `-${attempt + 1}` : ''}.${extension}`;
		const path = safeFolder ? `${safeFolder}/${filename}` : filename;
		const key = path.normalize('NFC').toLowerCase();
		if (pending.has(key) || vault.getAbstractFileByPath(path)) continue;
		// Vault.create checks for an existing file before its asynchronous write.
		pending.add(key);
		try {
			if (await vault.adapter?.exists(path, false)) continue;
			if (!current()) throw new Error('The diagram changed. Export it again.');
			try {
				return { path, file: await create(path) };
			} catch (error) {
				if (!vault.getAbstractFileByPath(path) && !await vault.adapter?.exists(path, false)) throw error;
			}
		} finally {
			pending.delete(key);
		}
	}
	throw new Error('Could not find an unused filename. Choose another folder.');
}
