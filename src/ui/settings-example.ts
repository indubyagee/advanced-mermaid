import { DiagramController } from '../rendering/controller';
import type { AdvancedMermaidSettings } from '../settings';
import { DIAGRAM_REGISTRY, type DiagramCategory } from '../styles/registry';
import type { App, SettingDefinition } from 'obsidian';
import { rowDefinition } from './setting-controls';

export const styleExampleSources: Readonly<Record<DiagramCategory, string>> = {
	agentflow: 'agentflow-beta LR\n A[Input] --> B[Task]',
	class: 'classDiagram\n  class Book {\n    +String title\n    +lend()\n  }\n  class Reader\n  Reader "1" --> "*" Book : borrows',
	er: 'erDiagram\n  READER ||--o{ LOAN : borrows\n  LOAN }o--|| BOOK : includes\n  BOOK {\n    string title\n  }',
	eventmodeling: 'eventmodeling\n tf 01 cmd Submit',
	flowchart: 'flowchart LR\n subgraph Review\n  A[Draft] -->|Send| B[Publish]\n end',
	gantt: 'gantt\n dateFormat YYYY-MM-DD\n Draft :draft, 2026-01-01, 2d\n Review :after draft, 1d',
	gitGraph: 'gitGraph LR:\n commit\n commit',
	ishikawa: 'ishikawa-beta\nDelay\n  Process\n    Review',
	kanban: 'kanban\n todo[To do]\n  draft[Draft]',
	mindmap: 'mindmap\n root((Project))\n  Plan\n  Review',
	radar: 'radar-beta\n axis A, B, C\n curve Targets{2, 3, 4}',
	requirement: 'requirementDiagram\n  requirement backup {\n    id: 1\n    text: "Keep recoverable copies"\n    risk: medium\n    verifymethod: test\n  }\n  element archive {\n    type: system\n  }\n  archive - satisfies -> backup',
	sequence: 'sequenceDiagram\n Author->>Reviewer: Send draft\n Reviewer-->>Author: Return notes',
	state: 'stateDiagram-v2\n [*] --> Draft\n Draft --> Published',
	swimlane: 'swimlane-beta LR\n subgraph lane [Review]\n A[Read draft] --> B[Send notes]\n end',
	timeline: 'timeline\n 2026 : Plan : Launch',
	treemap: 'treemap-beta\n"Writing"\n  "Plan": 10\n  "Draft": 20\n"Reviewing"\n  "Edit": 15',
	treeView: 'treeView-beta\nproject/\n  plan.md\n  review.md',
	journey: 'journey\n title Publishing\n Draft: 4: Author\n Review: 5: Reviewer',
	usecase: 'usecase-beta\n  actor Reader\n  systemBoundary "Library"\n    Borrow("Borrow book")\n    Renew("Renew loan")\n  end\n  Reader --> Borrow\n  Reader --> Renew',
};

/** One lazily mounted example; hidden/closed settings never retain a renderer. */
export class SettingsExample {
	private active?: { disclosure: HTMLDetailsElement; controller: DiagramController };
	constructor(private readonly app: App, private readonly settings: () => AdvancedMermaidSettings) {}

	definition(scope: 'display' | 'global' | DiagramCategory = 'display', sample?: DiagramCategory): SettingDefinition {
		const category = sample ?? (scope === 'global' || scope === 'display' ? 'flowchart' : scope);
		const label = DIAGRAM_REGISTRY[category].label;
		const description = scope === 'global'
			? 'Preview shared styles on a sample ' + label + ' diagram.'
			: 'Try your settings on a sample ' + label + ' diagram.';
		return {
			...rowDefinition('Example', description, row => {
				row.settingEl.addClass('advanced-mermaid-example-row');
				return this.attach(row.controlEl, styleExampleSources[category], scope === 'global');
			}),
			searchable: false,
		};
	}

	private attach(host: HTMLElement, source: string, sharedOnly: boolean): () => void {
		this.destroy();
		const disclosure = host.createEl('details', { cls: 'advanced-mermaid-settings-example' });
		disclosure.createEl('summary', { text: 'Show example' });
		const preview = disclosure.createDiv();
		const settings = sharedOnly ? () => {
			const settings = this.settings();
			return { ...settings, style: { ...settings.style, diagrams: {} } };
		} : this.settings;
		const update = (): void => {
			if (!disclosure.open) {
				if (this.active?.disclosure === disclosure) this.destroy();
				return;
			}
			if (!disclosure.isConnected || this.active?.disclosure === disclosure) return;
			this.destroy();
			const controller = new DiagramController(preview, source, settings, this.app, '', { boundary: disclosure });
			this.active = { disclosure, controller };
			controller.load();
		};
		disclosure.addEventListener('toggle', update);
		return () => {
			disclosure.removeEventListener('toggle', update);
			if (this.active?.disclosure === disclosure) this.destroy();
		};
	}

	refresh(): void { this.active?.controller.settingsChanged(); }

	destroy(): void {
		const active = this.active;
		if (!active) return;
		this.active = undefined;
		active.disclosure.open = false;
		active.controller.destroy();
	}
}
