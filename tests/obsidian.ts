/** Minimal host adapter for browser integration tests, not an Obsidian emulator. */
import { StateField } from '@codemirror/state';
import { parseDocument, stringify } from 'yaml';
import type { SettingDefinitionItem, SettingDefinitionGroup, SettingDefinitionPage, SettingGroup } from 'obsidian';
export const editorLivePreviewField = StateField.define<boolean>({ create: () => true, update: value => value });
export const editorInfoField = StateField.define<{ file: { path: string }; editor?: unknown }>({ create: () => ({ file: { path: 'InlineEditor.md' } }), update: value => value });
export function parseYaml(source: string): unknown {
	const doc = parseDocument(source, { schema: 'core', merge: false, uniqueKeys: true });
	const issue = doc.errors[0] ?? doc.warnings.find(warning => warning.code === 'TAG_RESOLVE_FAILED');
	if (issue) throw issue;
	return doc.contents === null ? undefined : doc.toJS();
}
export function stringifyYaml(value: unknown): string { return stringify(value, { aliasDuplicateObjects: false }); }
export class MarkdownRenderChild {
	private cleanup: (() => void)[] = [];
	constructor(readonly containerEl: HTMLElement) {}
	register(callback: () => void): void { this.cleanup.push(callback); }
	registerDomEvent(element: EventTarget, name: string, callback: EventListener, options?: boolean | AddEventListenerOptions): void {
		element.addEventListener(name, callback, options);
		this.register(() => element.removeEventListener(name, callback, options));
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
	private visibility = new Map<HTMLElement, NonNullable<SettingDefinitionItem['visible']>>();
	constructor(readonly app: unknown, _plugin: unknown) {}
	getSettingDefinitions(): SettingDefinitionItem[] { return []; }
	display(): void { this.update(); }
	/** A fixture renderer for public definitions; native navigation/search need host tests. */
	update(): void {
		for (const cleanup of this.disposers.splice(0)) cleanup();
		this.visibility.clear();
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
		const track = (element: HTMLElement, item: SettingDefinitionItem): void => {
			if (item.visible !== undefined) this.visibility.set(element, item.visible);
		};
		const render = (definitions: SettingDefinitionItem[], host: HTMLElement): void => {
			const description = (value: string | DocumentFragment | undefined): string => typeof value === 'string' ? value : value?.textContent ?? '';
			for (const item of definitions) {
				if ('type' in item && (item.type === 'group' || item.type === 'list')) {
					const group = item as SettingDefinitionGroup;
					const groupEl = host.createDiv();
					track(groupEl, group);
					if (group.heading) groupEl.createEl('h3', { text: group.heading });
					render(group.items ?? [], groupEl);
					continue;
				}
				if ('type' in item && item.type === 'page') {
					const row = new Setting(host).setName(item.name).setDesc(description(item.desc));
					track(row.settingEl, item);
					row.addButton(button => button.setButtonText('Open').onClick(() => { this.path.push(item.name); this.update(); }));
					continue;
				}
				if (!('name' in item)) continue;
				const row = new Setting(host).setName(item.name).setDesc(description(item.desc));
				track(row.settingEl, item);
				if ('render' in item && item.render) { const cleanup = item.render(row as unknown as import('obsidian').Setting, {} as SettingGroup); if (cleanup) this.disposers.push(cleanup); }
			}
		};
		render(items, this.containerEl);
		this.refreshDomState();
	}
	refreshDomState(): void {
		for (const [element, visible] of this.visibility) element.hidden = !(typeof visible === 'function' ? visible() : visible);
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

export function setIcon(element: HTMLElement, icon: string): void { element.dataset.icon = icon; }

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

export function installDomHelpers(view: typeof window): void {
	view.HTMLElement.prototype.addClass = function (...classes: string[]): void { this.classList.add(...classes); };
	view.HTMLElement.prototype.empty = function (): void { this.replaceChildren(); };
	view.HTMLElement.prototype.setText = function (text: string): void { this.textContent = text; };
	view.HTMLElement.prototype.onWindowMigrated = function (listener): () => void {
		const migrated = (): void => { listener(this.ownerDocument.defaultView!); };
		this.addEventListener('fixture-window-migrated', migrated);
		return () => this.removeEventListener('fixture-window-migrated', migrated);
	};
	view.createFragment = view.document.createDocumentFragment.bind(view.document);

	function create<K extends keyof HTMLElementTagNameMap>(parent: Node, tag: K, options?: DomElementInfo | string,
		callback?: (element: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K] {
		const info = typeof options === 'string' ? { cls: options } : options;
		const doc = parent.ownerDocument ?? view.document;
		// The mock DOM helpers are backed by the browser's native factories.
		const element = doc.createElement(tag);
		if (typeof info?.text === 'string') element.textContent = info.text;
		else if (info?.text) element.append(info.text);
		if (info?.cls) element.className = Array.isArray(info.cls) ? info.cls.join(' ') : info.cls;
		if (info?.title) element.title = info.title;
		for (const [name, value] of Object.entries(info?.attr ?? {})) element.setAttribute(name, String(value));
		callback?.(element);
		parent.appendChild(element);
		return element;
	}

	view.Node.prototype.createEl = function (tag, options, callback) {
		return create(this, tag, options, callback);
	};
	view.Node.prototype.createDiv = function (options, callback) {
		return create(this, 'div', options, callback);
	};
	view.Node.prototype.createSpan = function (options, callback) {
		return create(this, 'span', options, callback);
	};
}

if (typeof window !== 'undefined') installDomHelpers(window);
