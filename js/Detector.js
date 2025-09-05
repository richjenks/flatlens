import { Store } from "./Store.js";

// Gets information about a loaded HTML video element
export class Detector {

	// Detection methods
	static METHOD = {
		METADATA:   "metadata",
		FILENAME:   "filename",
		RESOLUTION: "resolution",
		DEFAULT:    "default",
	};

	// SBS filename patterns
	static SBS_KEYWORDS = [
		"SBS", "HSBS", "FSBS", "Half-SBS", "Side-by-Side",
		"3D.SBS", "3D-SBS", "sbs3d", "SBS3D",
	];

	// OU filename patterns
	static OU_KEYWORDS = [
		"OU", "HOU", "FOU", "Half-OU", "Over-Under",
		"TAB", "HTAB", "Top-Bottom", "TopBottom", "T-B",
	];

	// VR projection filename tokens
	static VR360_TOKENS = [
		"vr360", "360vr", "vr-360", "vr_360",
		"360video", "video360",
		"360pano", "pano360", "360photo", "photo360",
		"3603d", "3d360", "stereo360", "360stereo",
		"mono360", "360mono",
		"360-deg", "360deg", "360-degree",
		"360",
	];
	static VR180_TOKENS = [
		"vr180", "180vr", "vr-180", "vr_180",
		"1803d", "3d180", "vr1803d", "3dvr180", "stereo180", "180stereo",
		"180pano", "pano180",
		"front180", "f180",
		"180-deg", "180deg", "180-degree",
		"180x180",
		"180",
	];

	// Detects video layout, resolution, and projection.
	static async detect() {

		// Get store state
		const s = Store.get();

		// Step 1: Determine Layout (SBS or OU)
		const layoutResult = this.detectLayout(s);

		// Step 2: Determine Resolution (Full or Half)
		const resolutionResult = this.detectResolution(s, layoutResult.value);

		// Step 3: Determine Projection (vr180/vr360/flat)
		const projectionResult = await this.detectProjection(s);

		return {
			layout:     layoutResult,
			resolution: resolutionResult,
			projection: projectionResult,
		};
	}

	// Step 1: Determine Layout (SBS or OU)
	static detectLayout(s) {

		// Method 1. Check metadata (most reliable)
		const tracks = s.video.videoTracks || [];
		for (const track of tracks) {
			const mode = track.stereoMode?.toLowerCase() || "";
			if (mode.includes("left_right") || mode.includes("right_left")) {
				return { value: "sbs", method: this.METHOD.METADATA };
			}
			if (mode.includes("top_bottom") || mode.includes("bottom_top")) {
				return { value: "ou", method: this.METHOD.METADATA };
			}
		}

		// Method 2. Check filename hints (case-insensitive)
		const nameUpper = s.name.toUpperCase();
		if (this.SBS_KEYWORDS.some(kw => nameUpper.includes(kw))) {
			return { value: "sbs", method: this.METHOD.FILENAME };
		}
		if (this.OU_KEYWORDS.some(kw => nameUpper.includes(kw))) {
			return { value: "ou", method: this.METHOD.FILENAME };
		}

		// Method 3. Infer from resolution (aspect ratio)
		const { videoWidth: w, videoHeight: h } = s.video;
		const aspectRatio = w / h;

		// Width ÷ Height ≥ 2.8 → SBS (likely Full, with tolerance)
		if (aspectRatio >= 2.8) {
			return { value: "sbs", method: this.METHOD.RESOLUTION };
		}

		// Height ÷ Width ≥ 1.12 → OU (likely Full, with tolerance)
		if (aspectRatio <= 1.12) {
			return { value: "ou", method: this.METHOD.RESOLUTION };
		}

		// Method 4. Default to current value
		return { value: s.layout, method: this.METHOD.DEFAULT };
	}

	// Step 2: Determine Resolution (Full or Half)
	static detectResolution(s, layout) {

		// Get video dimensions and aspect ratio
		const { videoWidth: w, videoHeight: h } = s.video;
		const aspectRatio = w / h;

		if (layout === "sbs") {
			// For SBS, full resolution is very wide (e.g., 3840×1080)
			// Threshold between ~3.3 and ~3.6 to catch common SBS Full resolutions
			const isFull = aspectRatio >= 3.3;
			return {
				value: isFull ? "full" : "half",
				method: this.METHOD.RESOLUTION,
			};
		}  // ou
		// For OU, full resolution is very tall (e.g., 1920×2160)
		// Threshold below 1.0 for OU Full (taller than wide)
		const isFull = aspectRatio < 1.0;
		return {
			value: isFull ? "full" : "half",
			method: this.METHOD.RESOLUTION,
		};

		// No fallback — always returns nearest layout
	}

