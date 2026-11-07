/** Version-specific adapters, each paired with the browser fixture in inline editor checks. */
export const SEMANTIC_CONTROLS = {
	sequenceParticipantFill: { variable: '--advanced-mermaid-sequence-participant-fill', kind: 'color', refresh: 'paint', category: 'sequence', label: 'Participant fill' },
	sequenceNoteFill: { variable: '--advanced-mermaid-sequence-note-fill', kind: 'color', refresh: 'paint', category: 'sequence', label: 'Note fill' },
	sequenceActivationFill: { variable: '--advanced-mermaid-sequence-activation-fill', kind: 'color', refresh: 'paint', category: 'sequence', label: 'Activation fill' },
	stateCompositeFill: { variable: '--advanced-mermaid-state-composite-fill', kind: 'color', refresh: 'paint', category: 'state', label: 'Composite state fill' },
	treeFileText: { variable: '--advanced-mermaid-tree-file-text', kind: 'color', refresh: 'paint', category: 'treeView', label: 'File text' },
	treeDirectoryText: { variable: '--advanced-mermaid-tree-directory-text', kind: 'color', refresh: 'paint', category: 'treeView', label: 'Directory text' },
	treeGuideColor: { variable: '--advanced-mermaid-tree-guide-color', kind: 'color', refresh: 'paint', category: 'treeView', label: 'Guide lines' },
	agentTaskColor: { variable: '--advanced-mermaid-agent-task-color', kind: 'color', refresh: 'paint', category: 'agentflow', label: 'Task role color' },
	mindmapRootFill: { variable: '--advanced-mermaid-mindmap-root-fill', kind: 'color', refresh: 'paint', category: 'mindmap', label: 'Root fill' },
} as const;
