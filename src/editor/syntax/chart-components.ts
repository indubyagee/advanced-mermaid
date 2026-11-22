import { snippets } from './snippet';

export const chartComponents = {
	pie: snippets('Pie components', [['Title', 'title Distribution'], ['Slice value', '"Item": 40']]),
	xychart: snippets('Chart components', [
		['Title', 'title "Chart"'], ['Categorical x-axis', 'x-axis [A, B, C]'],
		['Numeric y-axis', 'y-axis "Value" 0 --> 100'], ['Bar series', 'bar [10, 20, 30]'], ['Line series', 'line [30, 20, 10]'],
	]),
	quadrantChart: snippets('Quadrant components', [
		['Title', 'title Priorities'], ['X-axis labels', 'x-axis Low --> High'], ['Y-axis labels', 'y-axis Low --> High'],
		['First quadrant', 'quadrant-1 Do first'], ['Second quadrant', 'quadrant-2 Plan'], ['Third quadrant', 'quadrant-3 Review'],
		['Fourth quadrant', 'quadrant-4 Delegate'], ['Data point', 'Item: [0.3, 0.6]'],
	]),
	sankey: snippets('Sankey components', [['Flow value', 'Source,Target,10'], ['Flow with quoted labels', '"Source label","Target label",20']]),
	packet: snippets('Packet components', [['Bit range', '0-7: "Field"'], ['Relative bit count', '+8: "Field"']]),
	radar: snippets('Radar components', [
		['Title', 'title Comparison'], ['Axes', 'axis A, B, C'], ['Named axis', 'axis A["Dimension"]'],
		['Ordered series', 'curve series{1, 2, 3}'], ['Series keyed by axis', 'curve series{A: 1, B: 2, C: 3}'],
		['Show legend', 'showLegend true'], ['Maximum', 'max 5'], ['Minimum', 'min 0'], ['Tick count', 'ticks 5'],
		['Polygon grid', 'graticule polygon'],
	]),
	treemap: snippets('Treemap components', [
		['Section', '"Group"\n  "Item": 10'], ['Leaf value', '"Item": 10'], ['Title', 'title Treemap'],
		['Define a class', 'classDef custom fill:#ffffff,stroke:#333333'], ['Leaf with class', '"Item": 10:::custom'],
	]),
};