	// Step 3: Determine projection via metadata or filename
	static async detectProjection() {
		const s = Store.get();
		const lower = s.name.toLowerCase();

		// Method 1. Try container metadata first (MP4/MOV XMP; MKV/WebM ProjectionType)
		try {
			const meta = await this._detectProjectionFromMetadata(s.file, lower);
			if (meta) {
				return { value: meta, method: this.METHOD.METADATA };
			}
		} catch (error) {
			console.error(error);
		}

		// Method 2. Filename tokens (first match wins)
		if (this.VR360_TOKENS.some(t => lower.includes(t))) {
			return { value: "vr360", method: this.METHOD.FILENAME };
		}
		if (this.VR180_TOKENS.some(t => lower.includes(t))) {
			return { value: "vr180", method: this.METHOD.FILENAME };
		}

		// Method 3. Default to current value
		return { value: s.projection, method: this.METHOD.DEFAULT };
	}

	// Detect projection from container metadata.
	static async _detectProjectionFromMetadata(file, lowerName) {
		const isMp4  = lowerName.endsWith(".mp4");
		const isMov  = lowerName.endsWith(".mov");
		const isMkv  = lowerName.endsWith(".mkv");
		const isWebm = lowerName.endsWith(".webm");

		if (isMp4 || isMov) {
			const xmp = await this._extractXmpFromMp4(file);
			if (!xmp) {
				return null;
			}
			const projection = this._classifyFromXmp(xmp);
			return projection; // 'vr180' | 'vr360' | null
		}

		if (isMkv || isWebm) {
			const projType = await this._readMkvProjectionType(file);
			if (projType === 1) {
				return "vr360";
			}
			return null; // 0/2/3 or unknown → no classification
		}

		return null;
	}

	// Read a byte slice from a File/Blob or blob: URL (no network).
	static async _readBytes(fileOrUrl, start, length) {
		if (typeof fileOrUrl === "string") {
			// Only support blob: URLs to respect Offline First
			if (!fileOrUrl.startsWith("blob:")) {
				return null;
			}
			const res = await fetch(fileOrUrl);
			const blob = await res.blob();
			return blob.slice(start, start + length).arrayBuffer();
		} else if (fileOrUrl && typeof fileOrUrl.slice === "function") {
			return fileOrUrl.slice(start, start + length).arrayBuffer();
		}
		return null;
	}

	// Extract XMP packet from MP4/MOV by scanning initial bytes
	static async _extractXmpFromMp4(fileOrUrl) {
		const CHUNK = 16 * 1024 * 1024; // 16MB
		const buf = await this._readBytes(fileOrUrl, 0, CHUNK);
		if (!buf) {
			return null;
		}
		const bytes = new Uint8Array(buf);
		const text = this._asciiFromBytes(bytes);
		const startIdx = text.indexOf("<x:xmpmeta");
		if (startIdx === -1) {
			return null;
		}
		const endTag = "</x:xmpmeta>";
		const endIdx = text.indexOf(endTag, startIdx);
		if (endIdx === -1) {
			return null;
		}
		return text.slice(startIdx, endIdx + endTag.length);
	}

	// Convert bytes to a permissive ASCII string for tag scanning
	static _asciiFromBytes(bytes) {
		let s = "";
		for (let i = 0; i < bytes.length; i++) {
			const c = bytes[i];
			s += (c >= 32 && c <= 126) || c === 9 || c === 10 || c === 13 ? String.fromCharCode(c) : "\\u0000";
		}
		return s;
	}

