import { type Setting, type SettingDefinition } from 'obsidian';
import { normalizeColor } from '../styles/colors';
import type { ColorPair } from '../styles/registry';
import { pickedColor } from './theme-settings';

export const rowDefinition = (name: string, desc: string, build: (row: Setting) => unknown): SettingDefinition => ({ name, desc, render: row => { const cleanup = build(row); return typeof cleanup === 'function' ? cleanup as () => void : undefined; } });

/** The native picker edits RGB while the literal text field retains alpha. */
export function colorInput(host: HTMLElement, name: string, get: () => string | undefined, accept: (value?: string) => void, variable?: string, label = name): () => void {
	const group = host.createDiv({ cls: 'advanced-mermaid-color-input' });
	group.createSpan({ text: label, cls: 'advanced-mermaid-control-label' });
	const win = host.ownerDocument.defaultView!;
	const inherited = (): string => normalizeColor(variable ? win.getComputedStyle(host).getPropertyValue(variable).trim() : '') ?? '#808080';
	const picker = group.createEl('input', { attr: { type: 'color', 'aria-label': name + ' picker' } });
	const text = group.createEl('input', { attr: { type: 'text', 'aria-label': name, placeholder: 'Inherit', spellcheck: 'false' } });
	const reset = group.createEl('button', { text: '↺', attr: { type: 'button', 'aria-label': 'Reset ' + name, title: 'Use inherited color' } });
	const swatch = (): void => { picker.value = (normalizeColor(get() ?? '') ?? inherited()).slice(0, 7); };
	const show = (): void => { text.value = get() ?? ''; swatch(); text.setCustomValidity(''); text.setAttribute('aria-invalid', 'false'); };
	text.addEventListener('input', () => {
		const raw = text.value.trim(); const value = raw ? normalizeColor(raw) : undefined;
		const valid = value !== null; text.setAttribute('aria-invalid', String(!valid));
		text.setCustomValidity(valid ? '' : 'Use hex, RGB/RGBA or HSL/HSLA, or leave empty to inherit.');
		if (valid) { accept(value); swatch(); }
	});
	picker.addEventListener('input', () => { accept(pickedColor(picker.value, get() ?? '')); show(); });
	reset.addEventListener('click', () => { accept(undefined); show(); });
	show();
	// Native pages may build rows before attachment. Resolve inherited CSS once
	// mounted, without replacing a draft or clearing its validation state.
	const frame = win.requestAnimationFrame(() => { if (group.isConnected) swatch(); });
	return () => win.cancelAnimationFrame(frame);
}

export function colorPairDefinition(name: string, desc: string, get: () => ColorPair | undefined, accept: (pair?: ColorPair) => void, variable?: string, controlName = name): SettingDefinition {
	return rowDefinition(name, desc + ' Light and dark inherit independently. Supports hex, RGB and HSL with alpha.', row => {
		row.settingEl.addClass('advanced-mermaid-color-row');
		const cleanups: (() => void)[] = [];
		let select: HTMLSelectElement;
		row.addDropdown(input => {
			select = input.selectEl; input.selectEl.setAttribute('aria-label', controlName + ' color source');
			input.addOptions({ inherit: 'Use inherited colors', custom: 'Custom colors' }).setValue(get() ? 'custom' : 'inherit').onChange(value => {
				if (value === 'inherit') { accept(undefined); cleanups.splice(0).forEach(cleanup => cleanup()); fields.empty(); mount(); }
			});
		});
		const fields = row.controlEl.createDiv({ cls: 'advanced-mermaid-color-pair' });
		const mount = (): void => {
			for (const mode of ['light', 'dark'] as const) cleanups.push(colorInput(fields, controlName + (mode === 'light' ? ' Light' : ' Dark'), () => get()?.[mode], value => {
				const pair = { ...get() }; if (value) pair[mode] = value; else delete pair[mode];
				const result = Object.keys(pair).length ? pair : undefined; accept(result); select.value = result ? 'custom' : 'inherit';
			}, variable, mode === 'light' ? 'Light' : 'Dark'));
		};
		mount();
		return () => cleanups.splice(0).forEach(cleanup => cleanup());
	});
}

export interface NumberControl { min: number; max: number; step?: number; optional?: boolean; fallback: number; unit?: string }
export function numberDefinition(name: string, desc: string, get: () => number | null | undefined, accept: (value: number | undefined) => void, options: NumberControl): SettingDefinition {
	return rowDefinition(name, desc, row => numberControl(row, name, get, accept, options));
}
export function numberControl(row: Setting, name: string, get: () => number | null | undefined, accept: (value: number | undefined) => void, options: NumberControl): void {
	row.settingEl.addClass('advanced-mermaid-number-row');
	const { min, max, optional, fallback } = options;
	const text = row.controlEl.createEl('input', { attr: { type: 'number', min: String(min), max: String(max), step: options.step === 1 ? '1' : 'any', 'aria-label': name, placeholder: optional ? 'Inherit' : String(fallback) } });
	const slider = row.controlEl.createEl('input', { attr: { type: 'range', min: String(min), max: String(max), step: String(options.step ?? .1), 'aria-label': name + ' slider' } });
	if (options.unit) row.controlEl.createSpan({ text: options.unit });
	const reset = row.controlEl.createEl('button', { text: '↺', attr: { type: 'button', 'aria-label': 'Reset ' + name, title: optional ? 'Use inherited value' : 'Restore default' } });
	const show = (): void => { const value = get(); text.value = value == null ? '' : String(value); slider.value = String(Math.min(max, Math.max(min, value ?? fallback))); text.setCustomValidity(''); text.setAttribute('aria-invalid', 'false'); };
	text.addEventListener('input', () => {
		const raw = text.value; const value = Number(raw);
		const valid = !text.validity.badInput && (raw === '' ? optional === true : Number.isFinite(value) && value >= min && value <= max && (options.step === 1 ? /^\d+$/.test(raw) : /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)));
		text.setAttribute('aria-invalid', String(!valid)); text.setCustomValidity(valid ? '' : `Use ${min}–${max}${options.unit ?? ''}${optional ? ', or leave empty to inherit' : ''}.`);
		if (valid) { accept(raw === '' ? undefined : value); slider.value = String(raw === '' ? fallback : value); }
	});
	slider.addEventListener('input', () => { accept(Number(slider.value)); show(); });
	reset.addEventListener('click', () => { accept(optional ? undefined : fallback); show(); });
	show();
}
