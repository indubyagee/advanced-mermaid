import type { DiagramType } from 'pele';

/** Small independent examples exercise real parsing and rendering, including all declaration variants. */
export const syntaxBodies: Readonly<Record<DiagramType, string>> = {
	flowchart: 'A[First] --> B[Second]', sequence: 'A->>B: Hello', class: 'class Item',
	state: '[*] --> Ready', er: 'CUSTOMER ||--o{ ORDER : places', pie: '"First": 10',
	gantt: 'dateFormat YYYY-MM-DD\nTask :task1, 2026-01-01, 2d', gitGraph: 'commit',
	mindmap: 'root((Root))\n  Branch', timeline: '2026 : Event', journey: 'Task: 5: User',
	xychart: 'x-axis [A, B, C]\nbar [10, 20, 30]', quadrantChart: 'Item: [0.3, 0.6]',
	requirement: 'requirement item {\n id: 1\n text: "Required behavior"\n risk: low\n verifymethod: test\n}',
	c4: 'Person(user, "User")', sankey: 'Source,Target,10', block: 'A["Block"]',
	packet: '0-7: "Field"', kanban: 'column[Column]\n  task[Task]',
	architecture: 'service server1(server)[Server]', radar: 'axis A, B, C\ncurve series{1, 2, 3}',
	treemap: '"Group"\n  "Item": 10', info: 'showInfo', agentflow: 'A[Input] --> B[Task]',
	usecase: 'actor User\nLogin("Sign in")\nUser --> Login', railroad: '',
	treeView: 'root/\n  file.txt', venn: 'set A["Set"]: 10', cynefin: 'clear\n "Task"',
	wardley: 'component A [0.5, 0.5]', swimlane: 'subgraph lane [Lane]\n A[Task]\nend',
	ishikawa: 'Problem\n  Category\n    Cause', eventmodeling: 'tf 01 cmd Submit',
};
