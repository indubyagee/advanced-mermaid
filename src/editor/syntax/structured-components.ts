import { snippets } from './snippet';

export const sequenceComponents = snippets('Sequence components', [
	'participant A', 'participant A as Participant', 'actor A',
	'participant A@{ "type": "database" }',
	'A->>B: Message', 'A-->>B: Response', 'A-)B: Async message', 'A-xB: Failed message',
	['Activation', 'A->>+B: Start\nB-->>-A: Done'],
	['Activation interval', 'activate A\ndeactivate A'],
	['Create participant', 'create participant C\nA->>C: Create'],
	['Destroy participant', 'participant C\nA->>C: Work\ndestroy C\nC-->>A: Done'],
	'Note right of A: Note', 'Note left of A: Note', 'Note over A,B: Note',
	['Loop', 'loop Condition\n  A->>B: Message\nend'],
	['Alternatives', 'alt Condition\n  A->>B: Yes\nelse Otherwise\n  B->>A: No\nend'],
	['Optional block', 'opt Condition\n  A->>B: Message\nend'],
	['Parallel block', 'par First\n  A->>B: Message\nand Second\n  B->>A: Reply\nend'],
	['Critical block', 'critical Work\n  A->>B: Message\noption Retry\n  A->>B: Retry\nend'],
	['Break block', 'break Condition\n  A->>B: Stop\nend'],
	['Participant box', 'box Group\n  participant A\n  participant B\nend'],
	['Highlight', 'rect rgb(240, 240, 240)\n  A->>B: Message\nend'],
	'autonumber', 'autonumber 10 10', 'accTitle: Diagram title', 'accDescr: Diagram description', '%% Comment',
]);

export const stateComponents = snippets('State components', [
	'state "State label" as A', 'A: State description', 'A --> B: Transition', '[*] --> A', 'A --> [*]',
	['Composite state', 'state Group {\n  [*] --> A\n  A --> B\n}'],
	'state Decision <<choice>>', 'state Split <<fork>>', 'state Join <<join>>', 'direction LR',
	['Concurrent regions', 'state Group {\n  A --> B\n  --\n  C --> D\n}'],
	'note right of A: Note', ['Multiline note', 'note left of A\n  Note\nend note'],
	'classDef custom fill:#ffffff,stroke:#333333', 'class A custom', '%% Comment',
]);

export const hierarchyComponents = {
	mindmap: snippets('Mindmap components', [
		'root((Root))', ['Branch', '  branch[Branch]'], ['Rounded branch', '  branch(Branch)'],
		['Circle branch', '  branch((Branch))'], ['Cloud branch', '  branch)Branch('],
		['Hexagon branch', '  branch{{Branch}}'], ['Subtree', '  branch[Branch]\n    leaf[Leaf]'],
	]),
	kanban: snippets('Kanban components', [
		['Column', 'column[Column]'], ['Task', '  task[Task]'],
		['Task metadata', '  task[Task]@{ assigned: "Owner", ticket: "123", priority: "High" }'],
		['Column with task', 'column[Column]\n  task[Task]'],
	]),
	treeView: snippets('Tree components', [
		'folder/', ['File', '  file.txt'], ['Description', '  file.txt ## Description'],
		['Highlighted file', '  file.txt :::highlight'], ['Subdirectory', '  folder/\n    file.txt'],
		['Built-in icon', '  file.txt icon(file)'],
	]),
	ishikawa: snippets('Cause components', [
		['Problem and cause', 'Problem\n  Category\n    Cause'], ['Cause category', '  Category'], ['Cause', '    Cause'],
	]),
};

export const workflowComponents = {
	gantt: snippets('Gantt components', [
		'title Project schedule', 'dateFormat YYYY-MM-DD', 'axisFormat %Y-%m-%d',
		'section Phase', 'Task :task1, 2026-01-01, 5d', 'Next task :task2, after task1, 3d',
		'Completed task :done, task3, 2026-01-01, 2d', 'Critical task :crit, task4, 2026-01-01, 2d',
		'Milestone :milestone, m1, 2026-01-01, 0d', 'excludes weekends', 'todayMarker off',
	]),
	gitGraph: snippets('Git components', [
		'commit', 'commit id: "change"', 'commit tag: "release"', 'commit type: HIGHLIGHT', 'branch feature',
		['Branch and merge', 'commit\nbranch feature\ncommit\ncheckout main\nmerge feature'],
	]),
	timeline: snippets('Timeline components', [
		'title Timeline', 'section Phase', '2026 : Event', ['Multiple events', '2026 : First event\n     : Second event'],
	]),
	journey: snippets('Journey components', [
		'title User journey', 'section Phase', 'Task: 5: User', 'Task: 3: User, Team',
	]),
	eventmodeling: snippets('Event modeling components', [
		'tf 01 ui Screen', 'tf 02 cmd Submit', 'tf 03 evt Submitted',
		'tf 04 rmo Summary', 'rf 05 pcr Process',
		['Frame with data', 'tf 06 cmd AddItem { price: 20 }'],
		['Explicit source', 'tf 01 cmd Submit\ntf 02 evt Submitted ->> 01'],
	]),
};
