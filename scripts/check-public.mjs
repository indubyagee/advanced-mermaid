import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isPrivatePath, inspectText } from './public-policy.mjs';

function git(root, args, input) {
	return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
		cwd: root, encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024,
	});
}

export function checkPublicTree(root = process.cwd()) {
	const paths = new Set(git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean));
	const findings = [];
	for (const path of paths) {
		if (isPrivatePath(path)) { findings.push({ path, reason: 'private or generated file is tracked' }); continue; }
		const file = resolve(root, path);
		let stat;
		try { stat = lstatSync(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
		if (stat.isSymbolicLink()) { findings.push({ path, reason: 'symbolic link requires publication review' }); continue; }
		const bytes = readFileSync(file);
		if (bytes.includes(0)) continue;
		for (const finding of inspectText(bytes.toString('utf8'))) findings.push({ path, ...finding });
	}
	return findings;
}

/** Review everything reachable from outgoing tips, including earlier commits. */
export function checkPublicHistory(refs = ['HEAD'], root = process.cwd()) {
	if (!refs.length) return [];
	const rows = git(root, ['rev-list', '--objects', ...refs, '--']).trim().split('\n').filter(Boolean);
	const objects = rows.map(row => {
		const space = row.indexOf(' ');
		return { oid: space < 0 ? row : row.slice(0, space), path: space < 0 ? '(Git object)' : row.slice(space + 1) };
	});
	const metadata = git(root, ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], objects.map(object => object.oid).join('\n') + '\n').trim().split('\n');
	const findings = [];
	for (const [index, object] of objects.entries()) {
		if (isPrivatePath(object.path)) { findings.push({ path: object.path, reason: 'private file exists in outgoing history' }); continue; }
		const [, type, size] = metadata[index].split(' ');
		if (type !== 'blob') continue;
		if (Number(size) > 2_000_000) { findings.push({ path: object.path, reason: 'large historical blob needs publication review' }); continue; }
		const text = git(root, ['cat-file', 'blob', object.oid]);
		if (text.includes('\0')) continue;
		for (const finding of inspectText(text)) findings.push({ path: object.path, ...finding });
	}
	return findings;
}

export function outgoingRefs(input) {
	return [...new Set(input.trim().split('\n').filter(Boolean).flatMap(line => {
		const oid = line.trim().split(/\s+/)[1];
		if (!oid || !/^[a-f0-9]{40,64}$/.test(oid)) throw new Error('Invalid pre-push input.');
		return /^0+$/.test(oid) ? [] : [oid];
	}))];
}

function main() {
	try {
		const history = process.argv.includes('--history');
		const prePush = process.argv.includes('--pre-push');
		const refs = prePush ? outgoingRefs(readFileSync(0, 'utf8')) : ['HEAD'];
		const findings = checkPublicTree();
		if (history || prePush) findings.push(...checkPublicHistory(refs));
		if (findings.length) {
			console.error('Publication blocked by the public-surface check:');
			for (const item of findings.slice(0, 20)) console.error(`- ${item.path}${item.line ? ':' + item.line : ''}: ${item.reason}`);
			if (findings.length > 20) console.error(`- ${findings.length - 20} additional issues omitted.`);
			if (history || prePush) console.error('Removing files from the current tree does not remove earlier Git objects. Review history separately before publishing.');
			process.exitCode = 1;
		} else console.log('Public-surface check passed' + (history || prePush ? ', including outgoing history.' : '.'));
	} catch {
		console.error('Publication check could not inspect all requested Git objects or files. Publication remains blocked.');
		process.exitCode = 1;
	}
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
