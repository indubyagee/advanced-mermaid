import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve, sep, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(repository, 'scripts', 'check-release.mjs');
const projectLicense = readFileSync(join(repository, 'LICENSE'), 'utf8').replaceAll('\r\n', '\n').trim();
const peleLicense = readFileSync(join(repository, 'node_modules', 'pele', 'LICENSE'), 'utf8').replaceAll('\r\n', '\n').trim();

function fixture(run) {
	const temporaryRoot = realpathSync(tmpdir());
	const root = mkdtempSync(join(temporaryRoot, 'advanced-mermaid-release-'));
	const json = (path, value) => writeFileSync(join(root, path), JSON.stringify(value));
	const manifest = { id: 'advanced-mermaid', name: 'Advanced Mermaid', version: '0.3.0', minAppVersion: '1.14.5', description: 'Render Mermaid diagrams locally.', author: 'indubyagee', isDesktopOnly: true };
	const bundle = '/*!\n' + projectLicense + '\n\nPele 1.12.0\n' + peleLicense + '\n*/\nmodule.exports = {};\n';
	try {
		mkdirSync(join(root, 'node_modules', 'pele'), { recursive: true });
		json('package.json', { name: 'advanced-mermaid', version: '0.3.0', dependencies: { pele: '1.12.0' } });
		json('package-lock.json', { version: '0.3.0', packages: { '': { version: '0.3.0' }, 'node_modules/pele': { version: '1.12.0' } } });
		json('manifest.json', manifest);
		json('versions.json', { '0.2.2': '1.14.5', '0.3.0': '1.14.5' });
		json('node_modules/pele/package.json', { version: '1.12.0' });
		writeFileSync(join(root, 'LICENSE'), projectLicense);
		writeFileSync(join(root, 'node_modules', 'pele', 'LICENSE'), peleLicense);
		writeFileSync(join(root, 'main.js'), bundle);
		writeFileSync(join(root, 'styles.css'), '.advanced-mermaid { color: inherit; }');
		const check = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
		run({ root, json, manifest, bundle, check });
	} finally {
		if (!resolve(root).startsWith(temporaryRoot + sep)) throw new Error('Unsafe release fixture cleanup');
		rmSync(root, { recursive: true, force: true });
	}
}

test('release checker accepts matching production artifacts with or without an explicit tag', () => fixture(({ check }) => {
	for (const args of [[], ['--tag', '0.3.0']]) {
		const result = check(...args);
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /Release checks passed.*0\.3\.0/);
	}
}));

test('release checker rejects package, manifest and lockfile version disagreements', () => {
	for (const path of ['package.json', 'manifest.json', 'package-lock.json']) fixture(({ root, json, check }) => {
		const data = JSON.parse(readFileSync(join(root, path), 'utf8'));
		data.version = '0.2.2'; json(path, data);
		const result = check();
		assert.equal(result.status, 1);
		assert.match(result.stderr, /version.*match|version.*disagree/i);
	});
	fixture(({ root, json, check }) => {
		const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
		lock.packages[''].version = '0.2.2'; json('package-lock.json', lock);
		assert.match(check().stderr, /lockfile.*version|version.*lockfile/i);
	});
});

test('release checker rejects a missing or incorrect minimum-version mapping', () => {
	for (const mappings of [{}, { '0.3.0': '1.0.0' }]) fixture(({ json, check }) => {
		json('versions.json', mappings);
		const result = check();
		assert.equal(result.status, 1);
		assert.match(result.stderr, /versions\.json/);
	});
});

test('release checker rejects prefixed, prerelease and mismatched tags', () => fixture(({ check }) => {
	for (const tag of ['v0.3.0', '0.3.0-beta.1', '0.3.1']) {
		const result = check('--tag', tag);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /tag/i);
	}
}));

test('release checker refuses incomplete or empty release artifacts', () => {
	for (const path of ['main.js', 'manifest.json', 'styles.css']) {
		fixture(({ root, check }) => {
			rmSync(join(root, path));
			const result = check();
			assert.equal(result.status, 1);
			assert.ok(result.stderr.includes(path), result.stderr);
		});
		fixture(({ root, check }) => {
			writeFileSync(join(root, path), '');
			assert.equal(check().status, 1);
		});
	}
});

test('release checker requires full project and dependency notices including Lucide ISC', () => {
	for (const notice of [projectLicense, peleLicense, 'Copyright (c) 2026 Lucide Icons and Contributors']) fixture(({ root, bundle, check }) => {
		writeFileSync(join(root, 'main.js'), bundle.replace(notice, ''));
		const result = check();
		assert.equal(result.status, 1);
		assert.match(result.stderr, /license|notice/i);
	});
});

test('release checker accepts license text with Windows line endings', () => fixture(({ root, bundle, check }) => {
	writeFileSync(join(root, 'main.js'), bundle.replaceAll('\n', '\r\n'));
	assert.equal(check().status, 0);
}));

test('release checker rejects malformed or incomplete manifest fields', () => {
	for (const [field, value] of [['id', 'obsidian-advanced-mermaid'], ['name', ''], ['version', '0.3'], ['minAppVersion', ''], ['description', 'x'.repeat(251) + '.'], ['description', 'Missing period'], ['author', ''], ['isDesktopOnly', 'true']]) fixture(({ json, manifest, check }) => {
		json('manifest.json', { ...manifest, [field]: value });
		const result = check();
		assert.equal(result.status, 1);
		assert.ok(result.stderr.includes(field), result.stderr);
	});
});

test('release checker rejects incomplete CLI arguments', () => fixture(({ check }) => {
	for (const args of [['--tag'], ['--tag', '0.3.0', '--tag', '0.3.0'], ['--unknown'], ['0.3.0']]) {
		const result = check(...args);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /usage|argument/i);
	}
}));

test('release checker reports malformed metadata without a stack trace', () => fixture(({ root, check }) => {
	writeFileSync(join(root, 'package-lock.json'), '{broken');
	const result = check();
	assert.equal(result.status, 1);
	assert.match(result.stderr, /package-lock\.json/);
	assert.doesNotMatch(result.stderr, /at (?:file:|Module\.)/);
}));
