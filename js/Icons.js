export const Icons = {
	open: { icon: "fa-solid fa-folder-open", title: "Open Video (o)" },
	view: {
		watch:    { icon: "fa-solid fa-eye",   title: "Mono Mode (m)" },
		original: { icon: "fa-solid fa-film",    title: "Source Mode (m)" },
		anaglyph: { icon: "fa-solid fa-glasses", title: "Anaglyph Mode (m)" },
	},
	projection: {
		flat:  { icon: "fa-solid fa-table-cells",        title: "Flat Projection (p)" },
		vr180: { icon: "fa-solid fa-circle-half-stroke", title: "180º Projection (p)" },
		vr360: { icon: "fa-solid fa-circle",             title: "360º Projection (p)" },
	},
	layout: {
		sbs: { icon: "fa-solid fa-pause rotate-0",  title: "Side-by-Side Layout (l)" },
		ou:  { icon: "fa-solid fa-pause rotate-90", title: "Over-Under Layout (l)" },
	},
	eye: {
		left:  { icon: "fa-regular fa-eye fa-flip-horizontal", title: "Left Eye (e)" },
		right: { icon: "fa-regular fa-eye", title: "Right Eye (e)" },
	},
	resolution: {
		half: {
			sbs: { icon: "fa-solid fa-arrows-left-right",  title: "Double Size (s)" },
			ou:  { icon: "fa-solid fa-arrows-up-down",     title: "Double Size (s)" },
		},
		full: { icon: "fa-solid fa-expand", title: "Normal Size (s)" },
	},
	playback: {
		play:  { icon: "fa-solid fa-pause", title: "Pause (space)" },
		pause: { icon: "fa-solid fa-play",  title: "Play (space)" },
	},
	volume: {
		full: { icon: "fa-solid fa-volume-high",  title: "Full Volume (v)" },
		off:  { icon: "fa-solid fa-volume-xmark", title: "Volume Off (v)" },
	},
	repeat: {
		false: { icon: "fa-solid fa-repeat slash", title: "No Repeat (r)" },
		true:  { icon: "fa-solid fa-repeat",       title: "Repeat (r)" },
	},
	fullscreen: {
		enter: { icon: "fa-solid fa-expand",   title: "Enter Fullscreen (f)" },
		exit:  { icon: "fa-solid fa-compress", title: "Exit Fullscreen (f)" },
	},
};
