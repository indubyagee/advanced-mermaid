export interface RecoveryDraft { file: string; source: string; css: string; reason: string; time: number }
/** Bounded session-only recovery; never persisted in settings or vault files. */
const drafts: RecoveryDraft[] = [];
let lastTime = 0;
export function retainDraft(draft: Omit<RecoveryDraft, 'time'>): void {
	lastTime = Math.max(Date.now(), lastTime + 1);
	drafts.push({ ...draft, source: draft.source.slice(0, 100000), css: draft.css.slice(0, 50000), time: lastTime });
	while (drafts.length > 10) drafts.shift();
}
export function recoveryDrafts(): readonly RecoveryDraft[] { return drafts; }
export function discardRecoveryDraft(time: number): void { const index = drafts.findIndex(draft => draft.time === time); if (index >= 0) drafts.splice(index, 1); }
