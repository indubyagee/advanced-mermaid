import { build } from 'esbuild';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'advanced-mermaid-tests-'));
try {
	const entries = (await readdir('tests')).filter(name => name.endsWith('.test.ts'));
	await build({
		entryPoints: entries.map(name => `tests/${name}`),
		outdir: directory, bundle: true, platform: 'node', format: 'esm',
		alias: { obsidian: resolve('tests/obsidian.ts') },
	});
	const result = spawnSync(process.execPath, ['--test', ...entries.map(name => join(directory, name.replace(/\.ts$/, '.js'))), resolve('scripts/public-policy.test.mjs')], { stdio: 'inherit' });
	process.exitCode = result.status ?? 1;
} finally {
	if (resolve(directory).startsWith(resolve(tmpdir()) + '\\') || resolve(directory).startsWith(resolve(tmpdir()) + '/')) {
		await rm(directory, { recursive: true, force: true });
	}
}
