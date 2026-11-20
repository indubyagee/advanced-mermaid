import type { SettingDefinition } from 'obsidian';
import type { ZoomStyleSettings } from '../styles/zoom-style';
import { ZOOM_COLORS } from '../styles/zoom-style';
import { colorPairDefinition, rowDefinition } from './setting-controls';

export function zoomStyleDefinitions(zoom: ZoomStyleSettings, changed: () => void, refresh: () => void): SettingDefinition[] {
	return [
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
