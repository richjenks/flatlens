import { Store } from "./Store.js";
import { Utils } from "./Utils.js";
import tippy, { delegate, followCursor } from "tippy.js";
import "tippy.js/dist/tippy.css";

// Control tooltips
delegate(document.body, {
	target: "[data-tooltip]",
	allowHTML: true,
	hideOnClick: false,
	trigger: "mouseenter",
	onShow(instance) {
		const ref = instance.reference;
		const text = ref.getAttribute("data-tooltip") || "";
		instance.setContent(text);
	},
});

// Seekbar reference
const seekbar = document.querySelector(".controls-seekbar");

// Get seekbar time at pointer position
const hoveredTime = (e) => {
	const rect = seekbar.getBoundingClientRect();
	const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
	const ratio = x / rect.width;
	return ratio * Store.get().duration;
};

// Show the seekbar tooltip
tippy(seekbar, {
	plugins: [followCursor],
	followCursor: "horizontal",
	hideOnClick: false,
	trigger: "mouseenter",
	onTrigger(i, e) {
		i.setContent(Utils.timecode(hoveredTime(e), Store.get().duration));
	},
});

// Desktop hover updates
seekbar.addEventListener("mousemove", (e) => {
	const tip = seekbar._tippy;
	if (tip.state.isShown) {
		tip.setContent(Utils.timecode(hoveredTime(e), Store.get().duration));
	}
});

// Touch support: show on touch, update while moving, hide on end
seekbar.addEventListener("touchstart", (e) => {
	const t = seekbar._tippy;
	t.show();
	t.setContent(Utils.timecode(hoveredTime(e), Store.get().duration));
}, { passive: true });
seekbar.addEventListener("touchmove", (e) => {
	const t = seekbar._tippy;
	if (t.state.isShown) {
		t.setContent(Utils.timecode(hoveredTime(e), Store.get().duration));
	}
}, { passive: true });
seekbar.addEventListener("touchend", () => seekbar._tippy.hide(), { passive: true });
seekbar.addEventListener("touchcancel", () => seekbar._tippy.hide(), { passive: true });
