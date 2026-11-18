/** Per-owner coalescing; source persistence never passes through this scheduler. */
export class PreviewScheduler {
	private cancelTimer?: () => void;
	private slow = 0;
	paused = false;
	disposed = false;
	constructor(private readonly currentWindow: () => Window | null, private readonly render: () => void, private readonly status: (text: string) => void) {}
	schedule(delay: number): void {
		this.cancel(); if (this.disposed || this.paused) return;
		const view = this.currentWindow();
		if (!view) return;
		this.status('Updating preview…');
		const timer = view.setTimeout(() => this.now(), delay);
		this.cancelTimer = view.clearTimeout.bind(view, timer);
	}
	now(): void {
		this.cancel(); if (this.disposed) return;
		const view = this.currentWindow();
		if (!view) return;
		this.status('Rendering…'); const start = view.performance.now(); this.render();
		this.slow = view.performance.now() - start > 200 ? this.slow + 1 : 0;
		if (this.slow >= 3) { this.paused = true; this.status('Automatic preview paused after slow renders. Select Render now.'); }
	}
	cancel(): void { this.cancelTimer?.(); this.cancelTimer = undefined; }
	destroy(): void { this.cancel(); this.disposed = true; }
}
