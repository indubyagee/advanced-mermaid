import { snippets } from './snippet';

export const sequenceComponents = snippets('Sequence components', [
	['Participant', 'participant A'], ['Participant with alias', 'participant A as Participant'], ['Actor', 'actor A'],
	['Database participant', 'participant A@{ "type": "database" }'],
	['Message', 'A->>B: Message'], ['Dotted response', 'A-->>B: Response'],
	['Asynchronous message', 'A-)B: Async message'], ['Failed message', 'A-xB: Failed message'],
	['Activation', 'A->>+B: Start\nB-->>-A: Done'],
	['Activation interval', 'activate A\ndeactivate A'],
	['Create participant', 'create participant C\nA->>C: Create'],
	['Destroy participant', 'participant C\nA->>C: Work\ndestroy C\nC-->>A: Done'],
	['Note on the right', 'Note right of A: Note'], ['Note on the left', 'Note left of A: Note'],
	['Note across participants', 'Note over A,B: Note'],
	['Loop', 'loop Condition\n  A->>B: Message\nend'],
	['Alternatives', 'alt Condition\n  A->>B: Yes\nelse Otherwise\n  B->>A: No\nend'],
	['Optional block', 'opt Condition\n  A->>B: Message\nend'],
	['Parallel block', 'par First\n  A->>B: Message\nand Second\n  B->>A: Reply\nend'],
	['Critical block', 'critical Work\n  A->>B: Message\noption Retry\n  A->>B: Retry\nend'],
	['Break block', 'break Condition\n  A->>B: Stop\nend'],
	['Participant box', 'box Group\n  participant A\n  participant B\nend'],
	['Highlight', 'rect rgb(240, 240, 240)\n  A->>B: Message\nend'],
	['Message numbering', 'autonumber'], ['Numbering with start and increment', 'autonumber 10 10'],
	['Accessible title', 'accTitle: Diagram title'], ['Accessible description', 'accDescr: Diagram description'],
	['Comment', '%% Comment'],
]);

export const stateComponents = snippets('State components', [
	['State with alias', 'state "State label" as A'], ['State description', 'A: State description'],
	['Labelled transition', 'A --> B: Transition'], ['Initial state', '[*] --> A'], ['Final state', 'A --> [*]'],
	['Composite state', 'state Group {\n  [*] --> A\n  A --> B\n}'],
	['Choice', 'state Decision <<choice>>'], ['Fork', 'state Split <<fork>>'], ['Join', 'state Join <<join>>'],
	['Direction', 'direction LR'],
	['Concurrent regions', 'state Group {\n  A --> B\n  --\n  C --> D\n}'],
	['Note on the right', 'note right of A: Note'], ['Multiline note', 'note left of A\n  Note\nend note'],
	['Define a class', 'classDef custom fill:#ffffff,stroke:#333333'], ['Assign a class', 'class A custom'],
	['Comment', '%% Comment'],
]);

export const hierarchyComponents = {
	mindmap: snippets('Mindmap components', [
		['Root node', 'root((Root))'], ['Branch', '  branch[Branch]'], ['Rounded branch', '  branch(Branch)'],
		['Circle branch', '  branch((Branch))'], ['Cloud branch', '  branch)Branch('],
		['Hexagon branch', '  branch{{Branch}}'], ['Subtree', '  branch[Branch]\n    leaf[Leaf]'],
	]),
	kanban: snippets('Kanban components', [
		['Column', 'column[Column]'], ['Task', '  task[Task]'],
		['Task metadata', '  task[Task]@{ assigned: "Owner", ticket: "123", priority: "High" }'],
		['Column with task', 'column[Column]\n  task[Task]'],
	]),
	treeView: snippets('Tree components', [
		['Directory', 'folder/'], ['File', '  file.txt'], ['Description', '  file.txt ## Description'],
		['Highlighted file', '  file.txt :::highlight'], ['Subdirectory', '  folder/\n    file.txt'],
		['Built-in icon', '  file.txt icon(file)'],
	]),
	ishikawa: snippets('Cause components', [
		['Problem and cause', 'Problem\n  Category\n    Cause'], ['Cause category', '  Category'], ['Cause', '    Cause'],
	]),
};

export const workflowComponents = {
	gantt: snippets('Gantt components', [
		['Title', 'title Project schedule'], ['Input date format', 'dateFormat YYYY-MM-DD'], ['Axis date format', 'axisFormat %Y-%m-%d'],
		['Section', 'section Phase'], ['Task with duration', 'Task :task1, 2026-01-01, 5d'],
		['Dependent task', 'Next task :task2, after task1, 3d'], ['Completed task', 'Completed task :done, task3, 2026-01-01, 2d'],
		['Critical task', 'Critical task :crit, task4, 2026-01-01, 2d'], ['Milestone', 'Milestone :milestone, m1, 2026-01-01, 0d'],
		['Exclude weekends', 'excludes weekends'], ['Hide today marker', 'todayMarker off'],
	]),
	gitGraph: snippets('Git components', [
		['Commit', 'commit'], ['Commit with ID', 'commit id: "change"'], ['Tagged commit', 'commit tag: "release"'],
		['Highlighted commit', 'commit type: HIGHLIGHT'], ['Branch', 'branch feature'],
		['Branch and merge', 'commit\nbranch feature\ncommit\ncheckout main\nmerge feature'],
	]),
	timeline: snippets('Timeline components', [
		['Title', 'title Timeline'], ['Section', 'section Phase'], ['Event', '2026 : Event'],
		['Multiple events', '2026 : First event\n     : Second event'],
	]),
	journey: snippets('Journey components', [
		['Title', 'title User journey'], ['Section', 'section Phase'], ['Scored task', 'Task: 5: User'],
		['Task with multiple actors', 'Task: 3: User, Team'],
	]),
	eventmodeling: snippets('Event modeling components', [
		['Screen frame', 'tf 01 ui Screen'], ['Command frame', 'tf 02 cmd Submit'], ['Event frame', 'tf 03 evt Submitted'],
		['Read model frame', 'tf 04 rmo Summary'], ['Processor frame', 'rf 05 pcr Process'],
		['Frame with data', 'tf 06 cmd AddItem { price: 20 }'],
		['Explicit source', 'tf 01 cmd Submit\ntf 02 evt Submitted ->> 01'],
	]),
};
