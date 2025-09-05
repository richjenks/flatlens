import { Store } from "./Store.js";
import { Utils } from "./Utils.js";
import { Icons } from "./Icons.js";

// Manages player controls and user interaction
export class Controls {

	// References for UI elements
	ui = {};

	// Controls auto-hide settings
	controlsHideTimeout = null;
	controlsHideDelay = 2000;

	// Seek amount in seconds
	seekAmount = 5;

	// Creates Controls instance
	constructor() {

		// Controls setup
		this.cacheElements();
		this.controlIcons();
		this.controlEvents();
		this.storeSubscriptions();
		this.eventListeners();
		this.keyboardShortcuts();

		// Initiate auto-hide controls (comment for persistent controls)
		this.autoHideControls();
	}

	// Cache references to UI elements
	cacheElements() {

		// Splash screen
		this.ui.splash      = document.querySelector(".splash");
		this.ui.splashOpen  = document.querySelector(".splash-open");
		this.ui.splashInput = document.querySelector(".splash-input");

		// Control containers
		this.ui.controls = {
			top:    document.querySelector(".controls-top"),
			bottom: document.querySelector(".controls-bottom"),
		};

		// Control buttons
		this.ui.open       = document.querySelector(".controls-open");
		this.ui.filename   = document.querySelector(".controls-filename");
		this.ui.playback   = document.querySelector(".controls-playback");
		this.ui.volume     = document.querySelector(".controls-volume");
		this.ui.time       = document.querySelector(".controls-timecode-time");
		this.ui.duration   = document.querySelector(".controls-timecode-duration");
		this.ui.seekbar    = document.querySelector(".controls-seekbar");
		this.ui.repeat     = document.querySelector(".controls-repeat");
		this.ui.fullscreen = document.querySelector(".controls-fullscreen");

		// Control groups
		this.ui.view = {
			watch:    document.querySelector(".controls-view-watch"),
			original: document.querySelector(".controls-view-original"),
			anaglyph: document.querySelector(".controls-view-anaglyph"),
		};
		this.ui.projection = {
			flat:  document.querySelector(".controls-projection-flat"),
			vr180: document.querySelector(".controls-projection-vr180"),
			vr360: document.querySelector(".controls-projection-vr360"),
		};
		this.ui.layout = {
			sbs: document.querySelector(".controls-layout-sbs"),
			ou:  document.querySelector(".controls-layout-ou"),
		};
		this.ui.resolution = {
			half: document.querySelector(".controls-resolution-half"),
			full: document.querySelector(".controls-resolution-full"),
		};
	}

	// Set icons for controls
	controlIcons() {

		// File and playback
		Utils.setIcon(this.ui.open,     Icons.open);
		Utils.setIcon(this.ui.playback, Icons.playback.play);

		// View modes
		Utils.setIcon(this.ui.view.watch,    Icons.view.watch);
		Utils.setIcon(this.ui.view.original, Icons.view.original);
		Utils.setIcon(this.ui.view.anaglyph, Icons.view.anaglyph);

		// Projection modes
		Utils.setIcon(this.ui.projection.flat,  Icons.projection.flat);
		Utils.setIcon(this.ui.projection.vr180, Icons.projection.vr180);
		Utils.setIcon(this.ui.projection.vr360, Icons.projection.vr360);

		// Layout modes
		Utils.setIcon(this.ui.layout.sbs, Icons.layout.sbs);
		Utils.setIcon(this.ui.layout.ou,  Icons.layout.ou);

		// Resolution modes
		Utils.setIcon(this.ui.resolution.half,  Icons.resolution.half);
		Utils.setIcon(this.ui.resolution.full,  Icons.resolution.full);
	}

