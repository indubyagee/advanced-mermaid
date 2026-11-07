import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { isPrivatePath, inspectText } from './public-policy.mjs';
import { checkPublicTree, outgoingRefs } from './check-public.mjs';

test('publication policy distinguishes internal documents from user guides and source', () => {
	for (const path of ['tasks/plan.md', 'docs/architecture.md', 'docs/superpowers/specs/design.md', 'AGENTS.md', '.local/backup.md', '.env', '.env.production', 'vault.key', 'main.js', 'data.json']) assert.equal(isPrivatePath(path), true, path);
	for (const path of ['README.md', 'docs/settings-menu.md', 'docs/preset-classes.md', 'src/main.ts', 'tests/export.test.ts', '.env.example', '.env.sample']) assert.equal(isPrivatePath(path), false, path);
});

test('secret and path diagnostics never include matched bytes', () => {
	const token = 'gh' + 'p_' + 'x'.repeat(36);
	const workstation = ['C:', 'Users', 'fixture', 'vault'].join('\\');
	const text = 'Public text\n' + token + '\n' + workstation;
	const results = inspectText(text);
	assert.ok(results.some(item => item.reason === 'provider token' && item.line === 2));
	assert.ok(results.some(item => item.reason === 'absolute workstation path' && item.line === 3));
	assert.ok(!JSON.stringify(results).includes(token));
	assert.deepEqual(inspectText('https://github.com/indubyagee/advanced-mermaid\nconst root = process.env.ADVANCED_MERMAID_HOST_VAULT;'), []);
});

test('tracked internal files are rejected even when ignored', () => {
	const temporaryRoot = realpathSync(tmpdir());
	const root = mkdtempSync(join(temporaryRoot, 'advanced-mermaid-policy-'));
	try {
		execFileSync('git', ['init', '--quiet', root]);
		mkdirSync(join(root, 'tasks'));
		writeFileSync(join(root, '.gitignore'), '/tasks/\n');
		writeFileSync(join(root, 'tasks', 'plan.md'), 'Private plan');
		writeFileSync(join(root, 'README.md'), 'Public guide');
		assert.deepEqual(checkPublicTree(root), []);
		execFileSync('git', ['add', '--force', 'tasks/plan.md'], { cwd: root });
		assert.ok(checkPublicTree(root).some(item => item.path === 'tasks/plan.md'));
	} finally {
		if (!resolve(root).startsWith(temporaryRoot + sep)) throw new Error('Unsafe temporary directory cleanup');
		rmSync(root, { recursive: true, force: true });
	}
});

test('pre-push input checks local refs and skips branch deletions', () => {
	const oid = 'a'.repeat(40), zero = '0'.repeat(40);
	assert.deepEqual(outgoingRefs(`refs/heads/main ${oid} refs/heads/main ${zero}\nrefs/heads/old ${zero} refs/heads/old ${oid}`), [oid]);
	assert.deepEqual(outgoingRefs(''), []);
	assert.throws(() => outgoingRefs('refs/heads/main invalid refs/heads/main invalid'));
});
