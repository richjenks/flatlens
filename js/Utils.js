// General-purpose utility functions
export class Utils {

	/**
	* Set icons for UI elements
	* @param {HTMLElement} el - The element to add the icon to
	* @param {{ icon: string, title: string }} { icon, title } - The icon and title to set
	*/
	static setIcon(el, { icon, title }) {

		// Get or create icon's DOM element
		let tag = el.querySelector("i");
		if (!tag) {
			tag = document.createElement("i");
			el.appendChild(tag);
		}

		// Set the icon's classes and tooltop
		tag.className      = icon;
		el.dataset.tooltip = title;
		if (el._tippy) {
			el._tippy.setContent(title);
		}
	}

	/**
	* Converts seconds into a formatted time string (HH:MM:SS or MM:SS)
	* @param {number} time - The time in seconds to format
	* @param {number} [duration=0] - Optional total duration (used to determine if hours should be shown)
	* @returns {string} Formatted time string (HH:MM:SS or MM:SS)
	* @example
	* Utils.timecode(90) // Returns "01:30"
	* Utils.timecode(3665) // Returns "01:01:05"
	* Utils.timecode(90, 3600) // Returns "00:01:30" (shows hours because duration > 1 hour)
	*/
	static timecode(time, duration = 0) {
		const h = Math.floor(time / 3600);
		const m = Math.floor((time % 3600) / 60);
		const s = Math.floor(time % 60);
		const showHours = h > 0 || Math.floor(duration / 3600) > 0;

		const pad = n => n.toString().padStart(2, "0");

		return showHours
			? `${h}:${pad(m)}:${pad(s)}`
			: `${m}:${pad(s)}`;
	}

	/**
	* Creates an animation-frame optimized debounced version of the given function
	* @param {Function} callback - The function to debounce
	* @returns {Function} Debounced function that runs on the next animation frame
	*/
	static debounce(callback) {
		let frame;
		return (...args) => {
			if (frame) {
				cancelAnimationFrame(frame);
			}
			frame = requestAnimationFrame(() => {
				callback(...args);
				frame = null;
			});
		};
	}

	/**
	* Executes a callback when an expression becomes truthy and self-cancels.
	* @param {Function} expression - Function that returns a truthy value when ready
	* @param {Function} callback - Function to call when expression is truthy
	* @example
	* Utils.wait(() => video.videoWidth > 0, () => {
		* 	console.log('Video is ready');
	* });
	*/
	static wait(expression, callback) {
		const tick = () => {
			if (expression()) {
				callback();
			} else {
				requestAnimationFrame(tick);
			}
		};
		requestAnimationFrame(tick);
	}

	/**
	* Checks if a keyboard event matches the exact combination of modifier keys
	* @param {KeyboardEvent} e - The keyboard event to check
	* @param {string[]} [activeModifiers=[]] - Array of modifier keys that should be active
	* @returns {boolean} True if the event matches exactly the specified modifiers, false otherwise
	* @example
	* // Check if only Shift is pressed
	* Utils.modifiers(e, ['shift'])
	*
	* // Check if Ctrl+Alt are pressed (and only those)
	* Utils.modifiers(e, ['ctrl', 'alt'])
	*
	* // Check if no modifiers are pressed
	* Utils.modifiers(e, [])
	*/
	static modifiers(e, activeModifiers = []) {
		const expected = {
			ctrl:  activeModifiers.includes("ctrl"),
			meta:  activeModifiers.includes("meta"),
			alt:   activeModifiers.includes("alt"),
			shift: activeModifiers.includes("shift"),
		};
		return e.ctrlKey === expected.ctrl &&
		e.metaKey === expected.meta &&
		e.altKey === expected.alt &&
		e.shiftKey === expected.shift;
	}

	/**
	* Determines if a projection is VR (perspective) based.
	* @param {string} projection - One of 'flat', 'vr180', 'vr360'
	* @returns {boolean} True if VR projection
	*/
	static isVrProjection(projection) {
		return projection === "vr180" || projection === "vr360";
	}

	/**
	* Returns the current aspect ratio of a canvas element.
	* @param {HTMLCanvasElement} canvas - Target canvas
	* @returns {number} Aspect ratio (width/height)
	*/
	static currentAspect(canvas) {
		const { clientWidth: cw = 1, clientHeight: ch = 1 } = canvas || {};
		return cw && ch ? cw / ch : 16 / 9;
	}

	/**
	* Computes the effective content dimensions based on view/layout/resolution/projection.
	* @param {HTMLVideoElement} video - Source video element
	* @param {{ view: string, layout: 'sbs'|'ou', resolution: 'half'|'full', projection: string }} opts
	* @returns {{ width: number, height: number }} Effective content size in pixels
	*/
	static contentDimensions(video, opts) {
		const { videoWidth: vw = 0, videoHeight: vh = 0 } = video || {};
		const { view, layout, resolution, projection } = opts;
		let contentW = vw;
		let contentH = vh;
		if ((view === "watch" || view === "anaglyph") && !this.isVrProjection(projection)) {
			if (layout === "sbs") {
				contentW = (resolution === "full") ? vw / 2 : vw;
			} else {
				contentH = (resolution === "full") ? vh / 2 : vh;
			}
		}
		return { width: contentW, height: contentH };
	}

