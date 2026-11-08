/** Publication policy shared by the current-tree and outgoing-history checks. */
export function isPrivatePath(input) {
	const path = input.replaceAll('\\', '/');
	return /(?:^|\/)(?:\.private|\.local|\.agents|\.codex|\.obsidian|\.vscode|\.idea|node_modules|tasks|internal|plans|planning|specs|history|references|attachments|test-results|playwright-report|coverage|dist|package)(?:\/|$)/i.test(path)
		|| /^docs\/(?:superpowers|internal|design|development)(?:\/|$)/i.test(path)
		|| /^docs\/architecture\.md$/i.test(path)
		|| /(?:^|\/)(?:AGENTS|CLAUDE)\.md$/i.test(path)
		|| /(?:^|\/)\.env(?:\.(?!(?:example|sample)$).*)?$/i.test(path)
		|| /(?:^|\/)(?:main\.js|data\.json|\.npmrc\.local)$/i.test(path)
		|| /\.(?:bak|key|pem|p12|pfx|map|log|tsbuildinfo)$/i.test(path);
}

const rules = [
	['legacy project name', /\b(?:obsidian[- ]pele|pele[- ]studio)\b/ig],
	['absolute workstation path', /\b[A-Za-z]:[\\/](?!\/)|file:\/\/\/|(?:\/Users\/|\/home\/)[^\s"'<>]+/g],
	['personal email address', /\b[A-Z0-9._%+-]+@(?:gmail|outlook|hotmail|yahoo|icloud|protonmail|proton)\.[A-Z.]+\b/ig],
	['private key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g],
	['provider token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/g],
	['credentials in URL', /https?:\/\/[^\s/@:]+:[^\s/@]+@/ig],
];

/** Return category and line only: never echo potential secret bytes. */
export function inspectText(text) {
	const findings = [];
	for (const [reason, pattern] of rules) {
		for (const match of text.matchAll(pattern)) {
			findings.push({ reason, line: text.slice(0, match.index).split('\n').length });
			if (findings.length >= 20) return findings;
		}
	}
	return findings;
}
