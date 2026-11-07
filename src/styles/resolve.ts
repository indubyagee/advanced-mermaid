import {
	COLOR_TOKENS, ELEMENT_CONTROLS, diagramCategory, emptyStyleProfile,
	type ColorToken, type DiagramCategory, type ElementControlId, type StyleProfile, type TypeStyleProfile,
} from './registry';

/** Merge validated sparse patches without freezing inherited defaults or sharing
 * objects with the stored profiles. Theme/default bindings remain the renderer's
 * responsibility; explicit source styles remain in the untouched Mermaid source.
 */
export function resolveStyleProfile(global: StyleProfile, type?: TypeStyleProfile, local?: StyleProfile): StyleProfile {
	const result = emptyStyleProfile();
	const layers = [global, type && !type.useGlobal ? type.overrides : undefined, local];
	for (const layer of layers) {
		if (!layer) continue;
		for (const token of Object.keys(COLOR_TOKENS) as ColorToken[]) {
			const pair = layer.colors[token];
			if (!pair) continue;
			const merged = { ...result.colors[token] };
			if (pair.light !== undefined) merged.light = pair.light;
			if (pair.dark !== undefined) merged.dark = pair.dark;
			if (Object.keys(merged).length) result.colors[token] = merged;
		}
		for (const id of Object.keys(ELEMENT_CONTROLS) as ElementControlId[]) {
			const value = layer.elements[id];
			if (value === undefined) continue;
			if (typeof value === 'number') result.elements[id] = value;
			else {
				const previous = result.elements[id];
				const merged = typeof previous === 'object' ? { ...previous } : {};
				if (value.light !== undefined) merged.light = value.light;
				if (value.dark !== undefined) merged.dark = value.dark;
				if (Object.keys(merged).length) result.elements[id] = merged;
			}
		}
		if (layer.font !== undefined) result.font = layer.font;
		if (layer.monospace !== undefined) result.monospace = layer.monospace;
		if (layer.radiusPx !== undefined) result.radiusPx = layer.radiusPx;
		if (layer.labelSizePx !== undefined) result.labelSizePx = layer.labelSizePx;
		if (layer.titleWeight !== undefined) result.titleWeight = layer.titleWeight;
		if (layer.headingWeight !== undefined) result.headingWeight = layer.headingWeight;
		if (layer.boldWeight !== undefined) result.boldWeight = layer.boldWeight;
	}
	return result;
}

export function resolveDiagramStyle(source: string, global: StyleProfile,
	diagrams: Partial<Record<DiagramCategory, TypeStyleProfile>>, local?: StyleProfile): {
		category: DiagramCategory | null; profile: StyleProfile;
	} {
	const category = diagramCategory(source);
	return { category, profile: resolveStyleProfile(global, category ? diagrams[category] : undefined, local) };
}
