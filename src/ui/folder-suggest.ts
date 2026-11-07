import { AbstractInputSuggest, type App } from 'obsidian';

/** Vault paths come from Obsidian's in-memory index, never an OS folder scan. */
export class VaultFolderSuggest extends AbstractInputSuggest<string> {
	constructor(app: App, input: HTMLInputElement, private readonly selected: (path: string) => void) { super(app, input); }

	getSuggestions(query: string): string[] {
		const search = query.trim().toLocaleLowerCase();
		return ['', ...this.app.vault.getAllFolders().map(folder => folder.path).filter(path => path !== '/')]
			.filter(path => (path || 'Vault root').toLocaleLowerCase().includes(search))
			.sort((a, b) => a.localeCompare(b));
	}

	renderSuggestion(path: string, element: HTMLElement): void { element.setText(path || 'Vault root'); }

	selectSuggestion(path: string): void {
		this.setValue(path);
		this.selected(path);
		this.close();
	}
}
