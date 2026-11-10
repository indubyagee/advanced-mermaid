import type { OverrideOption } from '../editor/override-options';
import type { StyleTarget } from '../editor/override-insertion';

export function overrideSelector(host: HTMLElement, options: () => OverrideOption[], insert: (option: OverrideOption, target: StyleTarget) => void): void {

	const bar = host.createDiv({ cls: 'advanced-mermaid-override-selector' });

	bar.createSpan({ text: 'Local override' });

	const select = bar.createEl(
		'select', { attr: {
				'aria-label': 'Insert local override',
				title: 'Insert a missing override using the current appearance, or select its existing value.'
			}}
	);
	const target = bar.createEl(
		'select', { attr: {
			'aria-label': 'Local style theme',
				title: 'Choose the theme targeted by a style override. Inherited colors use the current appearance.'
			}}
	);

	for (const [value, label] of [
		['both', 'Both themes'],
		['light', 'Light'],
		['dark', 'Dark']
	]) target.createEl('option', { text: label, attr: { value: value! } }
	);

	let choices: OverrideOption[] = [];

	const refresh = (): void => {
		choices = options(); select.empty(); select.createEl('option', { text: 'Select an override', attr: { value: '' } });

		for (const kind of ['display', 'style'] as const) {
			const group = select.createEl('optgroup', { attr: { label: kind === 'display' ? 'Display' : 'Style' } });
			for (const choice of choices.filter(choice => choice.kind === kind)) group.createEl('option', { text: choice.label, attr: { value: choice.id } });
		}
	};
	select.addEventListener('focus', refresh);

	select.addEventListener('change', () => { const choice = choices.find(choice => choice.id === select.value); if (choice) insert(choice, target.value as StyleTarget); select.value = ''; });

	refresh();
}
