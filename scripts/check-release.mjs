import { readFileSync } from 'node:fs';

const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const normalize = text => text.replaceAll('\r\n', '\n').trim();

function textFile(path) {
	let text;
	try { text = readFileSync(path, 'utf8'); }
	catch { throw new Error(path + ' is missing or unreadable.'); }
	if (!text.trim()) throw new Error(path + ' must not be empty.');
	return normalize(text);
}

function jsonFile(path) {
	const text = textFile(path);
	try {
		const value = JSON.parse(text);
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
		return value;
	} catch { throw new Error(path + ' must contain a JSON object.'); }
}

function requireCondition(condition, message) {
	if (!condition) throw new Error(message);
}

function main() {
	const args = process.argv.slice(2);
	requireCondition(args.length === 0 || (args.length === 2 && args[0] === '--tag' && args[1]), 'Usage: npm run check:release -- [--tag <version>]');
	const tag = args[1];
	const manifest = jsonFile('manifest.json');
	for (const field of ['id', 'name', 'version', 'minAppVersion', 'description', 'author']) {
		requireCondition(typeof manifest[field] === 'string' && manifest[field].trim(), 'manifest.json: ' + field + ' must be a non-empty string.');
	}
	requireCondition(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id) && !manifest.id.includes('obsidian'), 'manifest.json: id must use lowercase letters, numbers and hyphens without obsidian.');
	requireCondition(manifest.id === 'advanced-mermaid', 'manifest.json: id must remain advanced-mermaid.');
	for (const field of ['version', 'minAppVersion']) requireCondition(semanticVersion.test(manifest[field]), 'manifest.json: ' + field + ' must use x.y.z.');
	requireCondition(manifest.description.length <= 250 && manifest.description.endsWith('.'), 'manifest.json: description must be at most 250 characters and end with a period.');
	requireCondition(typeof manifest.isDesktopOnly === 'boolean', 'manifest.json: isDesktopOnly must be boolean.');

	const pkg = jsonFile('package.json');
	const lock = jsonFile('package-lock.json');
	const versions = jsonFile('versions.json');
	const version = manifest.version;
	requireCondition(pkg.version === version && lock.version === version, 'package.json, manifest.json and package-lock.json version values must match.');
	requireCondition(lock.packages?.['']?.version === version, 'The lockfile root package version must match manifest.json.');
	requireCondition(versions[version] === manifest.minAppVersion, 'versions.json must map ' + version + ' to minAppVersion ' + manifest.minAppVersion + '.');
	if (tag !== undefined) requireCondition(semanticVersion.test(tag) && tag === version, 'Release tag must exactly match ' + version + ', without a v prefix or prerelease suffix.');

	const bundle = textFile('main.js');
	textFile('styles.css');
	const pele = jsonFile('node_modules/pele/package.json');
	requireCondition(pkg.dependencies?.pele === pele.version && lock.packages?.['node_modules/pele']?.version === pele.version, 'The pinned, locked and installed Pele versions must match.');
	for (const [name, path] of [['project', 'LICENSE'], ['Pele (including Lucide ISC)', 'node_modules/pele/LICENSE']]) {
		requireCondition(bundle.includes(textFile(path)), 'main.js must contain the complete ' + name + ' license notices.');
	}
	console.log('Release checks passed for ' + version + (tag ? ' (tag ' + tag + ')' : '') + '.');
}

try { main(); }
catch (error) {
	console.error('Release check failed: ' + error.message);
	process.exitCode = 1;
}
