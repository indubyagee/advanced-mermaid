/** Minimal host adapter for browser integration tests, not an Obsidian emulator. */
import { StateField } from '@codemirror/state';
import { load, dump, JSON_SCHEMA } from 'js-yaml';
import type { SettingDefinitionItem, SettingDefinitionGroup, SettingDefinitionPage, SettingGroup } from 'obsidian';
export const editorLivePreviewField = StateField.define<boolean>({ create: () => true, update: value => value });
export const editorInfoField = StateField.define<{ file: { path: string }; editor?: unknown }>({ create: () => ({ file: { path: 'InlineEditor.md' } }), update: value => value });
export function parseYaml(source: string): unknown { return load(source, { schema: JSON_SCHEMA }); }
export function stringifyYaml(value: unknown): string { return dump(value, { schema: JSON_SCHEMA, noRefs: true }); }
export class MarkdownRenderChild {
	private cleanup: (() => void)[] = [];
	constructor(readonly containerEl: HTMLElement) {}
	register(callback: () => void): void { this.cleanup.push(callback); }
	registerDomEvent(element: EventTarget, name: string, callback: EventListener): void {
		element.addEventListener(name, callback);
		this.register(() => element.removeEventListener(name, callback));
	}
	onload(): void {}
	onunload(): void {}
	load(): void { this.onload(); }
	unload(): void { this.onunload(); for (const callback of this.cleanup.splice(0)) callback(); }
}

export class TFolder { constructor(readonly path = '/') {} }
export class Component extends MarkdownRenderChild { constructor() { super(undefined as unknown as HTMLElement); } }

/** Lifecycle/processor registration adapter for testing the actual plugin entry. */
export class Plugin extends Component {
	data: unknown = null;
	extensions: unknown[] = [];
	processors = new Map<string, { handler: (source: string, element: HTMLElement, context: unknown) => void; sortOrder: number }>();
	constructor(readonly app: unknown, readonly manifest: unknown) { super(); }
	loadData(): Promise<unknown> { return Promise.resolve(this.data); }
	saveData(data: unknown): Promise<void> { this.data = data; return Promise.resolve(); }
	registerEditorExtension(extension: unknown): void { this.extensions.push(extension); }
	addCommand(_command: unknown): void {}
	addSettingTab(_tab: unknown): void {}
	registerEvent(_event: unknown): void {}
	registerMarkdownCodeBlockProcessor(language: string, handler: (source: string, element: HTMLElement, context: unknown) => void, sortOrder = 0): void {
		this.processors.set(language, { handler, sortOrder });
		this.register(() => { this.processors.delete(language); });
	}
}
export class Notice { constructor(readonly message: string) {} }

/** Only the public selection contract is adapted; Obsidian's popover is not emulated. */
export abstract class AbstractInputSuggest<T> {
	constructor(readonly app: { vault: { getAllFolders(): TFolder[] } }, readonly input: HTMLInputElement) {}
	abstract getSuggestions(query: string): T[];
	abstract renderSuggestion(value: T, element: HTMLElement): void;
	abstract selectSuggestion(value: T): void;
	setValue(value: string): void { this.input.value = value; }
	close(): void {}
}

export class PluginSettingTab {
	containerEl!: HTMLElement;
	settingItems: SettingDefinitionItem[] = [];
	private path: string[] = [];
	private disposers: (() => void)[] = [];
	constructor(readonly app: unknown, _plugin: unknown) {}
	getSettingDefinitions(): SettingDefinitionItem[] { return []; }
	display(): void { this.update(); }
	/** A fixture renderer for public definitions; native navigation/search need host tests. */
	update(): void {
		for (const cleanup of this.disposers.splice(0)) cleanup();
		this.settingItems = this.getSettingDefinitions(); let items = this.settingItems;
		const page = (definitions: SettingDefinitionItem[], name: string): SettingDefinitionPage | undefined => {
			for (const item of definitions) {
				if ('type' in item && item.type === 'page' && item.name === name) return item;
				if ('type' in item && (item.type === 'group' || item.type === 'list')) { const found = page(item.items ?? [], name); if (found) return found; }
			}
			return undefined;
		};
		for (const name of this.path) { const found = page(items, name); if (found) items = found.items ?? []; }
		this.containerEl.empty();
		if (this.path.length) this.containerEl.createEl('button', { text: 'Back', attr: { 'aria-label': 'Back' } }).addEventListener('click', () => { this.path.pop(); this.update(); });
		const render = (definitions: SettingDefinitionItem[]): void => {
			const description = (value: string | DocumentFragment | undefined): string => typeof value === 'string' ? value : value?.textContent ?? '';
			for (const item of definitions) {
				if ('visible' in item && (typeof item.visible === 'function' ? !item.visible() : item.visible === false)) continue;
				if ('type' in item && (item.type === 'group' || item.type === 'list')) {
					const group = item as SettingDefinitionGroup; if (group.heading) this.containerEl.createEl('h3', { text: group.heading }); render(group.items ?? []); continue;
				}
				if ('type' in item && item.type === 'page') {
					new Setting(this.containerEl).setName(item.name).setDesc(description(item.desc)).addButton(button => button.setButtonText('Open').onClick(() => { this.path.push(item.name); this.update(); })); continue;
				}
				if (!('name' in item)) continue;
				const row = new Setting(this.containerEl).setName(item.name).setDesc(description(item.desc));
				if ('render' in item && item.render) { const cleanup = item.render(row as unknown as import('obsidian').Setting, {} as SettingGroup); if (cleanup) this.disposers.push(cleanup); }
			}
		};
		render(items);
	}
}

