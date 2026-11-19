import type { ChangeDesc, Range } from '@codemirror/state';
import type { Decoration, DecorationSet } from '@codemirror/view';
import { fenceContaining, type FenceRange } from './fences';

export interface ActiveFence { range: FenceRange; id: number }

export interface FencePresentation {
	fences: readonly FenceRange[];
	selected: ReadonlySet<FenceRange>;
	active: ActiveFence | null;
}

function activeId(presentation: FencePresentation, fence: FenceRange): number | undefined {
	const { active } = presentation;
	return active?.range.from === fence.from ? active.id : undefined;
}

function sameMode(previous: FencePresentation, before: FenceRange, current: FencePresentation, after: FenceRange): boolean {
	return previous.selected.has(before) === current.selected.has(after) && activeId(previous, before) === activeId(current, after);
}

function sameRange(before: FenceRange, after: FenceRange, mappedFrom: number): boolean {
	const shift = mappedFrom - before.from;
	return after.from === mappedFrom && after.to === before.to + shift &&
		after.bodyFrom === before.bodyFrom + shift && after.bodyTo === before.bodyTo + shift &&
		after.empty === before.empty && after.language === before.language;
}

export function updateFenceDecorations(
	previous: FencePresentation & { decorations: DecorationSet }, current: FencePresentation,
	changes: ChangeDesc, decorate: (fence: FenceRange) => Range<Decoration>[],
): DecorationSet {
	const remove = new Set<number>();
	let add: FenceRange[];
	if (changes.empty && previous.fences === current.fences) {
		const candidates = new Set([...previous.selected, ...current.selected]);
		if (previous.active !== current.active) {
			for (const active of [previous.active, current.active]) {
				const fence = active && fenceContaining(current.fences, active.range.from);
				if (fence) candidates.add(fence);
			}
		}
		add = [];
		for (const fence of candidates) if (!sameMode(previous, fence, current, fence)) {
			remove.add(fence.from);
			add.push(fence);
		}
	} else {
		const reused = new Set<FenceRange>();
		let nextIndex = 0;
		for (const before of previous.fences) {
			const from = changes.mapPos(before.from, 1);
			while (nextIndex < current.fences.length && current.fences[nextIndex]!.from < from) nextIndex++;
			const after = current.fences[nextIndex];
			if (after && sameRange(before, after, from) && !changes.touchesRange(before.from, before.to) &&
				sameMode(previous, before, current, after)) reused.add(after);
			else remove.add(before.from);
		}
		add = current.fences.filter(fence => !reused.has(fence));
	}
	// Filter before mapping so a deleted or replaced fence cannot keep widgets at its old offsets.
	const retained = remove.size ? previous.decorations.update({ filter: from => !remove.has(from) }) : previous.decorations;
	const mapped = changes.empty ? retained : retained.map(changes);
	return add.length ? mapped.update({ add: add.flatMap(decorate), sort: true }) : mapped;
}
