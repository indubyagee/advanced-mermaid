import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree, highlightingFor } from '@codemirror/language';
import { highlightTree } from '@lezer/highlight';
import { sourceLanguage } from '../src/editor/languages';
import { DIAGRAM_SYNTAX } from '../src/editor/syntax/catalog';
import { indentFold } from '../src/editor/source-tools';

function tokens(source: string, mode: 'mermaid' | 'css' = 'mermaid') {
	const state = EditorState.create({ doc: source, extensions: sourceLanguage(mode) });
	const result: { text: string; style: string }[] = [];
	const tree = ensureSyntaxTree(state, state.doc.length, 1000)!;
	highlightTree(tree, { style: tags => highlightingFor(state, tags) }, (from, to, style) => result.push({ text: source.slice(from, to), style }));
	return result;
}

void test('source highlights every catalog declaration and compatibility aliases', () => {
	for (const declaration of [...DIAGRAM_SYNTAX.map(item => item.declaration), 'graph', 'flowchart-elk', 'packet', 'sankey', 'treeView']) {
		assert.deepEqual(tokens(declaration), [{ text: declaration, style: 'am-source-declaration' }], declaration);
	}
});

void test('source distinguishes YAML, directives, keywords, connectors, labels and comments', () => {
	const source = '---\ntitle: "Example"\nconfig:\n  theme: base # comment\n---\n%%{init: {"theme": "base"}}%%\nflowchart TD\nsubgraph Group\n A-->B["Quoted label"] %% note\nend';
	const highlighted = tokens(source);
	for (const [text, style] of [['title:', 'frontmatter-key'], ['"Example"', 'frontmatter-value'], ['base', 'frontmatter-value'], ['# comment', 'comment'],
		['%%{init: {"theme": "base"}}%%', 'directive'], ['flowchart', 'declaration'], ['subgraph', 'keyword'], ['-->', 'operator'], ['"Quoted label"', 'string'], ['%% note', 'comment']]) {
		assert.ok(highlighted.some(item => item.text === text && item.style === 'am-source-' + style), JSON.stringify({ text, highlighted }));
	}
	assert.deepEqual(tokens('weekend graphNode subgraphical A-->>B').filter(item => item.style !== 'am-source-operator'), []);
	for (const keyword of ['x-axis', 'y-axis', 'axis', 'curve', 'participant', 'direction', 'classDef']) assert.deepEqual(tokens(keyword), [{ text: keyword, style: 'am-source-keyword' }]);
	for (const connector of ['o--o', '<-->', '-.->', '-->>', '}o--||']) assert.deepEqual(tokens(connector), [{ text: connector, style: 'am-source-operator' }]);
});

void test('frontmatter distinguishes keys from flow, list and multiline values', () => {
	const source = `\n---\nconfig: {"quoted key":12, theme: dark}\nitems:\n  - name: 'It''s a value'
    count: 2
description: |-
  looks like a key: still a value
title: "Unfinished
  still quoted`;
	const highlighted = tokens(source);
	const texts = (type: string) => highlighted.filter(item => item.style === 'am-source-frontmatter-' + type).map(item => item.text);
	assert.deepEqual(texts('key'), ['config:', '"quoted key":', 'theme:', 'items:', 'name:', 'count:', 'description:', 'title:']);
	assert.deepEqual(texts('value'), ['12', 'dark', "'It''s a value'", '2', '|-', '  looks like a key: still a value', '"Unfinished', '  still quoted']);
	assert.ok(tokens('---\nconfig: {theme: base\n---\nflowchart TD').some(item => item.style === 'am-source-declaration'));
});

void test('incomplete quoted labels and directives retain styling through continued edits', () => {
	assert.equal(tokens('flowchart TD\n A["unfinished\nstill quoted').filter(item => item.style === 'am-source-string').map(item => item.text).join('\n'), '"unfinished\nstill quoted');
	const open = '%%{init:\n {"theme": "dark"}\n';
	assert.ok(tokens(open).every(item => item.style === 'am-source-directive'));
	assert.ok(tokens(open + '}%%\nflowchart TD').some(item => item.text === 'flowchart' && item.style === 'am-source-declaration'));
	assert.ok(tokens('A["escaped \\" end"]').some(item => item.style === 'am-source-string' && item.text === '"escaped \\" end"'));
	assert.ok(tokens('.node { --node-fill: #abcdef; }', 'css').some(item => item.style === 'am-source-property'));
});

function folded(source: string, line: number, tabSize = 4): string | null {
	const state = EditorState.create({ doc: source, extensions: EditorState.tabSize.of(tabSize) });
	const header = state.doc.line(line);
	const range = indentFold(state, header.from, header.to);
	return range ? state.doc.sliceString(range.from, range.to) : null;
}

void test('indent folds contain real children and retain headers, dedents and closing statements', () => {
	for (const source of [
		'---\nconfig:\n  flowchart:\n    curve: basis\n  theme: base\n---\nflowchart TD',
		'treeView-beta\nroot/\n  folder/\n    file.txt\n  sibling.txt\nother/',
		'mindmap\nroot\n  Child\n    Leaf\n  Sibling\nOther',
		'flowchart TD\nsubgraph Group\n  subgraph Nested\n    A-->B\n  end\nend\nC-->D',
	]) {
		assert.ok(folded(source, 2));
		assert.equal(folded(source, 3), '\n' + source.split('\n')[3]);
		assert.equal(folded(source, 4), null);
	}
	assert.equal(folded('state Group {\n  A --> B\n}\nC', 1), '\n  A --> B');
	assert.equal(folded('.node {\n  --node-fill: red;\n}\n.other {}', 1), '\n  --node-fill: red;');
	assert.equal(folded('end:\n  value: true\nnext:', 1), '\n  value: true');
});

void test('folds skip blank and comment lines, use tab stops, and follow edits', () => {
	assert.equal(folded('root\n\n%% note\n  child\n  %% trailing\n\nnext', 1), '\n\n%% note\n  child');
	assert.equal(folded('root\n  %% no children\n\nnext', 1), null);
	assert.equal(folded('%% comment\n  child', 1), null);
	assert.equal(folded('  end\n    child', 1), null);
	assert.equal(folded('root\n    child\n\tpeer\nnext', 2), null);
	assert.equal(folded('root\n \tchild\n      leaf\nnext', 2), '\n      leaf');
	const state = EditorState.create({ doc: 'root\n  child\nnext' });
	const changed = state.update({ changes: { from: 5, to: 7, insert: '' } }).state;
	assert.equal(indentFold(changed, 0, 4), null);
});
