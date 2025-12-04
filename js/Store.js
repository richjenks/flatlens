import { Repository } from "./Repository.js";

// Centralized app-wide state management
export const Store = new Repository({

	// App Objects
	controls: null,
	pipeline: null,
	player:   null,

	// DOM Elements
	video:  null, // <video> element for playback
	canvas: null, // <canvas> element for rendering

	// UI State
	splash:     true,  // Show splash screen on load
	playback:   false, // Playback state (playing/paused)
	volume:     true,  // Sound on/off
	repeat:     false, // Restart vudei at end?
	fullscreen: false, // Fullscreen state

	// Video Metadata
	name:     null, // Video file name
	file:     null, // Original File/Blob (for metadata reads)
	url:      null, // Video source URL
	time:     0,    // Current playback time (seconds)
	duration: null, // Total video duration (seconds)
	fps:      30,   // Video framerate

	// View Setting
	view: "watch",
	views: ["watch", "anaglyph", "original"],

	// Projection Setting
	projection: "flat",
	projections: ["flat", "vr180", "vr360"],

	// Layout Setting
	layout: "sbs",
	layouts: ["sbs", "ou"],

	// Resolution Setting
	resolution: "half",
	resolutions: ["half", "full"],

	// Eye Setting
	eye: "left",
	eyes: ["left", "right"],

	// Debug Settings
	debug: false,
	antiR: 0,
	antiG: 0,
	antiB: 0,
	balance: 0,
	convergence: 0.5,
	depthCompression: 0,
});
