import { Store    } from "./Store.js";
import { Controls } from "./Controls.js";
import { Pipeline } from "./Pipeline.js";
import { Player   } from "./Player.js";
import "./Tooltips.js";

// Configure DOM elements
Store.set({
	video:  document.querySelector("video"),
	canvas: document.querySelector("canvas"),
});

// Initialize core components
const controls = new Controls();
const pipeline = new Pipeline();
const player   = new Player();

// Expose objects globally
Store.set({ controls, pipeline, player });
window.Store = Store;

// Ensure proper cleanup on window close/reload (dev HMR, navigation)
window.addEventListener("beforeunload", () => {
	try {
		pipeline.dispose();
	} catch (error) {
		console.error(error);
	};
});