	/**
	* Computes orthographic camera extents to preserve aspect.
	* @param {number} canvasAspect - Canvas width/height
	* @param {number} contentAspect - Content width/height
	* @returns {{ left:number,right:number,top:number,bottom:number }} Ortho extents
	*/
	static orthoExtents(canvasAspect, contentAspect) {
		let scaleX = 1, scaleY = 1;
		if (canvasAspect > contentAspect) {
			scaleX = canvasAspect / contentAspect;
		} else {
			scaleY = contentAspect / canvasAspect;
		}
		return { left: -scaleX, right: scaleX, top: scaleY, bottom: -scaleY };
	}

	/**
	* Converts vertical FOV (deg) to horizontal FOV (deg) for a given aspect.
	* @param {number} vFovDeg - Vertical FOV in degrees
	* @param {number} aspect - Width/height
	* @returns {number} Horizontal FOV in degrees
	*/
	static vFovDegToHFovDeg(vFovDeg, aspect) {
		return 2 * (180 / Math.PI) * Math.atan(Math.tan((Math.PI / 180) * (vFovDeg / 2)) * aspect);
	}

	/**
	* Converts horizontal FOV (deg) to vertical FOV (deg) for a given aspect.
	* @param {number} hFovDeg - Horizontal FOV in degrees
	* @param {number} aspect - Width/height
	* @returns {number} Vertical FOV in degrees
	*/
	static hFovDegToVFovDeg(hFovDeg, aspect) {
		return 2 * (180 / Math.PI) * Math.atan(Math.tan((Math.PI / 180) * (hFovDeg / 2)) / aspect);
	}

	/**
	* Clamps the camera vertical FOV to projection and zoom bounds.
	* @param {number} vFov - Current vertical FOV in degrees
	* @param {{ min:number, max:number, projVFovDeg:number, projHFovDeg?:number, aspect:number }} args
	* @returns {number} Clamped vertical FOV in degrees
	*/
	static clampFov(vFov, { min, max, projVFovDeg, projHFovDeg, aspect }) {
		const vMax = Math.min(max, projVFovDeg - 1.0); // epsilon to avoid edge singularity
		let clamped = vFov;
		if (projHFovDeg && projHFovDeg === 180) {
			const vFromH = this.hFovDegToVFovDeg(Math.max(1.0, projHFovDeg - 1.0), aspect);
			clamped = Math.min(clamped, vFromH);
		}
		clamped = Math.max(min, Math.min(vMax, clamped));
		return clamped;
	}

	/**
	* Clamps yaw/pitch based on projection and current FOVs.
	* @param {number} yaw - Current yaw in radians
	* @param {number} pitch - Current pitch in radians
	* @param {{ projHFovDeg:number, projVFovDeg:number, currentVFovDeg:number, currentHFovDeg:number }} args
	* @returns {{ yaw:number, pitch:number }} Clamped yaw/pitch
	*/
	static clampYawPitch(yaw, pitch, { projHFovDeg, projVFovDeg, currentVFovDeg, currentHFovDeg }) {
		// Clamp pitch
		const pitchLimit = ((projVFovDeg - currentVFovDeg) / 2) * (Math.PI / 180);
		const newPitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
		// Clamp or wrap yaw
		let newYaw = yaw;
		if (projHFovDeg === 180) {
			const yawLimit = ((projHFovDeg - currentHFovDeg) / 2) * (Math.PI / 180);
			newYaw = Math.max(-yawLimit, Math.min(yawLimit, newYaw));
		} else {
			newYaw = newYaw % (2 * Math.PI);
		}
		return { yaw: newYaw, pitch: newPitch };
	}

	/**
	* Computes new vertical FOV from mouse wheel input.
	* @param {number} currentVFovDeg - Current vertical FOV (deg)
	* @param {number} wheelDeltaY - Wheel delta
	* @param {number} sensitivity - Zoom sensitivity multiplier
	* @returns {number} New vertical FOV (deg) before clamping
	*/
	static zoomFromWheel(currentVFovDeg, wheelDeltaY, sensitivity) {
		return currentVFovDeg + wheelDeltaY * sensitivity;
	}

	/**
	* Applies drag deltas to yaw/pitch using sensitivity.
	* @param {number} yaw - Current yaw (rad)
	* @param {number} pitch - Current pitch (rad)
	* @param {number} dx - Drag delta X (px)
	* @param {number} dy - Drag delta Y (px)
	* @param {number} sensitivity - Radians per pixel
	* @returns {{ yaw:number, pitch:number }} Updated yaw/pitch
	*/
	static dragToYawPitch(yaw, pitch, dx, dy, sensitivity) {
		return { yaw: yaw + dx * sensitivity, pitch: pitch + dy * sensitivity };
	}

}
