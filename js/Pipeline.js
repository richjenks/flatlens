import { Store } from "./Store.js";
import { Utils } from "./Utils.js";
import { Detector } from "./Detector.js";
import { Render } from "./Render.js";

// Orchestrates the rendering pipeline and control flow
export class Pipeline {

	// Three.js wrapper
	render;

	/** Initialize renderer and subscriptions */
	constructor() {
		const s = Store.get();
		this.render = new Render(s.video, s.canvas);
		this.render.setProjection(s);
		this.render.setView(s);
		this.storeSubscriptions();
	}

	/** Wire Store changes to Render updates */
	storeSubscriptions() {

		// Core state changes
		Store.subscribe("url", (s) => this.setVideoSource(s));
		Store.subscribe("playback", (s) => (s.playback ? this.render.start() : this.render.stop()));
		Store.subscribe("layout", (s) => this.render.setLayout(s));
		Store.subscribe("resolution", (s) => this.render.setResolution(s));
		Store.subscribe("projection", (s) => this.render.setProjection(s));
		Store.subscribe("view", (s) => this.render.setView(s));

		// Video lifecycle
		const video = Store.get("video");
		video.addEventListener("loadedmetadata", async () => {

			// Run detection once metadata (dimensions) is available
			const results = await Detector.detect();
			Store.set({
				layout:     results.layout.value,
				resolution: results.resolution.value,
				projection: results.projection.value,
			});

			// Start playback and render
			Store.set({ splash: false });
			Store.set({ playback: true });
			this.render.resize(Store.get());
			this.getFps();
		});
		video.addEventListener("seeked", () => this.render.resize(Store.get()));

		// Window resize
		window.addEventListener("resize", Utils.debounce(() => this.render.resize(Store.get())));

		// Pause rendering when tab/window is hidden; resume on visible if playing
		document.addEventListener("visibilitychange", () => {
			if (document.hidden) {
				this.render.stop();
			} else if (Store.get("playback")) {
				this.render.start();
			}
		});
	}

	// Attach video source to renderer when URL changes
	setVideoSource(state) {
		const { url, video } = state;
		if (!url) {
			return;
		}
		this.render.setVideo(video);
		this.render.resize(Store.get());
	}

	// Determines video's FPS (async hence not in Detector)
	getFps() {
		const video = Store.get("video");
		const rates = [
			23.976, 24,    // Film-derived
			25, 29.97, 30, // Analogue TV (PAL/NTSC heritage)
			50, 59.94, 60, // Digital/HD TV & streaming
			72, 90, 120,   // VR / HMD refresh rates
			48,            // High-frame-rate cinema
			15, 20,        // Legacy / niche low rates
		];
		const deltas = [];
		const samples = 12;
		let previous = null;

		const tick = (_, meta) => {
			const time = (meta?.mediaTime ?? video.currentTime) || 0;
			if (previous !== null) {
				const d = time - previous; if (d > 0) {
					deltas.push(d);
				}
			}
			previous = time;

			if (deltas.length < samples && !video.ended) {
				return video.requestVideoFrameCallback(tick);
			}

			deltas.sort((a,b) => a - b);
			const mid = deltas.length >> 1;
			const median = (deltas[mid - 1] + deltas[mid]) * 0.5;
			const raw = 1 / Math.max(1e-6, median);

			let best = rates[0];
			for (let i = 1; i < rates.length; i++) {
				if (Math.abs(rates[i] - raw) < Math.abs(best - raw)) {
					best = rates[i];
				}
			}
			Store.set({ fps: best });
		};

		video.requestVideoFrameCallback(tick);
	}

	// Cleanup renderer
	dispose() {
		this.render.dispose();
	}
}