	// Classify projection from XMP content.
	static _classifyFromXmp(xmp) {
		const get = (tag) => {
			const re = new RegExp(`<[^>]*${tag}[^>]*>([^<]+)<\\/[^>]*${tag}[^>]*>`, "i");
			const m = xmp.match(re);
			return m ? m[1].trim() : null;
		};
		const getAttr = (attr) => {
			const re = new RegExp(`${attr}="([^"]+)"`, "i");
			const m = xmp.match(re);
			return m ? m[1].trim() : null;
		};

		// ProjectionType can appear under GSpherical or GPano
		let proj =
			get("GSpherical:ProjectionType")
			|| get("GPano:ProjectionType")
			|| getAttr("GPano:ProjectionType")
			|| getAttr("GSpherical:ProjectionType");
		if (!proj) {
			return null;
		}
		proj = proj.toLowerCase();
		if (proj !== "equirectangular") {
			return null;
		}

		const toNum = (v) => (v ? parseFloat(v) : NaN);
		const fullW =
			toNum(get("GPano:FullPanoWidthPixels")
			|| get("GSpherical:FullPanoWidthPixels")
			|| getAttr("GPano:FullPanoWidthPixels")
			|| getAttr("GSpherical:FullPanoWidthPixels"));
		const fullH =
			toNum(get("GPano:FullPanoHeightPixels")
			|| get("GSpherical:FullPanoHeightPixels")
			|| getAttr("GPano:FullPanoHeightPixels")
			|| getAttr("GSpherical:FullPanoHeightPixels"));
		const cropW =
			toNum(get("GPano:CroppedAreaImageWidthPixels")
			|| get("GSpherical:CroppedAreaImageWidthPixels")
			|| getAttr("GPano:CroppedAreaImageWidthPixels")
			|| getAttr("GSpherical:CroppedAreaImageWidthPixels"));
		const cropH =
			toNum(get("GPano:CroppedAreaImageHeightPixels")
			|| get("GSpherical:CroppedAreaImageHeightPixels")
			|| getAttr("GPano:CroppedAreaImageHeightPixels")
			|| getAttr("GSpherical:CroppedAreaImageHeightPixels"));

		if (isFinite(fullW) && isFinite(fullH) && isFinite(cropW) && isFinite(cropH) && fullW > 0 && fullH > 0) {
			const wRatio = cropW / fullW;
			const hRatio = cropH / fullH;
			if (wRatio >= 0.49 && wRatio <= 0.51 && hRatio >= 0.95 && hRatio <= 1.05) {
				return "vr180";
			}
		}
		return "vr360";
	}

	// Minimal EBML walker to find Matroska Video.ProjectionType.
	static async _readMkvProjectionType(fileOrUrl) {
		// Read first 4MB which typically contains Tracks
		const CHUNK = 4 * 1024 * 1024;
		const buf = await this._readBytes(fileOrUrl, 0, CHUNK);
		if (!buf) {
			return null;
		}
		const dv = new DataView(buf);
		const len = dv.byteLength;
		let offset = 0;

		const readVint = (pos, forId = false) => {
			if (pos >= len) {
				return null;
			}
			const first = dv.getUint8(pos);
			let mask = 0x80;
			let width = 1;
			while (width <= 8 && (first & mask) === 0) {
				mask >>= 1;
				width++;
			}
			if (width > 8 || pos + width > len) {
				return null;
			}
			let value = forId ? first : (first & (~mask));
			for (let i = 1; i < width; i++) {
				value = (value << 8) | dv.getUint8(pos + i);
			}
			return { value, width };
		};

		let found = null;
		const seekWithin = (start, size, targetId, onEnter) => {
			let p = start;
			const end = start + size;

			while (p < end && found === null) {
				const id = readVint(p, true); if (!id) {
					break;
				} p += id.width;
				const sz = readVint(p, false); if (!sz) {
					break;
				} p += sz.width;
				if (id.value === targetId && found === null) {
					onEnter(p, sz.value);
				}
				p += sz.value;
			}
		};

		// IDs we care about
		const ID_TRACKS = 0x1654AE6B;
		const ID_TRACK_ENTRY = 0xAE;
		const ID_VIDEO = 0xE0;
		const ID_PROJECTION_TYPE = 0x7671; // unsigned int

		// Scan top-level to find Tracks
		while (offset < len && found === null) {
			const id = readVint(offset, true); if (!id) {
				break;
			} offset += id.width;
			const sz = readVint(offset, false); if (!sz) {
				break;
			} offset += sz.width;
			if (id.value === ID_TRACKS) {
				// Within Tracks: iterate TrackEntry
				seekWithin(offset, sz.value, ID_TRACK_ENTRY, (teStart, teSize) => {
					// Within TrackEntry: find Video
					seekWithin(teStart, teSize, ID_VIDEO, (vidStart, vidSize) => {
						// Within Video: look for ProjectionType
						let p = vidStart;
						const end = vidStart + vidSize;
						while (p < end && found === null) {
							const id2 = readVint(p, true); if (!id2) {
								break;
							} p += id2.width;
							const sz2 = readVint(p, false); if (!sz2) {
								break;
							} p += sz2.width;
							if (id2.value === ID_PROJECTION_TYPE) {
								// Read unsigned int value
								let val = 0;
								for (let i = 0; i < sz2.value; i++) {
									val = (val << 8) | dv.getUint8(p + i);
								}
								found = val;
							}
							p += sz2.value;
						}
					});
				});
			}
			// advance
			offset += sz.value;
		}

		return found;
	}
}
