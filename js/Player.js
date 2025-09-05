import { Store } from "./Store.js";

// Manages video playback and state management
export class Player {

	// Create Player instance
	constructor() {
		this.playerEvents();
		this.storeSubscriptions();
	}

	// Setup event listeners
	playerEvents() {

		// Get <video> element
		const { video } = Store.get();

		// Update current time
		video.ontimeupdate = () => {
			Store.set({ time: video.currentTime });
		};

		// Update video duration
		video.oncanplay = () => {
			Store.set({ duration: video.duration });
		};

		// Optimize seeking performance
		let seekAnimationFrame;
		video.addEventListener("seeking", () => {
			const updateFrame = () => {
				if (video.seeking) {
					seekAnimationFrame = requestAnimationFrame(updateFrame);
				}
			};
			updateFrame();
		});
		video.addEventListener("seeked", () => {
			if (seekAnimationFrame) {
				cancelAnimationFrame(seekAnimationFrame);
				seekAnimationFrame = null;
			}
		});

		// Update playback state when video ends
		// (Not triggered when loop===true)
		video.onended = () => {
			Store.set({ playback: false });
		};

		// Log errors and stop playback
		video.onerror = () => {
			console.error("Video error:", video.error);
			Store.set({ playback: false });
		};
	}

	// Setup store subscriptions
	storeSubscriptions() {

		// Load a new video, if one is set
		Store.subscribe("url", async s => {
			if (s.url) {
				s.video.src = s.url;
			}
		});

		// Toggle playback
		Store.subscribe("playback", s => {
			if (s.playback) {
				s.video.play().catch(error => {
					console.error(error);
					Store.set({ playback: false });
				});
			} else {
				s.video.pause();
			}
		});

		// Toggle volume
		Store.subscribe("volume", s => {
			s.video.volume = s.volume;
		});

		// Toggle repeat
		Store.subscribe("repeat", s => {
			s.video.loop = s.repeat;
		});

		// Seek video (only when time changes significantly to prevent feedback loops)
		Store.subscribe("time", s => {
			if (Math.abs(s.video.currentTime - s.time) > 0.1) {
				if (typeof s.video.fastSeek === "function") {
					s.video.fastSeek(s.time);
				} else {
					s.video.currentTime = s.time;
				}
			}
		});

	}
}
