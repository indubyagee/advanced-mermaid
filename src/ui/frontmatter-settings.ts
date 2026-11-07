import type { SettingDefinition } from 'obsidian';
import { parseFrontmatter } from '../styles/frontmatter';
import { DIAGRAM_REGISTRY, type DiagramCategory, type TypeStyleProfile } from '../styles/registry';
import { rowDefinition } from './setting-controls';

export function frontmatterDefinitions(category: DiagramCategory, profile: TypeStyleProfile, changed: () => void): SettingDefinition[] {
	const settings = profile.frontmatter ?? { enabled: false, yaml: '' };
	const commit = (): void => { profile.frontmatter = settings; changed(); };
	return [
		rowDefinition('Use custom frontmatter', 'Apply saved frontmatter to every ' + DIAGRAM_REGISTRY[category].label + ' diagram. Source-block values override matching defaults. Independent of Use global styles.', row => row.addToggle(input => {
			input.setValue(settings.enabled).onChange(value => { settings.enabled = value; commit(); });
		})),
		rowDefinition('Custom frontmatter', 'Enter YAML with title and config keys, with optional --- delimiters. Valid changes save automatically; disabling retains them. Pele determines which options take effect.', row => {
			row.settingEl.addClass('advanced-mermaid-frontmatter-row');
			const host = row.controlEl.createDiv({ cls: 'advanced-mermaid-frontmatter' });
			const input = host.createEl('textarea', { attr: { 'aria-label': DIAGRAM_REGISTRY[category].label + ' frontmatter', spellcheck: 'false', rows: '8' } });
			input.placeholder = 'config:\n  ' + category + ': {}';
			input.value = settings.yaml;
			const status = host.createDiv({ attr: { role: 'status', 'aria-live': 'polite' } });
			const validate = (): boolean => {
				try {
					parseFrontmatter(input.value); input.setCustomValidity(''); input.setAttribute('aria-invalid', 'false'); status.textContent = ''; return true;
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					input.setCustomValidity(message); input.setAttribute('aria-invalid', 'true'); status.textContent = 'Not saved. ' + message; return false;
				}
			};
			input.addEventListener('input', () => { if (validate()) { settings.yaml = input.value; commit(); } });
			validate();
		}),
	];
}