	// Setup control events
	controlEvents() {

		// Splash screen
		this.ui.splashOpen.addEventListener("click", () => this.openFile());
		this.ui.splashInput.addEventListener("change", (e) => {

			// Check file is valid video
			const isValidVideo = (file) => {
				return new Promise(res => {
					const url = URL.createObjectURL(file);
					const video = document.createElement("video");
					video.src = url;
					video.onloadedmetadata = () => {
						URL.revokeObjectURL(url);
						res(video.duration > 0 && video.videoWidth > 0);
					};
					video.onerror = () => {
						URL.revokeObjectURL(url);
						res(false);
					};
				});
			};

			// Validate video file
			const file = e.target.files[0];
			isValidVideo(file).then(valid => {
				if (valid) {
					const url = URL.createObjectURL(file);
					Store.set({
						name:     file.name,
						file,
						url,
						playback: false,
					});
				} else {
					alert("Please select a video file.");
					e.target.value = "";
				}
			});

			// Keep seekbar past segment the correct width
			this.seekbarPastSegment();
		});

		// File and playback
		this.ui.open.addEventListener("click", () => this.openFile());
		this.ui.playback.addEventListener("click", () => Store.toggle("playback"));
		this.ui.seekbar.addEventListener("input", () => {
			Store.set({ time: this.ui.seekbar.value });
			this.seekbarPastSegment();
		});
		this.ui.seekbar.addEventListener("mousedown", () => {
			const wasPlaying = Store.get().playback;
			if (wasPlaying) {
				Store.set({ playback: false });
				const onSeekEnd = () => {
					Store.set({ playback: true });
					window.removeEventListener("mouseup", onSeekEnd);
				};
				window.addEventListener("mouseup", onSeekEnd, { once: true });
			}
		});

		// Volume control
		this.ui.volume.addEventListener("click", () => Store.toggle("volume"));

		// Repeat control
		this.ui.repeat.addEventListener("click", () => Store.toggle("repeat"));

		// Fullscreen control
		this.ui.fullscreen.addEventListener("click", () => Store.toggle("fullscreen"));

		// Control groups
		Object.keys(this.ui.view).forEach(view => {
			this.ui.view[view].addEventListener("click", () => Store.set({ view }));
		});
		Object.keys(this.ui.projection).forEach(projection => {
			this.ui.projection[projection].addEventListener("click", () => Store.set({ projection }));
		});
		Object.keys(this.ui.layout).forEach(layout => {
			this.ui.layout[layout].addEventListener("click", () => Store.set({ layout }));
		});
		Object.keys(this.ui.resolution).forEach(resolution => {
			this.ui.resolution[resolution].addEventListener("click", () => Store.set({ resolution }));
		});
	}

	// Setup store subscriptions
	storeSubscriptions() {

		// Splash screen
		Store.subscribe("splash", s => {
			this.ui.splash.classList.toggle("hidden", !s.splash);
		});
		Store.subscribe("url", s => {
			if (s.url) {
				this.ui.filename.textContent = Store.get("name");
			}
		});

		// File and playback
		Store.subscribe("playback", s => {
			Utils.setIcon(this.ui.playback, Icons.playback[s.playback ? "play" : "pause"]);
		});
		Store.subscribe("time", s => {
			this.ui.time.textContent = Utils.timecode(s.time, s.duration);
			this.ui.seekbar.value = s.time;
			this.seekbarPastSegment();
		});
		Store.subscribe("duration", s => {
			this.ui.duration.textContent = Utils.timecode(s.duration);
			this.ui.seekbar.max = s.duration;
		});

		// Resolution Half icon depends on Layout
		Store.subscribe("layout", s => {
			const icon = Icons.resolution.half[s.layout];
			Utils.setIcon(this.ui.resolution.half, icon);
		});

		// Volume
		Store.subscribe("volume", s => {
			const icon = s.volume ? Icons.volume.full : Icons.volume.off;
			Utils.setIcon(this.ui.volume, icon);
		});

		// Repeat
		Store.subscribe("repeat", s => {
			const icon = s.repeat ? Icons.repeat.true : Icons.repeat.false;
			Utils.setIcon(this.ui.repeat, icon);
		});

		// Fullscreen
		Store.subscribe("fullscreen", s => {

			// Update icon to match state
			const icon = s.fullscreen ? Icons.fullscreen.exit : Icons.fullscreen.enter;
			Utils.setIcon(this.ui.fullscreen, icon);

			// Request or exit fullscreen if browser state is out of sync with the store
			if (s.fullscreen && !document.fullscreenElement) {
				document.documentElement.requestFullscreen();
			} else if (!s.fullscreen && document.fullscreenElement) {
				document.exitFullscreen();
			}
		});

		// Layout modes
		Store.subscribe("layout", s => {
			Object.keys(this.ui.layout).forEach(v => {
				this.ui.layout[v].classList.toggle("active", v === s.layout);
			});
		});

		// Resolution modes
		Store.subscribe("resolution", s => {
			Object.keys(this.ui.resolution).forEach(v => {
				this.ui.resolution[v].classList.toggle("active", v === s.resolution);
			});
		});

		// Projection modes
		Store.subscribe("projection", s => {
			Object.keys(this.ui.projection).forEach(v => {
				this.ui.projection[v].classList.toggle("active", v === s.projection);
			});
		});

		// View modes
		Store.subscribe("view", s => {

			// Change active View icon
			Object.keys(this.ui.view).forEach(i => {
				this.ui.view[i].classList.toggle("active", i === s.view);
			});

			// Enable/disable Layout & Resolution
			["layout", "resolution"].forEach(group => {
				Object.values(this.ui[group]).forEach(el => {
					el.toggleAttribute("disabled", s.view === "original");
				});
			});
		});
	}

