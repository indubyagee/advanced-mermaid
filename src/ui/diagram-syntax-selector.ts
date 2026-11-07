import { Component } from 'obsidian';
import { DIAGRAM_SYNTAX, selectedDiagram, type DiagramSyntax } from '../editor/syntax/catalog';
import { diagramComponents } from '../editor/syntax/components';
import { diagramDeclaration } from '../editor/syntax/source';
import type { SyntaxSnippet } from '../editor/syntax/snippet';

interface SyntaxActions {
	diagram(diagram: DiagramSyntax): void;
	component(component: SyntaxSnippet): void;
	configuration(diagram: DiagramSyntax): void;
}

/** The editor owns this component so every toolbar listener is removed on teardown. */
export class DiagramSyntaxSelector extends Component {
	private diagram?: DiagramSyntax;
	private choices: readonly SyntaxSnippet[] = [];
	private diagrams!: HTMLSelectElement;
	private components!: HTMLSelectElement;
	private configuration!: HTMLButtonElement;

	constructor(private readonly host: HTMLElement, private readonly source: () => string, private readonly actions: SyntaxActions) { super(); }

	onload(): void {
		this.host.className = 'advanced-mermaid-syntax-selector';
		const diagramLabel = this.host.createEl('label', { text: 'Diagram' });
		this.diagrams = diagramLabel.createEl('select', { attr: { 'aria-label': 'Diagram type', title: 'Update the declaration while keeping existing diagram content.' } });
		this.diagrams.createEl('option', { text: 'Select a diagram', attr: { value: '' } });
		for (const diagram of DIAGRAM_SYNTAX) this.diagrams.createEl('option', { text: diagram.label, attr: { value: diagram.declaration } });
		const componentLabel = this.host.createEl('label', { text: 'Component' });
		this.components = componentLabel.createEl('select', { attr: { 'aria-label': 'Insert diagram component', title: 'Insert syntax at the current source position, replacing any selection.' } });
		this.configuration = this.host.createEl('button', { text: 'Insert configuration', attr: { type: 'button', title: 'Add missing frontmatter configuration keys. Existing values are kept. Pele supports a subset of Mermaid configuration.' } });
		this.registerDomEvent(this.diagrams, 'change', () => {
			const diagram = DIAGRAM_SYNTAX.find(choice => choice.declaration === this.diagrams.value);
			if (diagram) this.actions.diagram(diagram);
			this.refresh();
		});
		this.registerDomEvent(this.components, 'change', () => {
			const component = this.components.value ? this.choices[Number(this.components.value)] : undefined;
			if (component) this.actions.component(component);
			this.components.value = '';
		});
		this.registerDomEvent(this.configuration, 'click', () => { if (this.diagram) this.actions.configuration(this.diagram); });
		this.refresh(true);
	}

	refresh(force = false): void {
		if (!this.diagrams) return;
		let diagram: DiagramSyntax | undefined;
		try { diagram = selectedDiagram(diagramDeclaration(this.source()).text); } catch { /* Keep incomplete frontmatter editable. */ }
		this.diagrams.value = diagram?.declaration ?? '';
		if (!force && diagram === this.diagram) return;
		this.diagram = diagram;
		this.choices = diagram ? diagramComponents(diagram) : [];
		this.components.empty(); this.components.createEl('option', { text: 'Select a component', attr: { value: '' } });
		const groups = new Map<string, HTMLOptGroupElement>();
		this.choices.forEach((component, index) => {
			let group = groups.get(component.group);
			if (!group) { group = this.components.createEl('optgroup', { attr: { label: component.group } }); groups.set(component.group, group); }
			group.createEl('option', { text: component.label, attr: { value: String(index) } });
		});
		this.components.disabled = !diagram;
		this.configuration.disabled = !diagram;
	}

	setInputMode(mode: 'mermaid' | 'css'): void { this.host.hidden = mode === 'css'; }
	onunload(): void { this.host.empty(); }
}
