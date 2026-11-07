import { snippets } from './snippet';

export const chartComponents = {
	pie: snippets('Pie components', ['title Distribution', '"Item": 40']),
	xychart: snippets('Chart components', ['title "Chart"', 'x-axis [A, B, C]', 'y-axis "Value" 0 --> 100', 'bar [10, 20, 30]', 'line [30, 20, 10]']),
	quadrantChart: snippets('Quadrant components', [
		'title Priorities', 'x-axis Low --> High', 'y-axis Low --> High', 'quadrant-1 Do first',
		'quadrant-2 Plan', 'quadrant-3 Review', 'quadrant-4 Delegate', 'Item: [0.3, 0.6]',
	]),
	sankey: snippets('Sankey components', ['Source,Target,10', '"Source label","Target label",20']),
	packet: snippets('Packet components', ['0-7: "Field"', '+8: "Field"']),
	radar: snippets('Radar components', [
		'title Comparison', 'axis A, B, C', 'axis A["Dimension"]', 'curve series{1, 2, 3}',
		'curve series{A: 1, B: 2, C: 3}', 'showLegend true', 'max 5', 'min 0', 'ticks 5', 'graticule polygon',
	]),
	treemap: snippets('Treemap components', [
		['Section', '"Group"\n  "Item": 10'], '"Item": 10', 'title Treemap',
		'classDef custom fill:#ffffff,stroke:#333333', '"Item": 10:::custom',
	]),
};
