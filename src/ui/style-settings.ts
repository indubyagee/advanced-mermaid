import type { SettingDefinitionItem, SettingDefinition } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { DIAGRAM_CATEGORIES, DIAGRAM_REGISTRY, emptyStyleProfile, type DiagramCategory } from '../styles/registry';
import { profileDefinitions } from './profile-controls';
import { rowDefinition } from './setting-controls';
import { frontmatterDefinitions } from './frontmatter-settings';

export class StylePages {
	private selected?: DiagramCategory;
	private readonly undo = new Map<string, () => void>();
	constructor(private readonly settings: AdvancedMermaidSettings, private readonly changed: () => void, private readonly refresh: () => void) {}
	endSession(): void { this.undo.clear(); }

	globalDefinitions(): SettingDefinitionItem[] {
		const settings = this.settings;
		return [...profileDefinitions(settings.style.global, () => { settings.theme = {}; this.changed(); }, true), ...this.reset('global', 'Reset global styles', () => {
			const previous = settings.style.global; const legacy = settings.theme; settings.style.global = emptyStyleProfile(); settings.theme = {};
			return () => { settings.style.global = previous; settings.theme = legacy; };
		})];
	}
	diagrams(): SettingDefinitionItem[] {
		const settings = this.settings;
		const selection = rowDefinition('Diagram selection', 'Select one diagram family to view its inherited styles and specialized controls.', row => row.addDropdown(input => {
			input.selectEl.setAttribute('aria-label', 'Diagram selection'); input.addOptions({ '': 'Select a diagram', ...Object.fromEntries(DIAGRAM_CATEGORIES.map(key => [key, DIAGRAM_REGISTRY[key].label])) }).setValue(this.selected ?? '').onChange(value => {
				this.selected = DIAGRAM_CATEGORIES.find(key => key === value); this.refresh();
			});
		}));
		return [selection, ...DIAGRAM_CATEGORIES.flatMap(category => {
			const profile = settings.style.diagrams[category] ?? { useGlobal: true, overrides: emptyStyleProfile() };
			const changed = (): void => { settings.style.diagrams[category] = profile; this.changed(); };
			return [{ type: 'group' as const, heading: DIAGRAM_REGISTRY[category].label, visible: () => this.selected === category, items: [
				rowDefinition('Use global styles', 'Bypass this family’s overrides without deleting them.', row => row.addToggle(input => input.setValue(profile.useGlobal).onChange(value => { profile.useGlobal = value; settings.style.diagrams[category] = profile; this.changed(); this.refresh(); }))),
				...frontmatterDefinitions(category, profile, changed),
				...this.reset(category, 'Reset this diagram type', () => { const previous = settings.style.diagrams[category]; delete settings.style.diagrams[category]; return () => { if (previous) settings.style.diagrams[category] = previous; else delete settings.style.diagrams[category]; }; }),
			] }, ...profileDefinitions(profile.overrides, () => { settings.style.diagrams[category] = profile; this.changed(); }, category === 'flowchart', category).map(group => ({ ...group, visible: () => this.selected === category && !profile.useGlobal }))];
		})];
	}
	private reset(scope: string, name: string, apply: () => () => void): SettingDefinition[] {
		const rows = [rowDefinition(name, 'Clear only this scope. Other diagram types, display settings and note overrides remain. Undo is available during this settings session.', row => row.addButton(button => button.setButtonText('Reset').onClick(() => { this.undo.set(scope, apply()); this.changed(); this.refresh(); })))];
		if (this.undo.has(scope)) rows.push(rowDefinition('Styles reset', 'Restore the previous values in this scope.', row => row.addButton(button => button.setButtonText('Undo reset').onClick(() => { this.undo.get(scope)?.(); this.undo.delete(scope); this.changed(); this.refresh(); }))));
		return rows;
	}
}
