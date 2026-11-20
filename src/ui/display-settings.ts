import type { App, DropdownComponent, SettingDefinition } from 'obsidian';
import { isAlignment, type AdvancedMermaidSettings } from '../settings';
import { HEIGHT_PRESETS, NATIVE_WIDTH_PRESETS, WIDTH_PRESETS, availableWidthPreset, isWidthPreset, parseHeightSetting } from '../display-settings';
import { minimalEnabled } from '../rendering/minimal-settings';
import { rowDefinition } from './setting-controls';

export function displayDefinitions(app: App, settings: AdvancedMermaidSettings, changed: () => void): SettingDefinition[] {
	const alignmentName = 'Diagram alignment';
	const widthName = 'Diagram max width';
	const heightName = 'Diagram max height';
	return [
		rowDefinition(alignmentName, 'Place the diagram at the left, center or right of its available width.', row => row.addDropdown(input => {
			input.selectEl.setAttribute('aria-label', alignmentName);
			input.addOptions({ left: 'Left', center: 'Center', right: 'Right' }).setValue(settings.alignment).onChange(value => {
				if (isAlignment(value)) { settings.alignment = value; changed(); }
			});
		})),
		{
			aliases: ['diagram width'],
			...rowDefinition(widthName, 'Choose native sizing or an available width preset.', row => {
				const enabled = minimalEnabled(app);
				row.setDesc(enabled
					? 'Default keeps native diagram sizing. Normal, Wide, and Maximum use Minimal Theme Settings. Full Pane uses the usable pane width.'
					: 'Default keeps native diagram sizing. Full uses the full width of the text column.');
				row.addDropdown(input => {
					input.selectEl.setAttribute('aria-label', widthName);
					input.addOptions(enabled ? WIDTH_PRESETS : NATIVE_WIDTH_PRESETS).setValue(availableWidthPreset(settings.maxWidth, enabled)).onChange(value => {
						if (isWidthPreset(value)) { settings.maxWidth = value; changed(); }
					});
				});
			}),
		},
		{
			aliases: ['maximum height'],
			...rowDefinition(heightName, 'By orientation uses no height cap for landscape/square diagrams and medium (50vh) for portrait.', row => {
				let select: DropdownComponent;
				let text: HTMLInputElement;
				const preset = (value: string): string => Object.prototype.hasOwnProperty.call(HEIGHT_PRESETS, value) ? value : 'custom';
				row.addDropdown(input => {
					select = input;
					input.selectEl.setAttribute('aria-label', 'Height preset');
					input.addOptions({ ...HEIGHT_PRESETS, custom: 'Custom' }).setValue(preset(settings.maxHeight)).onChange(value => {
						text.hidden = value !== 'custom';
						settings.maxHeight = value === 'custom' ? '50vh' : value;
						text.value = settings.maxHeight;
						text.setCustomValidity('');
						text.setAttribute('aria-invalid', 'false');
						changed();
					});
				});
				row.addText(input => {
					text = input.inputEl;
					text.hidden = preset(settings.maxHeight) !== 'custom';
					text.setAttribute('aria-label', heightName);
					input.setValue(settings.maxHeight).setPlaceholder('Custom height').onChange(value => {
						const parsed = parseHeightSetting(value);
						text.setCustomValidity(parsed ? '' : 'Use a positive vh, px or rem length, a preset, or none.');
						text.setAttribute('aria-invalid', String(!parsed));
						if (parsed) { settings.maxHeight = parsed; select.setValue(preset(parsed)); changed(); }
					});
				});
				row.addExtraButton(button => button.setIcon('rotate-ccw').setTooltip('Use orientation defaults').onClick(() => {
					settings.maxHeight = 'auto';
					select.setValue('auto');
					text.value = 'auto';
					text.hidden = true;
					text.setCustomValidity('');
					text.setAttribute('aria-invalid', 'false');
					changed();
				}));
			}),
		},
		rowDefinition('Maintain aspect ratio', 'Fit proportionally within the limits. Disable to fit bounded width and height independently.', row => row.addToggle(input => input.setValue(settings.maintainAspectRatio).onChange(value => { settings.maintainAspectRatio = value; changed(); }))),
		rowDefinition('Fill available space', 'Allow smaller diagrams to enlarge to the width and height limits.', row => row.addToggle(input => input.setValue(settings.fillAvailable).onChange(value => { settings.fillAvailable = value; changed(); }))),
	];
}
