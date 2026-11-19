import { PeleError } from 'pele';
import { ConfigurationError } from '../rendering/overrides';
import type { Component } from 'obsidian';

export function errorText(error: unknown): string {
	return error instanceof Error ? error.message : typeof error === 'string' ? error : 'An unexpected error occurred.';
}

/** Keep the copy handler on the persistent feedback container. */
export class DiagramFeedback {
	private current?: { button: HTMLButtonElement; diagnostic: string };

	constructor(private readonly host: HTMLElement, owner: Component, copy: (text: string) => Promise<void>) {
		host.hidden = true;
		owner.registerDomEvent(host, 'click', event => {
			const current = this.current;
			if (!current || event.target !== current.button) return;
			void copy(current.diagnostic).catch(() => {
				if (this.current !== current) return;
				current.button.textContent = 'Copy unavailable';
				current.button.title = 'Select and copy the error text.';
			});
		});
	}

	clear(): void {
		this.current = undefined;
		this.host.replaceChildren();
		this.host.hidden = true;
	}

	/** Render diagnostics and source as text so markup stays literal. */
	show(error: unknown, source: string, fallback = false): void {
		const { host } = this;
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
		this.current = { button, diagnostic };
		const details = host.createEl('details');
		details.createEl('summary', { text: 'Technical details' });
		details.createEl('pre', { text: error instanceof Error ? error.stack ?? diagnostic : diagnostic });
		const sourceDetails = host.createEl('details', { attr: { open: '' } });
		sourceDetails.createEl('summary', { text: 'Diagram source' });
		sourceDetails.createEl('pre').createEl('code', { text: source });
		if (fallback) host.createEl('p', { text: 'Preview uses global/type fallback styles. Fix the local styles before exporting.' });
	}
}
