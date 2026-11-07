import type { DiagramType } from 'pele';

export type ConfigurationValue = string | number | boolean | null | ConfigurationValue[] | { [key: string]: ConfigurationValue };
export type Configuration = { [key: string]: ConfigurationValue };

/** Editable Mermaid defaults, based on the variable tables. Pele consumes a subset.
 * Theme-dependent palettes and options without literal defaults are intentionally omitted.
 * Version 12.3 animation options are excluded from the pinned 12.1 syntax contract.
 */
export const DIAGRAM_CONFIGURATION: Readonly<Record<DiagramType, Configuration>> = {
	flowchart: { theme: 'redux-color', look: 'neo', layout: 'elk', flowchart: {
		titleTopMargin: 25, diagramPadding: 8, subGraphTitleMargin: { top: 0, bottom: 0 },
		nodeSpacing: 50, rankSpacing: 50, padding: 15, wrappingWidth: 120, minNodeWidth: 120,
		curve: 'basis', useMaxWidth: true, inheritDir: false,
	}, markdownAutoWrap: true },
	agentflow: { theme: 'redux-color', look: 'neo', layout: 'elk', agentflow: { titleTopMargin: 25, diagramPadding: 8, nodeSpacing: 50, rankSpacing: 50, useMaxWidth: true } },
	eventmodeling: { eventmodeling: { padding: 30, rowHeight: 32, useMaxWidth: true } },
	gantt: { gantt: {
		titleTopMargin: 25, barHeight: 20, barGap: 4, topPadding: 50, leftPadding: 75, rightPadding: 75,
		gridLineStartPadding: 35, fontSize: 11, sectionFontSize: 11, numberSectionStyles: 4,
		useMaxWidth: true, topAxis: false, displayMode: '', axisFormat: '%Y-%m-%d', weekday: 'sunday',
	} },
	gitGraph: { gitGraph: {
		titleTopMargin: 25, diagramPadding: 8, mainBranchName: 'main', mainBranchOrder: 0,
		showBranches: true, showCommitLabel: true, rotateCommitLabel: true, parallelCommits: false, useMaxWidth: true,
	} },
	ishikawa: { look: 'classic', handDrawnSeed: 0, ishikawa: { diagramPadding: 20, useMaxWidth: false } },
	kanban: { kanban: { sectionWidth: 200, padding: 8, ticketBaseUrl: '' } },
	mindmap: { mindmap: { padding: 10, maxNodeWidth: 200, layoutAlgorithm: 'cose-bilkent', useMaxWidth: true } },
	radar: { radar: {
		width: 600, height: 600, marginTop: 50, marginBottom: 50, marginLeft: 50, marginRight: 50,
		axisScaleFactor: 1, axisLabelFactor: 1.05, curveTension: 0.17, useMaxWidth: true,
	} },
	sequence: { theme: 'redux-color', look: 'neo', sequence: {
		useMaxWidth: true, diagramMarginX: 50, diagramMarginY: 10, actorMargin: 50, width: 150, height: 65,
		activationWidth: 10, boxMargin: 10, boxTextMargin: 5, noteMargin: 10, messageMargin: 35,
		messageAlign: 'center', mirrorActors: true, hideUnusedParticipants: false, bottomMarginAdj: 1,
		rightAngles: false, showSequenceNumbers: false, wrap: false, wrapPadding: 10, labelBoxWidth: 50, labelBoxHeight: 20,
		actorFontSize: 14, actorFontFamily: '"Open Sans", sans-serif', actorFontWeight: 400,
		noteFontSize: 14, noteFontFamily: '"trebuchet ms", verdana, arial, sans-serif', noteFontWeight: 400, noteAlign: 'center',
		messageFontSize: 16, messageFontFamily: '"trebuchet ms", verdana, arial, sans-serif', messageFontWeight: 400, forceMenus: false,
	} },
	state: { theme: 'redux-color', look: 'neo', layout: 'elk', state: {
		useMaxWidth: true, titleTopMargin: 25, wrappingWidth: 120, minNodeWidth: 120, nodeSpacing: 50, rankSpacing: 50,
		dividerMargin: 10, sizeUnit: 5, padding: 8, textHeight: 10, titleShift: -15, noteMargin: 10,
		forkWidth: 70, forkHeight: 7, miniPadding: 2, fontSizeFactor: 5.02, fontSize: 24,
		labelHeight: 16, edgeLengthFactor: '20', compositTitleSize: 35, radius: 5,
	} },
	swimlane: {
		theme: 'redux-color', look: 'neo', layout: 'swimlane',
		swimlane: { lineHops: 'arc', ignoreCrossLaneEdges: true, optimizeRanksByCrossings: true, automaticLaneOrdering: false },
		flowchart: { titleTopMargin: 25, diagramPadding: 8, nodeSpacing: 50, rankSpacing: 50, curve: 'basis', padding: 15, useMaxWidth: true },
	},
	timeline: { timeline: { disableMulticolor: false, useMaxWidth: true, padding: 50, leftMargin: 150 } },
	treemap: { treemap: {
		useMaxWidth: true, padding: 10, diagramPadding: 8, showValues: true, nodeWidth: 100, nodeHeight: 40,
		valueFormat: ',', borderWidth: 1, labelFontSize: 14, valueFontSize: 12,
	} },
	treeView: { treeView: { useMaxWidth: true, rowIndent: 10, paddingX: 5, paddingY: 5, lineThickness: 1, showIcons: false, defaultIconPack: '', filenameIcons: {}, extensionIcons: {} } },
	journey: { journey: {
		useMaxWidth: true, diagramMarginX: 50, diagramMarginY: 10, leftMargin: 150, maxLabelWidth: 360,
		width: 150, height: 50, taskMargin: 50, boxTextMargin: 5, textPlacement: 'fo', sectionColours: ['#fff'],
		titleColor: '', titleFontFamily: '"trebuchet ms", verdana, arial, sans-serif', titleFontSize: '4ex',
	} },
	// Other Pele families have no local variable table. Offer small, standard Mermaid templates.
	class: { class: { hideEmptyMembersBox: false } },
	er: { er: { layoutDirection: 'TB', minEntityWidth: 100, minEntityHeight: 75, entityPadding: 15 } },
	pie: { pie: { useMaxWidth: true, textPosition: 0.75 } },
	xychart: { xyChart: { width: 700, height: 500, showTitle: true, chartOrientation: 'vertical' } },
	quadrantChart: { quadrantChart: { chartWidth: 500, chartHeight: 500, pointRadius: 5 } },
	requirement: { requirement: { useMaxWidth: true, rect_min_width: 200, rect_min_height: 200, rect_padding: 10 } },
	c4: { c4: { diagramMarginX: 50, diagramMarginY: 10, c4ShapeMargin: 50, useMaxWidth: true } },
	sankey: { sankey: { width: 600, height: 400, useMaxWidth: false, showValues: true, linkColor: 'gradient', nodeAlignment: 'justify' } },
	block: { block: { padding: 8, useMaxWidth: true } },
	packet: { packet: { bitsPerRow: 32, bitWidth: 32, rowHeight: 32, paddingX: 5, paddingY: 5, showBits: true } },
	architecture: { architecture: { padding: 40, iconSize: 80 } },
	info: {},
	usecase: { usecase: { useMaxWidth: true } },
	railroad: { railroad: { useMaxWidth: true } },
	venn: { venn: { useMaxWidth: true } },
	cynefin: { cynefin: { width: 800, height: 600, padding: 40, showDomainDescriptions: true, boundaryAmplitude: 8, seed: 0 } },
	wardley: { 'wardley-beta': { width: 900, height: 600, padding: 48, nodeRadius: 6 } },
};
