import { Repository } from "./Repository.js";

// Centralized app-wide state management
export const Store = new Repository({

	// App objects
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
	views: ["watch", "original", "anaglyph"],

	// Projection Setting
	projection: "flat",
	projections: ["flat", "vr180", "vr360"],

	// Layout Setting
	layout: "sbs",
	layouts: ["sbs", "ou"],

	// Resolution Setting
	resolution: "half",
	resolutions: ["half", "full"],
});
