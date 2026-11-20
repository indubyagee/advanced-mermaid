import type { SettingDefinitionItem, SettingDefinition, SettingDefinitionPage } from 'obsidian';
import type { AdvancedMermaidSettings } from '../settings';
import { DIAGRAM_CATEGORIES, DIAGRAM_REGISTRY, emptyStyleProfile, type DiagramCategory } from '../styles/registry';
import { profileDefinitions } from './profile-controls';
import { rowDefinition } from './setting-controls';
import { frontmatterDefinitions } from './frontmatter-settings';
import type { SettingsExample } from './settings-example';

type StyleScope = 'global' | DiagramCategory;
type ResetAction = 'reset' | 'undo';

export class StylePages {
	private readonly undo = new Map<StyleScope, () => void>();
	private resetFocus?: { scope: StyleScope; action: ResetAction };
	constructor(private readonly settings: AdvancedMermaidSettings, private readonly example: SettingsExample,
		private readonly changed: () => void, private readonly refresh: () => void, private readonly refreshVisibility: () => void) {}

	endSession(): void {
		this.undo.clear();
		this.resetFocus = undefined;
	}

	globalDefinitions(): SettingDefinitionItem[] {
		const settings = this.settings;
		const example = this.example.definition('global');
		const { groups, categoryColors } = profileDefinitions(settings.style.global, () => {
			settings.theme = {};
			this.changed();
		}, example);
		const reset = this.reset('global', 'Reset shared styles', 'Clear the defaults set on this page.', () => {
			const previous = settings.style.global;
			const legacy = settings.theme;
			const { colors, elements, ...typography } = previous;
			const hadOverrides = Object.keys(legacy).length || Object.keys(colors).length || Object.keys(elements).length
				|| Object.values(typography).some(value => value !== undefined);
			if (!hadOverrides && this.undo.has('global')) return;
			settings.style.global = emptyStyleProfile();
			settings.theme = {};
			return () => { settings.style.global = previous; settings.theme = legacy; };
		});
		return [
			example,
			...groups,
			{ type: 'page', name: 'Advanced', desc: 'Fine-tune category colors and data palettes.', items: [this.example.definition('global', 'treemap'), categoryColors] },
			reset,
		];
	}

	diagrams(): SettingDefinitionPage[] {
		return DIAGRAM_CATEGORIES.map(category => this.diagramPage(category))
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	private diagramPage(category: DiagramCategory): SettingDefinitionPage {
		const profiles = this.settings.style.diagrams;
		const label = DIAGRAM_REGISTRY[category].label;
		const profile = profiles[category] ?? { useGlobal: true, overrides: emptyStyleProfile() };
		const changed = (): void => {
			profiles[category] = profile;
			this.changed();
		};
		const example = this.example.definition(category);
		const { groups, categoryColors } = profileDefinitions(profile.overrides, changed, example, category);
		const describeInheritance = (): string => profile.useGlobal
			? 'Colors, fonts, and shapes inherit from All diagrams. Your custom styles are kept.'
			: 'Customize this diagram type below. Empty values inherit from All diagrams.';
		const customStyles = (): boolean => !profile.useGlobal;
		const reset = this.reset(category, 'Reset ' + label + ' styles', 'Clear style overrides and custom frontmatter for ' + label + '.', () => {
			const previous = profiles[category];
			if (!previous && this.undo.has(category)) return;
			delete profiles[category];
			return () => { if (previous) profiles[category] = previous; else delete profiles[category]; };
		});
		return {
			type: 'page', name: label,
			displayValue: () => customStyles() ? 'Custom styles' : '',
			items: [
				rowDefinition('Use styles from All diagrams', describeInheritance(), row => row.addToggle(input => input
					.setValue(profile.useGlobal).onChange(value => {
						profile.useGlobal = value;
						row.setDesc(describeInheritance());
						changed();
						this.refreshVisibility();
					}))),
				example,
				...groups.map(group => ({ ...group, visible: customStyles })),
				{
					type: 'page', name: 'Advanced', desc: 'Category colors and custom Mermaid frontmatter.',
					items: [
						example,
						{ ...categoryColors, visible: customStyles },
						{ type: 'group', heading: label + ' frontmatter', items: frontmatterDefinitions(category, profile, changed) },
					],
				},
				reset,
			],
		};
	}

	private reset(scope: StyleScope, name: string, desc: string, apply: () => (() => void) | undefined): SettingDefinition {
		return rowDefinition(name, desc, row => {
			const refresh = (action: ResetAction): void => {
				this.resetFocus = { scope, action };
				this.changed();
				this.refresh();
			};
			row.addButton(button => {
				button.setButtonText('Reset').onClick(() => {
					const undo = apply();
					if (!undo) return;
					this.undo.set(scope, undo);
					refresh('undo');
				});
				this.focusAfterReset(button.buttonEl, scope, 'reset');
			});
			const undo = this.undo.get(scope);
			if (undo) {
				row.controlEl.createSpan({ text: 'Styles reset.', attr: { role: 'status' } });
				row.addButton(button => {
					button.setButtonText('Undo reset').onClick(() => {
						undo();
						this.undo.delete(scope);
						refresh('reset');
					});
					this.focusAfterReset(button.buttonEl, scope, 'undo');
				});
			}
		});
	}

	private focusAfterReset(button: HTMLButtonElement, scope: StyleScope, action: ResetAction): void {
		const focus = this.resetFocus;
		if (focus?.scope !== scope || focus.action !== action) return;
		queueMicrotask(() => {
			if (this.resetFocus !== focus || !button.isConnected) return;
			this.resetFocus = undefined;
			button.focus();
		});
	}
}
