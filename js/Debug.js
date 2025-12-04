import { Store } from "./Store.js";

// Constants
const state = Store.get();
const debug = document.querySelector(".debug");

// Toggle debug controls with keyboard shortcut
window.addEventListener("keydown", (event) => {
	if (event.code === "Slash") {
		Store.toggle("debug");
	}
});
Store.subscribe("debug", (s) => {
	debug.classList.toggle("hidden", !s.debug);
});

// Debug controls map
const controls = [
	{ key: "antiR", label: "Filter Red from Left Eye" },
	{ key: "antiG", label: "Filter Green from Right Eye" },
	{ key: "antiB", label: "Filter Blue from Right Eye" },
	{ key: "balance", label: "Green Balance" },
	{ key: "convergence", label: "Eye Convergence" },
	{ key: "depthCompression", label: "Depth Compression" },
];
const controlKeys = controls.map(({ key }) => key);
const percentageKeys = new Set(["antiR", "antiG", "antiB", "balance", "depthCompression"]);
const sliders = new Map();

// Panel heading
const heading = document.createElement("p");
heading.className = "debug-title";
heading.textContent = "Debug Settings";
debug.appendChild(heading);

// Value clamping
const clamp = (value) => {
	if (Number.isNaN(value)) {
		return 0;
	}
	return Math.min(1, Math.max(0, value));
};

// Format numerical values
const formatValue = (key, value) => {
	const v = clamp(value);
	if (percentageKeys.has(key)) {
		return `${Math.round(v * 100)}%`;
	}
	if (key === "convergence") {
		return `${Math.round((v - 0.5) * 100)}%`;
	}
	return v.toFixed(2);
};

// Create sliders for each debug control
controls.forEach(({ key, label }) => {

	const wrapper = document.createElement("label");
	wrapper.className = "debug-control";
	wrapper.setAttribute("for", `debug-${key}`);

	const row = document.createElement("div");
	row.className = "debug-label";
	const title = document.createElement("span");
	title.textContent = label;
	const valueEl = document.createElement("span");
	valueEl.className = "debug-value";
	valueEl.textContent = formatValue(key, state[key]);
	row.appendChild(title);
	row.appendChild(valueEl);

	const slider = document.createElement("input");
	slider.className = "debug-slider";
	slider.type = "range";
	slider.min = "0";
	slider.max = "1";
	slider.step = "0.01";
	slider.id = `debug-${key}`;
	slider.value = clamp(state[key]).toString();
	slider.dataset.key = key;

	slider.addEventListener("input", (event) => {
		const target = event.currentTarget;
		const storeKey = target.dataset.key;
		const sliderValue = clamp(parseFloat(target.value));
		const formatted = formatValue(storeKey, sliderValue);
		target.value = sliderValue.toString();
		valueEl.textContent = formatted;
		if (Math.abs((Store.get(storeKey) ?? 0) - sliderValue) > 0.0001) {
			Store.set({ [storeKey]: sliderValue });
		}
	});

	wrapper.appendChild(row);
	wrapper.appendChild(slider);
	debug.appendChild(wrapper);

	sliders.set(key, { slider, valueEl });
});

// Keep slider values in sync with Store updates
const updateFromStore = (s) => {
	controls.forEach(({ key }) => {
		const entry = sliders.get(key);
		if (!entry) {
			return;
		}
		const value = clamp(s[key] ?? 0);
		entry.slider.value = value.toString();
		entry.valueEl.textContent = formatValue(key, value);
	});
};

// Update renderer when values change
Store.subscribe(controlKeys, (s) => {
	updateFromStore(s);
	const pipeline = s.pipeline;
	if (pipeline?.render) {
		pipeline.render.updateMaterial(s);
		pipeline.render.requestRender();
	}
});