export class Modal {
	contentEl!: HTMLElement;
	private host?: HTMLElement;
	constructor(readonly app: unknown) {}
	setTitle(_title: string): this { return this; }
	onOpen(): void {}
	onClose(): void {}
	open(): void { this.host = document.body.createDiv({ cls: 'modal' }); this.contentEl = this.host.createDiv(); this.onOpen(); }
	close(): void { this.onClose(); this.host?.remove(); }
}

class TextControl {
	readonly inputEl: HTMLInputElement;
	constructor(host: HTMLElement) { this.inputEl = host.createEl('input'); }
	setValue(value: string): this { this.inputEl.value = value; return this; }
	setPlaceholder(value: string): this { this.inputEl.placeholder = value; return this; }
	onChange(callback: (value: string) => void): this { this.inputEl.addEventListener('input', () => callback(this.inputEl.value)); return this; }
}

class ButtonControl {
	readonly buttonEl: HTMLButtonElement;
	constructor(host: HTMLElement) { this.buttonEl = host.createEl('button'); }
	setButtonText(text: string): this { this.buttonEl.textContent = text; return this; }
	setCta(): this { return this; }
	setWarning(): this { return this; }
	setDestructive(): this { return this; }
	setDisabled(value: boolean): this { this.buttonEl.disabled = value; return this; }
	onClick(callback: () => void | Promise<void>): this { this.buttonEl.addEventListener('click', () => { void callback(); }); return this; }
	setIcon(_icon: string): this { return this; }
	setTooltip(text: string): this { this.buttonEl.title = text; return this; }
}

class DropdownControl {
	readonly selectEl: HTMLSelectElement;
	constructor(host: HTMLElement) { this.selectEl = host.createEl('select'); }
	addOptions(options: Record<string, string>): this { for (const [value, text] of Object.entries(options)) this.selectEl.createEl('option', { text, attr: { value } }); return this; }
	setValue(value: string): this { this.selectEl.value = value; return this; }
	onChange(callback: (value: string) => void): this { this.selectEl.addEventListener('change', () => callback(this.selectEl.value)); return this; }
}

class ToggleControl {
	readonly inputEl: HTMLInputElement;
	constructor(host: HTMLElement) { this.inputEl = host.createEl('input', { attr: { type: 'checkbox' } }); }
	setValue(value: boolean): this { this.inputEl.checked = value; return this; }
	onChange(callback: (value: boolean) => void): this { this.inputEl.addEventListener('change', () => callback(this.inputEl.checked)); return this; }
}

export class Setting {
	readonly controlEl: HTMLElement;
	readonly settingEl: HTMLElement;
	private readonly description: HTMLElement;
	private readonly row: HTMLElement;
	constructor(host: HTMLElement) { this.row = host.createDiv({ cls: 'setting-item' }); this.settingEl = this.row; this.description = this.row.createEl('p'); this.controlEl = this.row.createDiv({ cls: 'setting-item-control' }); }
	setName(text: string): this { this.row.createEl('label', { text }); return this; }
	setDesc(text: string): this { this.description.textContent = text; return this; }
	setHeading(): this { return this; }
	addText(callback: (control: TextControl) => void): this { callback(new TextControl(this.controlEl)); return this; }
	addButton(callback: (control: ButtonControl) => void): this { callback(new ButtonControl(this.controlEl)); return this; }
	addExtraButton(callback: (control: ButtonControl) => void): this { return this.addButton(callback); }
	addDropdown(callback: (control: DropdownControl) => void): this { callback(new DropdownControl(this.controlEl)); return this; }
	addToggle(callback: (control: ToggleControl) => void): this { callback(new ToggleControl(this.controlEl)); return this; }
	addColorPicker(callback: (control: TextControl) => void): this { const control = new TextControl(this.controlEl); control.inputEl.type = 'color'; callback(control); return this; }
}

if (typeof HTMLElement !== 'undefined') {
	HTMLElement.prototype.addClass = function (...classes: string[]): void { this.classList.add(...classes); };
	HTMLElement.prototype.empty = function (): void { this.replaceChildren(); };
	HTMLElement.prototype.setText = function (text: string): void { this.textContent = text; };
	HTMLElement.prototype.createEl = function (this: HTMLElement, tag: string, options?: { text?: string; cls?: string; attr?: Record<string, string> }): HTMLElement {
		// Implements the host DOM helper in this test adapter.
		const element = this.ownerDocument.createElement(tag);
		if (options?.text) element.textContent = options.text;
		if (options?.cls) element.className = options.cls;
		for (const [name, value] of Object.entries(options?.attr ?? {})) element.setAttribute(name, value);
		this.append(element);
		return element;
	} as typeof HTMLElement.prototype.createEl;
	HTMLElement.prototype.createDiv = function (this: HTMLElement, options?: { cls?: string; attr?: Record<string, string> }): HTMLDivElement {
		// Implements the helper; calling itself would recurse.
		return this.createEl('div', options);
	};
	HTMLElement.prototype.createSpan = function (this: HTMLElement, options?: { text?: string; cls?: string; attr?: Record<string, string> }): HTMLSpanElement {
		// Implements the helper; calling itself would recurse.
		return this.createEl('span', options);
	};
}
