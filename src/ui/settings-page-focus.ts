import { Component } from 'obsidian';

/** Obsidian owns navigation. Restore the opening row when its Back button returns to the parent page. */
export class SettingsPageFocus {
	private owner?: Component;
	private document?: Document;
	private readonly keyboardBack = new WeakSet<HTMLElement>();
	constructor(private readonly tabName?: string) {}

	bind(document: Document): void {
		if (this.document === document) return;
		const content = document.querySelector('.vertical-tab-content-container');
		const view = document.defaultView;
		if (!content || !view) return;
		this.destroy();
		this.document = document;
		const owner = this.owner = new Component();
		owner.load();
		owner.registerDomEvent(document, 'click', this.onBack, true);
		owner.registerDomEvent(document, 'keydown', this.onBack, true);
		const observer = new view.MutationObserver(() => this.enableBackButtons(content));
		observer.observe(content, { childList: true });
		owner.register(() => observer.disconnect());
		this.enableBackButtons(content);
	}

	destroy(): void {
		this.owner?.unload();
		this.owner = undefined;
		this.document = undefined;
	}

	private enableBackButtons(content: Element): void {
		if (!this.isActive(content)) return;
		const back = this.currentBack(content);
		if (!back || back.matches('button, a[href], [tabindex]')) return;
		back.tabIndex = 0;
		back.setAttribute('role', 'button');
		if (!back.hasAttribute('aria-label')) back.setAttribute('aria-label', 'Back');
		back.setAttribute('aria-keyshortcuts', 'Alt+ArrowLeft');
		this.keyboardBack.add(back);
		if (content === content.ownerDocument.activeElement) back.focus({ preventScroll: true });
	}

	private isActive(content: Element): boolean {
		const selected = content.closest('.vertical-tabs-container')?.querySelector('.vertical-tab-nav-item.is-active');
		return selected
			? selected.textContent?.trim() === this.tabName
			: content.querySelector('.advanced-mermaid-settings') !== null;
	}

	private currentBack(content: Element): HTMLElement | undefined {
		return Array.from(content.querySelectorAll<HTMLElement>('.setting-page-back-button')).reverse()
			.find(back => back.getClientRects().length);
	}

	private readonly onBack = (event: MouseEvent | KeyboardEvent): void => {
		const target = event.target as Element | null;
		const content = target?.closest?.('.vertical-tab-content-container');
		if (!content || !this.isActive(content)) return;
		const keyboardShortcut = 'key' in event && event.altKey && event.key === 'ArrowLeft'
			&& !target?.closest('input, textarea, [contenteditable="true"]');
		const back = keyboardShortcut ? this.currentBack(content) : target?.closest?.<HTMLElement>('.setting-page-back-button');
		if (!back) return;
		if ('key' in event) {
			if (!keyboardShortcut && (!this.keyboardBack.has(back) || (event.key !== 'Enter' && event.key !== ' '))) return;
			event.preventDefault();
			event.stopPropagation();
			back.click();
			return;
		}
		const titlebar = back.closest('.setting-page-titlebar');
		const page = titlebar?.closest('.setting-page');
		const title = titlebar?.querySelector('.setting-page-title')?.textContent?.trim();
		const document = content.ownerDocument;
		if (!title || !page) return;

		document.defaultView?.requestAnimationFrame(() => {
			if (this.document !== document || !content.isConnected || page.getClientRects().length) return;
			if (document.activeElement !== content && document.activeElement !== document.body) return;
			const entry = Array.from(content.querySelectorAll<HTMLElement>('.setting-item.mod-navigable')).find(row =>
				row.getClientRects().length && row.querySelector('.setting-item-name')?.textContent?.trim() === title);
			const focusable = entry?.matches('[tabindex]') ? entry : entry?.querySelector<HTMLElement>('button, [tabindex]');
			focusable?.focus();
		});
	};
}
