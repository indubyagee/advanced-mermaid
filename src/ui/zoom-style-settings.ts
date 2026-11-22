import type { SettingDefinition } from 'obsidian';
import type { ZoomStyleSettings } from '../styles/zoom-style';
import { ZOOM_COLORS, ZOOM_ORIENTATIONS, ZOOM_PLACEMENTS } from '../styles/zoom-style';
import { colorPairDefinition, rowDefinition } from './setting-controls';

export function zoomStyleDefinitions(zoom: ZoomStyleSettings, changed: () => void, refresh: () => void): SettingDefinition[] {
	return [
		rowDefinition('Zoom button placement', 'Choose a corner of the diagram viewport.', row => row.addDropdown(input => {
			input.selectEl.setAttribute('aria-label', 'Zoom button placement');
			input.addOptions(ZOOM_PLACEMENTS).setValue(zoom.placement).onChange(value => {
				zoom.placement = value as ZoomStyleSettings['placement']; changed();
			});
		})),
		rowDefinition('Zoom button orientation', 'Arrange the Zoom buttons in a row or column.', row => row.addDropdown(input => {
			input.selectEl.setAttribute('aria-label', 'Zoom button orientation');
			input.addOptions(ZOOM_ORIENTATIONS).setValue(zoom.orientation).onChange(value => {
				zoom.orientation = value as ZoomStyleSettings['orientation']; changed();
			});
		})),
		{
			...rowDefinition('Use inherited colors', 'Use diagram and editor colors for Zoom controls across all views. Your custom Zoom colors are kept.', row =>
				row.addToggle(input => input.setValue(zoom.useGlobal).onChange(value => { zoom.useGlobal = value; changed(); refresh(); }))),
			aliases: ['zoom colors', 'zoom global styles'],
		},
		...([
			['border', 'Border color'], ['text', 'Font color'], ['background', 'Background color'],
		] as const).map(([key, name]) => ({
			...colorPairDefinition('Zoom ' + name.toLowerCase(), 'Empty values use Obsidian interface colors.', () => zoom.colors[key], pair => {
				if (pair) zoom.colors[key] = pair;
				else delete zoom.colors[key];
				changed();
			}, ZOOM_COLORS[key].inherited),
			aliases: ['zoom colors'],
			visible: () => !zoom.useGlobal,
		})),
	];
}
