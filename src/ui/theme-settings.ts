import { Setting, type ColorComponent, type TextComponent } from 'obsidian';
import { COLOR_FIELDS, validThemeValue, type AdvancedMermaidSettings, type ThemeField } from '../settings';
import { applyTheme, TOKENS } from '../rendering/theme';

const LABELS: Record<ThemeField, string> = {
	text: 'Text color', background: 'Canvas background', accent: 'Accent', line: 'Edge color',
	nodeFill: 'Node fill', nodeBorder: 'Node border', nodeText: 'Node text',
	edgeLabelFill: 'Edge label background', edgeLabelText: 'Edge label text', edgeLabelBorder: 'Edge label border',
	subgraphFill: 'Subgraph fill', subgraphBorder: 'Subgraph border', subgraphText: 'Subgraph text',
	nodeBorderWidth: 'Node border width', edgeWidth: 'Edge width', edgeLabelBorderWidth: 'Edge label border width', subgraphBorderWidth: 'Subgraph border width',
	font: 'Font', monospace: 'Monospace font', labelSize: 'Base label size',
};

const GROUPS: { name: string; fields: ThemeField[] }[] = [
	{ name: 'Canvas and text', fields: ['text', 'background', 'accent'] },
	{ name: 'Nodes', fields: ['nodeFill', 'nodeBorder', 'nodeBorderWidth', 'nodeText'] },
	{ name: 'Edges', fields: ['line', 'edgeWidth', 'edgeLabelFill', 'edgeLabelText', 'edgeLabelBorder', 'edgeLabelBorderWidth'] },
	{ name: 'Subgraphs', fields: ['subgraphFill', 'subgraphBorder', 'subgraphBorderWidth', 'subgraphText'] },
	{ name: 'Typography', fields: ['font', 'monospace', 'labelSize'] },
];

const INHERITED: Partial<Record<ThemeField, string>> = {
	nodeFill: '--pele-surface', nodeBorder: '--pele-border', nodeText: '--pele-fg',
	edgeLabelFill: '--pele-bg', edgeLabelText: '--pele-fg', subgraphFill: '--pele-surface-alt', subgraphBorder: '--pele-border', subgraphText: '--pele-muted',
};

function currentColor(host: HTMLElement, field: ThemeField): string {
	const computed = host.ownerDocument.defaultView!.getComputedStyle(host);
	return swatch(computed.getPropertyValue(TOKENS[field]).trim() || computed.getPropertyValue(INHERITED[field] ?? '').trim());
}

/** Native color controls are opaque; retain alpha from hex text when changing RGB. */
export function pickedColor(rgb: string, previous: string): string {
	if (/^#[\da-f]{4}$/i.test(previous)) return rgb + previous[4]!.repeat(2);
	return /^#[\da-f]{8}$/i.test(previous) ? rgb + previous.slice(7) : rgb;
}

function swatch(value: string): string {
	if (/^#[\da-f]{3,4}$/i.test(value)) return '#' + [...value.slice(1, 4)].map(char => char.repeat(2)).join('');
	if (/^#[\da-f]{6,8}$/i.test(value)) return value.slice(0, 7);
	const channels = value.match(/[\d.]+/g);
	return value.startsWith('rgb') && channels && channels.length >= 3
		? '#' + channels.slice(0, 3).map(channel => Math.round(Number(channel)).toString(16).padStart(2, '0')).join('') : '#808080';
}

export function themeSettings(host: HTMLElement, settings: AdvancedMermaidSettings, changed: () => void, refresh: () => void): void {
	host.addClass('advanced-mermaid-settings');
	applyTheme(host, settings.theme);
	new Setting(host).setName('Theme').setHeading();
	host.createEl('p', { text: 'Empty values follow the theme. Diagram-authored styles take precedence. Palette classes use their own fills and borders.' });
	for (const group of GROUPS) {
		new Setting(host).setName(group.name).setHeading();
		for (const field of group.fields) themeControl(host, field, settings, changed, refresh);
	}
}

function themeControl(host: HTMLElement, field: ThemeField, settings: AdvancedMermaidSettings, changed: () => void, refresh: () => void): void {
		const color = (COLOR_FIELDS as readonly string[]).includes(field);
		const font = field === 'font' || field === 'monospace';
		const description = color ? (field === 'accent' ? 'Used by renderer accents; node and subgraph fills have separate controls.' : 'Hex color; optional alpha. Reset to follow the theme.')
			: field === 'monospace' ? 'For code-styled labels and renderer-specific monospace content; plain flowchart labels use Font.'
				: font ? 'Local font family names, such as Arial, sans-serif.'
					: field === 'labelSize' ? 'Measured base label size, such as 16px or 10pt. Secondary labels use the renderer’s relative size.' : '0px to 20px. Empty uses the renderer default; authored widths take precedence.';
		const row = new Setting(host).setName(LABELS[field]).setDesc(description);
		let picker: ColorComponent | undefined;
		let text: TextComponent;
		const accept = (value: string): void => {
			if (value) settings.theme[field] = value;
			else delete settings.theme[field];
			applyTheme(host, settings.theme);
			changed();
		};
		row.addText(input => {
			text = input;
			input.inputEl.setAttribute('aria-label', LABELS[field]);
			input.setValue(settings.theme[field] ?? '').onChange(raw => {
				const value = raw.trim();
				const valid = validThemeValue(field, value);
				input.inputEl.setCustomValidity(valid ? '' : 'Enter a valid value.');
				input.inputEl.setAttribute('aria-invalid', String(!valid));
				row.setDesc(valid ? description : `Invalid value. ${description}`);
				if (!valid) return;
				accept(value);
				if (picker) picker.setValue(currentColor(host, field));
			});
		});
		if (color) row.addColorPicker(input => {
			picker = input;
			input.setValue(currentColor(host, field)).onChange(rgb => {
				const value = pickedColor(rgb, settings.theme[field] ?? '');
				text.setValue(value);
				text.inputEl.setCustomValidity(''); text.inputEl.setAttribute('aria-invalid', 'false');
				row.setDesc(description);
				accept(value);
			});
		});
		row.controlEl.querySelector('input[type="color"]')?.setAttribute('aria-label', `${LABELS[field]} picker`);
		row.addExtraButton(button => button.setIcon('rotate-ccw').setTooltip('Follow theme').onClick(() => { delete settings.theme[field]; changed(); refresh(); }));
}
