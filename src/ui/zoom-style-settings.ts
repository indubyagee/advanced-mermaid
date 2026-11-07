import type { SettingDefinitionItem } from 'obsidian';
import type { ZoomStyleSettings, ZoomColor } from '../styles/zoom-style';
import { ZOOM_COLORS } from '../styles/zoom-style';
import { colorPairDefinition, rowDefinition } from './setting-controls';

export function zoomStyleDefinitions(zoom: ZoomStyleSettings, changed: () => void, refresh: () => void): SettingDefinitionItem {
	return { type: 'group', heading: 'Zoom', items: [
		rowDefinition('Use global styles', 'Use inherited diagram and editor colors. Turn off to apply independent Zoom colors; custom choices are retained.', row => row.addToggle(input => input.setValue(zoom.useGlobal).onChange(value => { zoom.useGlobal = value; changed(); refresh(); }))),
		...([
			['border', 'Border color'], ['text', 'Font color'], ['background', 'Background color'],
		] as const).map(([key, name]: readonly [ZoomColor, string]) => ({
			...colorPairDefinition(name, 'Override all diagram and editor colors on the Zoom controls. Empty values use Obsidian interface colors.', () => zoom.colors[key], pair => {
				if (pair) zoom.colors[key] = pair; else delete zoom.colors[key]; changed();
			}, ZOOM_COLORS[key].inherited, 'Zoom ' + name.toLowerCase()), visible: () => !zoom.useGlobal,
		})),
	] };
}