	// Setup event listeners
	eventListeners() {

		// Keep seekbar past segment the correct width
		window.addEventListener("resize", Utils.debounce(() => this.seekbarPastSegment()));

		// Keep fullscreen state in sync with browser, e.g. Esc key
		document.addEventListener("fullscreenchange", () => {
			const isFullscreen = !!document.fullscreenElement;
			if (Store.get().fullscreen !== isFullscreen) {
				Store.set({ fullscreen: isFullscreen });
			}
		});

		// Drag-and-drop to open a video
		document.addEventListener("dragover", (e) => e.preventDefault());
		document.addEventListener("drop", (e) => {
			e.preventDefault();
			const files = e.dataTransfer?.files;
			if (!files || files.length !== 1) {
				return;
			}
			const dt = new DataTransfer();
			dt.items.add(files[0]);
			this.ui.splashInput.files = dt.files;
			this.ui.splashInput.dispatchEvent(new Event("change", { bubbles: true }));
		});
	}

	// Setup keyboard shortcuts
	keyboardShortcuts() {
		document.addEventListener("keydown", (e) => {

			// Ignore shortcuts on splash screen
			if (Store.get().splash) {
				return;
			}

			// Player controls (no modifiers)
			if (Utils.modifiers(e, [])) {
				const shortcuts = {
					KeyO:       () => this.openFile(),
					Space:      () => Store.toggle("playback"),
					ArrowLeft:  () => Store.set({ time: Store.get().time - this.seekAmount }),
					ArrowRight: () => Store.set({ time: Store.get().time + this.seekAmount }),
					Comma:      () => this.stepFrame(-1),
					Period:     () => this.stepFrame(1),

					KeyL:       () => {
						if (!Object.values(this.ui.layout)[0].disabled) {
							Store.toggle("layout", "layouts");
						}
					},
					KeyS:       () => {
						if (!Object.values(this.ui.resolution)[0].disabled) {
							Store.toggle("resolution", "resolutions");
						}
					},
					KeyP:       () => Store.toggle("projection", "projections"),
					KeyM:       () => Store.toggle("view", "views"),

					KeyV:       () => Store.toggle("volume"),
					KeyR:       () => Store.toggle("repeat"),
					KeyF:       () => Store.toggle("fullscreen"),
				};

				if (shortcuts[e.code]) {
					e.preventDefault();
					shortcuts[e.code]();
				}
			}
		});
	}

	// Open file dialog
	openFile() {
		this.ui.splashInput.value = "";
		this.ui.splashInput.click();
	}

	// Add event listeners for showing/hiding controls
	autoHideControls() {

		// Make controls visible (call when user interacts with app)
		const showControls = () => {
			// Use utility .hidden class to show/hide controls
			this.ui.controls.top.classList.remove("hidden");
			this.ui.controls.bottom.classList.remove("hidden");
			this.startControlsHideTimer();
		};

		// Show controls on any user interaction
		const events = ["mousemove", "mousedown", "keydown", "touchstart"];
		events.forEach(event => {
			document.addEventListener(event, showControls, { passive: true });
		});

		// Keep controls visible when hovering over them
		this.ui.controls.top.addEventListener("mouseenter", showControls);
		this.ui.controls.bottom.addEventListener("mouseenter", showControls);
		this.ui.controls.top.addEventListener("mouseleave", this.startControlsHideTimer.bind(this));
		this.ui.controls.bottom.addEventListener("mouseleave", this.startControlsHideTimer.bind(this));

		// Initial hide timer
		this.startControlsHideTimer();
	}

	// Start the hide timer
	startControlsHideTimer() {

		// Clear any existing timeout
		if (this.controlsHideTimeout) {
			clearTimeout(this.controlsHideTimeout);
			this.controlsHideTimeout = null;
		}

		// Set new timeout
		this.controlsHideTimeout = setTimeout(() => {
			if (!this.ui.controls.top.matches(":hover") && !this.ui.controls.bottom.matches(":hover")) {
				// Hide controls when not hovered
				this.ui.controls.top.classList.add("hidden");
				this.ui.controls.bottom.classList.add("hidden");
			}
		}, this.controlsHideDelay);
	}

	// Step frame +1 forward or -1 back
	stepFrame(direction) {
		const { playback, video, fps } = Store.get();
		if (playback) {
			Store.set({ playback: false });
		}

		const dt = 1 / fps, t = video.currentTime, eps = 1e-4;
		const k = direction > 0 ? Math.floor(t * fps) + 1 : Math.ceil(t * fps) - 1;

		video.currentTime = (k * dt) + (direction > 0 ? eps : -eps);
	}

	// Update size of seekbar past segment
	seekbarPastSegment() {
		const { duration, time } = Store.get();
		const seekbarWidth       = this.ui.seekbar.offsetWidth;

		const thumbWidth = parseFloat(getComputedStyle(document.documentElement)
			.getPropertyValue("--seekbar-height")
			.trim());

		const progressRatio    = duration > 0 ? time / duration : 0;
		const pastSegmentWidth = progressRatio * (seekbarWidth - thumbWidth) + thumbWidth / 2;

		this.ui.seekbar.style.setProperty("--seekbar-value", `${pastSegmentWidth}px`);
	}
}
