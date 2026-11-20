import { Component } from 'obsidian';
import { DIAGRAM_SYNTAX, type DiagramSyntax, type OrientationSyntax } from '../editor/syntax/catalog';
import { diagramComponents } from '../editor/syntax/components';
import { diagramDeclaration, diagramOrientation } from '../editor/syntax/source';
import type { SyntaxSnippet } from '../editor/syntax/snippet';

interface SyntaxActions {
	diagram(diagram: DiagramSyntax, orientation?: string): void;
	component(component: SyntaxSnippet): void;
	configuration(diagram: DiagramSyntax): void;
	pending(value: boolean): void;
}

/** The editor owns this component so every toolbar listener is removed on teardown. */
export class DiagramSyntaxSelector extends Component {
	private diagram?: DiagramSyntax;
	private authoredDiagram?: DiagramSyntax;
	private pending?: { diagram: DiagramSyntax; source: string };
	private orientationRule?: OrientationSyntax;
	private choices: readonly SyntaxSnippet[] = [];
	private diagrams!: HTMLSelectElement;
	private orientations!: HTMLSelectElement;
	private components!: HTMLSelectElement;
	private configuration!: HTMLButtonElement;
	private docs!: HTMLButtonElement;

	constructor(private readonly host: HTMLElement, private readonly source: () => string, private readonly actions: SyntaxActions) { super(); }

	onload(): void {
		this.host.className = 'advanced-mermaid-syntax-selector';
		const diagramLabel = this.host.createEl('label', { text: 'Diagram' });
		this.diagrams = diagramLabel.createEl('select', { attr: { 'aria-label': 'Diagram type', title: 'Update the declaration while keeping existing diagram content.' } });
		this.diagrams.createEl('option', { text: 'Select a diagram', attr: { value: '' } });
		for (const diagram of DIAGRAM_SYNTAX) this.diagrams.createEl('option', { text: diagram.label, attr: { value: diagram.declaration } });
		const orientationLabel = this.host.createEl('label', { text: 'Orientation' });
		this.orientations = orientationLabel.createEl('select', { attr: { 'aria-label': 'Orientation', title: 'Choose the direction for this diagram.' } });
		this.orientations.createEl('option', { text: '', attr: { value: '' } });
		const componentLabel = this.host.createEl('label', { cls: 'advanced-mermaid-component-field', text: 'Component' });
		this.components = componentLabel.createEl('select', { attr: { 'aria-label': 'Insert diagram component', title: 'Insert syntax at the current source position, replacing any selection.' } });
		this.configuration = this.host.createEl('button', { text: 'Insert configuration', attr: { type: 'button', title: 'Add missing frontmatter configuration keys. Existing values are kept. Pele supports a subset of Mermaid configuration.' } });
		this.docs = this.host.createEl('button', { text: 'Syntax Docs', attr: { type: 'button', title: 'Open official syntax documentation.' } });
		this.registerDomEvent(this.diagrams, 'change', () => {
			const diagram = DIAGRAM_SYNTAX.find(choice => choice.declaration === this.diagrams.value);
			this.pending = diagram?.orientation && diagram !== this.authoredDiagram ? { diagram, source: this.source() } : undefined;
			if (diagram && !diagram.orientation && diagram !== this.authoredDiagram) this.actions.diagram(diagram);
			this.refresh();
		});
		this.registerDomEvent(this.orientations, 'change', () => {
			const value = this.orientations.value;
			const pending = this.pending;
			const diagram = pending?.diagram ?? this.authoredDiagram;
			if (diagram?.orientation?.values.includes(value) && (!pending || pending.source === this.source())) {
				this.actions.diagram(diagram, value);
			}
			this.refresh();
		});
		this.registerDomEvent(this.components, 'change', () => {
			const component = !this.components.disabled && this.components.value ? this.choices[Number(this.components.value)] : undefined;
			if (component) this.actions.component(component);
			this.components.value = '';
		});
		this.registerDomEvent(this.configuration, 'click', () => { if (this.diagram) this.actions.configuration(this.diagram); });
		this.registerDomEvent(this.docs, 'click', () => {
			const diagram = this.pending?.diagram ?? this.authoredDiagram;
			if (diagram && !this.host.hidden) this.host.ownerDocument.defaultView?.open(diagram.syntaxDocs, '_blank', 'noopener,noreferrer');
		});
		this.refresh(true);
	}

	refresh(force = false): void {
		if (!this.diagrams) return;
		const source = this.source();
		if (this.pending && this.pending.source !== source) this.pending = undefined;
		let authored: DiagramSyntax | undefined;
		let orientation: string | undefined;
		try {
			const declaration = diagramDeclaration(source);
			authored = declaration.diagram;
			orientation = diagramOrientation(source, declaration);
		} catch { /* Keep incomplete frontmatter editable. */ }
		this.authoredDiagram = authored;
		const selected = this.pending?.diagram ?? authored;
		const rule = selected?.orientation;
		this.diagrams.value = selected?.declaration ?? '';
		this.docs.disabled = !selected;
		if (rule !== this.orientationRule) {
			this.orientationRule = rule;
			this.orientations.empty();
			this.orientations.createEl('option', { text: rule ? 'Select an orientation' : '', attr: { value: '' } });
			for (const value of rule?.values ?? []) {
				const label = value.charAt(0).toUpperCase() + value.slice(1);
				this.orientations.createEl('option', { text: label, attr: { value } });
			}
		}
		this.orientations.disabled = !rule;
		this.orientations.value = this.pending ? '' : orientation ?? '';
		this.actions.pending(!!this.pending);
		const diagram = this.pending ? undefined : authored;
		if (!force && diagram === this.diagram) return;
		this.diagram = diagram;
		this.choices = diagram ? diagramComponents(diagram) : [];
		this.components.empty(); this.components.createEl('option', { text: 'Select a component', attr: { value: '' } });
		const groups = new Map<string, HTMLOptGroupElement>();
		this.choices.forEach((component, index) => {
			let group = groups.get(component.group);
			if (!group) { group = this.components.createEl('optgroup', { attr: { label: component.group } }); groups.set(component.group, group); }
			group.createEl('option', { text: component.label + ': ' + component.text, attr: { value: String(index) } });
		});
		this.components.disabled = !diagram;
		this.configuration.disabled = !diagram;
	}

	setInputMode(mode: 'mermaid' | 'css'): void {
		this.host.hidden = mode === 'css';
		if (mode === 'css' && this.pending) { this.pending = undefined; this.refresh(); }
	}
	onunload(): void { this.host.empty(); }
}
