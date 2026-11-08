import { PeleError } from 'pele';
import { ConfigurationError } from '../rendering/overrides';
import type { Component } from 'obsidian';

export function errorText(error: unknown): string {
	return error instanceof Error ? error.message : typeof error === 'string' ? error : 'An unexpected error occurred.';
}

/** Error messages and diagram source may contain markup; insert text only. */
export function showDiagramError(host: HTMLElement, error: unknown, source: string, copy: (text: string) => Promise<void>, owner: Component): void {
	host.replaceChildren();
	host.hidden = false;
	const category = error instanceof ConfigurationError ? 'Display settings'
		: error instanceof PeleError ? error.code : 'Rendering';
	let location = '';
	if (error instanceof ConfigurationError || error instanceof PeleError) {
		if (error.line > 0) location = ` at line ${error.line}`;
		if (error instanceof PeleError && error.column > 0) location += `, column ${error.column}`;
	}
	const diagnostic = `${category}${location}: ${errorText(error)}`;
	host.createEl('p', { text: diagnostic, cls: 'advanced-mermaid-error-message' });
	host.createEl('p', { text: error instanceof ConfigurationError
		? 'Correct the directive in the source block and try again.'
		: 'Edit the source block to correct the diagram. Other diagrams can still render.' });
	const button = host.createEl('button', { text: 'Copy error', attr: { type: 'button' } });
	owner.registerDomEvent(button, 'click', () => { void copy(diagnostic).catch(() => { button.textContent = 'Copy unavailable'; button.title = 'Select and copy the error text.'; }); });
	const details = host.createEl('details');
	details.createEl('summary', { text: 'Technical details' });
	details.createEl('pre', { text: error instanceof Error ? error.stack ?? diagnostic : diagnostic });
	const sourceDetails = host.createEl('details', { attr: { open: '' } });
	sourceDetails.createEl('summary', { text: 'Diagram source' });
	sourceDetails.createEl('pre').createEl('code', { text: source });
}
