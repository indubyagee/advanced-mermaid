/** Per-owner coalescing; source persistence never passes through this scheduler. */
export class PreviewScheduler {
	private timer?: number;
	private slow = 0;
	paused = false;
	disposed = false;
	constructor(private readonly view: Window, private readonly render: () => void, private readonly status: (text: string) => void) {}
	schedule(delay: number): void {
		this.cancel(); if (this.disposed || this.paused) return;
		this.status('Updating preview…'); this.timer = this.view.setTimeout(() => this.now(), delay);
	}
	now(): void {
		this.cancel(); if (this.disposed) return;
		this.status('Rendering…'); const start = this.view.performance.now(); this.render();
		this.slow = this.view.performance.now() - start > 200 ? this.slow + 1 : 0;
		if (this.slow >= 3) { this.paused = true; this.status('Automatic preview paused after slow renders. Select Render now.'); }
	}
	cancel(): void { this.view.clearTimeout(this.timer); this.timer = undefined; }
	destroy(): void { this.cancel(); this.disposed = true; }
}
