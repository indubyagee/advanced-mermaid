import type { DiagramType } from 'pele';
import type { DiagramSyntax } from './catalog';
import { flowchartComponents, agentflowComponents, swimlaneComponents } from './graph-components';
import { sequenceComponents, stateComponents, hierarchyComponents, workflowComponents } from './structured-components';
import { chartComponents } from './chart-components';
import { otherComponents, railroadComponents } from './other-components';
import type { SyntaxSnippet } from './snippet';

const components: Readonly<Record<DiagramType, readonly SyntaxSnippet[]>> = {
	flowchart: flowchartComponents, agentflow: agentflowComponents, swimlane: swimlaneComponents,
	sequence: sequenceComponents, state: stateComponents,
	...hierarchyComponents, ...workflowComponents, ...chartComponents, ...otherComponents,
	railroad: railroadComponents['railroad-beta'],
};

export function diagramComponents(diagram: DiagramSyntax): readonly SyntaxSnippet[] {
	if (diagram.type === 'railroad') return railroadComponents[diagram.declaration as keyof typeof railroadComponents];
	return components[diagram.type];
}
