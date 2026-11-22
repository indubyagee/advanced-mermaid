import { test } from 'node:test';
import assert from 'node:assert/strict';
import { win32 } from 'node:path';
import { exportBasename, exportFolder, saveExport, type ExportVault } from '../src/export/files';
import { pngDimensions } from '../src/export/png';

void test('export destinations cannot escape the vault', () => {
	assert.equal(exportFolder('Diagrams/Exports/'), 'Diagrams/Exports');
	assert.equal(exportFolder(''), '');
	for (const value of ['../other', 'a/../b', '/absolute', win32.join('C:', win32.sep, 'outside-vault'), 'a\\b', 'a//b', './folder', 'a./b']) assert.throws(() => exportFolder(value));
	assert.equal(exportBasename('Notes/CON.md', '1'), 'diagram-diagram-1');
	assert.doesNotMatch(exportBasename('Notes/a:*?.md', '../bad'), /[\\/:*?]/);
});

void test('PNG budgets reject oversized, non-finite, or empty canvases', () => {
	assert.deepEqual(pngDimensions(100.25, 80), { width: 201, height: 160 });
	for (const [width, height] of [[0, 1], [-1, 3], [Infinity, 2], [4097, 1], [3000, 3000], [NaN, 3]]) assert.throws(() => pngDimensions(width!, height!));
});

void test('saving creates unique files and retries concurrent collisions without modification', async () => {
	const source = '---\r\ntitle: café\r\n---\r\n%% comment 🧭\r\nflowchart LR\r\n A-->B\r\n';
	for (const [extension, data] of [['svg', '<svg/>'], ['canvas', '{"nodes":[],"edges":[]}'], ['mmd', source], ['mermaid', source]] as const) {
		const files = new Map<string, string | ArrayBuffer>([['Exports/note.' + extension, 'existing']]);
		let raced = false;
		const vault: ExportVault = {
			getAbstractFileByPath: path => files.get(path),
			create: (path, text) => {
				if (!raced) { raced = true; files.set(path, 'concurrent'); return Promise.reject(new Error('Exists')); }
				files.set(path, text); return Promise.resolve();
			},
			createBinary: () => Promise.reject(new Error('Unexpected binary call')),
		};
		const path = 'Exports/note-3.' + extension;
		assert.equal(await saveExport(vault, 'Exports', 'note', extension, data, () => true), path);
		assert.equal(files.get(path), data);
		assert.equal(files.get('Exports/note.' + extension), 'existing');
		assert.equal(files.get('Exports/note-2.' + extension), 'concurrent');
		await assert.rejects(saveExport(vault, '', 'note', extension, data, () => false), /changed/);
		assert.equal(files.size, 3);
	}
});

void test('binary saves use createBinary and I/O failures are not swallowed', async () => {
	const data = new Uint8Array([137, 80, 78, 71]).buffer;
	let saved: unknown;
	const vault: ExportVault = {
		getAbstractFileByPath: () => null,
		create: () => Promise.reject(new Error('Read only')),
		createBinary: (_path, value) => { saved = value; return Promise.resolve(); },
	};
	assert.equal(await saveExport(vault, '', 'diagram', 'png', data, () => true), 'diagram.png');
	assert.equal(saved, data);
	await assert.rejects(saveExport(vault, '', 'diagram', 'svg', '<svg/>', () => true), /Read only/);
	await assert.rejects(saveExport(vault, '', 'diagram', 'canvas', '{}', () => true), /Read only/);
});
