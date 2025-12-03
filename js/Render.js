import * as THREE from "three";
import { Utils } from "./Utils.js";
import * as Shaders from "./Shaders.js";

const SETTINGS = {
	VR_VFOV_DEG: 100, // Default camera vertical FOV for VR
	VR_VFOV_MIN_DEG: 20, // Min/max camera vertical FOV for zoom
	VR_VFOV_MAX_DEG: 179, // Epsilon away from 180 to avoid shader singularity

	SPHERE_RADIUS: 100, // Large enough to feel immersive
	SPHERE_WIDTH_SEGMENTS: 128,
	SPHERE_HEIGHT_SEGMENTS: 128,
	CAMERA_NEAR: 0.1,
	CAMERA_FAR: 1000,
	CAMERA_DEFAULT_Z: 1, // for ortho camera
	CLEAR_COLOR: 0x000000,
	PIXEL_RATIO_MAX: 2,

	DRAG_SENSITIVITY: 0.005, // Radians per pixel
	ZOOM_SENSITIVITY: 0.02,

	VR180_EDGE_FEATHER_U: 0.05,
	VR180_EDGE_FEATHER_V: 0.05,
};

// Manages Three.js rendering, including scene, camera, and geometry.
export class Render {

	// Three.js core
	webgl;
	scene;
	camera;

	// Scene content
	mesh;
	videoTexture;

	// Camera cache
	orthoCamera;
	perspCamera;

	// External references
	canvas;
	video;

	// Derived projection info
	_projHFovDeg = null;
	_projVFovDeg = null;

	// Interaction state
	isDragging = false;
	dragLastX = 0;
	dragLastY = 0;
	yaw = 0;
	pitch = 0;
	cleanupInteractions = () => {};

	// Animation frame handle
	frame = null;

	constructor(video, canvas) {
		this.video  = video;
		this.canvas = canvas;

		this._initWebGL();
		this._initScene();
		this._initCameras();
		this._initVideoTexture();
		this._initMesh();
		this.cleanupInteractions = this._initInteractions();
	}

	// --- Initialization ---

	_initWebGL() {
		this.webgl = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			alpha: true,
			premultipliedAlpha: false,
			powerPreference: "high-performance",
		});
		this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, SETTINGS.PIXEL_RATIO_MAX));
		this.webgl.outputColorSpace = THREE.SRGBColorSpace;
		this.webgl.toneMapping = THREE.NoToneMapping;
		this.webgl.setClearColor(SETTINGS.CLEAR_COLOR, 0);
	}

	_initScene() {
		this.scene = new THREE.Scene();
	}

	_initCameras() {
		this.orthoCamera = this._createOrthographicCamera();
		this.perspCamera = this._createPerspectiveCamera();
		this.camera = this.orthoCamera; // Default to orthographic
	}

	_initVideoTexture() {
		this.videoTexture = new THREE.VideoTexture(this.video);
		this.videoTexture.colorSpace = THREE.SRGBColorSpace;
		this.videoTexture.minFilter = THREE.LinearFilter;
		this.videoTexture.magFilter = THREE.LinearFilter;
		this.videoTexture.generateMipmaps = false;
	}

	_initMesh() {
		const geometry = new THREE.PlaneGeometry(2, 2);
		const material = new THREE.MeshBasicMaterial({ map: this.videoTexture, side: THREE.DoubleSide });
		this.mesh = new THREE.Mesh(geometry, material);
		this.scene.add(this.mesh);
	}

	_initInteractions() {
		const el = this.canvas;
		if (!el) {
			return () => {};
		}

		const handlers = {
			mousedown: this._onPointerDown.bind(this),
			mousemove: this._onPointerMove.bind(this),
			mouseup: this._onPointerUp.bind(this),
			touchstart: this._onTouchStart.bind(this),
			touchmove: this._onTouchMove.bind(this),
			touchend: this._onPointerUp.bind(this),
			wheel: this._onWheel.bind(this),
		};

		el.addEventListener("mousedown", handlers.mousedown);
		el.addEventListener("mousemove", handlers.mousemove);
		window.addEventListener("mouseup", handlers.mouseup);
		el.addEventListener("touchstart", handlers.touchstart, { passive: false });
		el.addEventListener("touchmove", handlers.touchmove, { passive: false });
		el.addEventListener("touchend", handlers.touchend);
		el.addEventListener("wheel", handlers.wheel, { passive: false });

		return () => {
			el.removeEventListener("mousedown", handlers.mousedown);
			el.removeEventListener("mousemove", handlers.mousemove);
			window.removeEventListener("mouseup", handlers.mouseup);
			el.removeEventListener("touchstart", handlers.touchstart);
			el.removeEventListener("touchmove", handlers.touchmove);
			el.removeEventListener("touchend", handlers.touchend);
			el.removeEventListener("wheel", handlers.wheel);
		};
	}

	// --- Public API & State Changers ---

	start() {
		if (this.frame) {
			return;
		}
		const loop = () => {
			this.renderFrame();
			this.frame = requestAnimationFrame(loop);
		};
		this.frame = requestAnimationFrame(loop);
	}

	stop() {
		if (this.frame) {
			cancelAnimationFrame(this.frame);
			this.frame = null;
		}
	}

	renderFrame() {
		if (this.videoTexture?.image?.readyState >= 2 && this.videoTexture.image.videoWidth > 0) {
			this.videoTexture.needsUpdate = true;
		}
		this.webgl.render(this.scene, this.camera);
	}

	requestRender() {
		if (!this.frame) {
			this.renderFrame();
		}
	}

	// Resize render targets and update camera from current state
	resize(s) {
		if (!this.canvas || !this.video) {
			return;
		}

		const { clientWidth: cw, clientHeight: ch } = this.canvas;
		const { videoWidth: vw, videoHeight: vh } = this.video;
		if (!cw || !ch || !vw || !vh) {
			return;
		}

		this.webgl.setSize(cw, ch, false);

		if (this.camera.isPerspectiveCamera) {
			this.camera.aspect = cw / ch;
			this._applyPanAndZoomClamps();
		} else {
			const canvasAspect = cw / ch;
			const contentDims = Utils.contentDimensions(this.video, s);
			const contentAspect = contentDims.width / contentDims.height;
			const extents = Utils.orthoExtents(canvasAspect, contentAspect);
			this.camera.left = extents.left;
			this.camera.right = extents.right;
			this.camera.top = extents.top;
			this.camera.bottom = extents.bottom;
		}

		this.camera.updateProjectionMatrix();
		this.renderFrame();
	}

	setVideo(video) {
		this.video = video;
		if (!this.videoTexture) {
			this._initVideoTexture();
		} else {
			this.videoTexture.image = video;
			this.videoTexture.needsUpdate = true;
		}
	}

	// Apply view mode and refresh geometry/materials
	setView(s) {
		this._applyProjectionAndViewGeometry(s.projection);
		this.updateMaterial(s);
		this.resize(s);
	}

	// Apply layout and refresh materials
	setLayout(s) {
		this.updateMaterial(s);
		this.resize(s);
	}

	/**
	 * Switch between left and right eyes
	 */
	setEye(s) {
		this.updateMaterial(s);
		this.requestRender();
	}

	// Apply resolution and refresh materials
	setResolution(s) {
		this.updateMaterial(s);
		this.resize(s);
	}

	// Apply projection and refresh geometry/materials
	setProjection(s) {
		this._applyProjectionAndViewGeometry(s.projection);
		this.updateMaterial(s);
		this.resize(s);
	}

	// Recreate or update material for current state (minimal branching)
	updateMaterial(s) {
		if (!this.mesh) {
			return;
		}

		const isVr = this._isVrProjection(s.projection);
		const view = s.view;
		const intendedType = isVr
			? (view === "anaglyph" ? "vr-anaglyph" : "vr-equirect")
			: (view === "anaglyph" ? "flat-anaglyph" : (view === "watch" ? "flat-watch" : "flat-basic"));

		const currentType = this.mesh.material?.userData?.type;
		if (currentType !== intendedType) {
			if (this.mesh.material) {
				this.mesh.material.dispose();
			}
			if (isVr) {
				this.mesh.material = (view === "anaglyph")
					? this._createAnaglyphVrMaterial(s)
					: this._createEquirectMaterial(s);
			} else if (view === "anaglyph") {
				this.mesh.material = this._createAnaglyphFlatMaterial(s);
			} else if (view === "watch") {
				this.mesh.material = this._createWatchFlatMaterial(s);
			} else {
				this.mesh.material = new THREE.MeshBasicMaterial({ map: this.videoTexture });
			}
			this.mesh.material.userData.type = intendedType;
		}

		// Update any uniforms that exist (handles minor state changes without recreating)
		this._updateMaterialUniforms(this.mesh.material, s);

		// All VR materials need to see the inside of the sphere
		this.mesh.material.side = isVr ? THREE.BackSide : THREE.FrontSide;
	}

	// Update present uniforms in a material generically
	_updateMaterialUniforms(mat, s) {
		const u = mat.uniforms;
		if (!u) {
			return;
		}
		// Texture
		if (u.map) {
			u.map.value = this.videoTexture;
		}
		// FOV
		if (u.u_h_fov_rad) {
			u.u_h_fov_rad.value = (s.projection === "vr180") ? Math.PI : (Math.PI * 2);
		}
		if (u.u_v_fov_rad) {
			u.u_v_fov_rad.value = Math.PI;
		}
		// Layout
		if (u.uLayout) {
			u.uLayout.value = (s.layout === "sbs" ? 0 : 1);
		}
		// Resolution
		if (u.uHalfRes) {
			u.uHalfRes.value = (s.resolution === "half");
		}
		// Watch flag (VR equirect)
		if (u.uIsWatchView) {
			u.uIsWatchView.value = (s.view === "watch");
		}
		// Mono eye selector
		if (u.uLeftEye) {
			u.uLeftEye.value = (s.eye !== "right");
		}
		// VR edge feathering
		if (u.uEdgeFeather) {
			const feather = this._edgeFeatherForProjection(s.projection);
			u.uEdgeFeather.value.set(feather.u, feather.v);
		}
	}

	dispose() {
		this.stop();
		this.cleanupInteractions();
		if (this.webgl) {
			this.webgl.dispose();
		}
		if (this.scene) {
			this.scene.traverse(object => {
				if (object.geometry) {
					object.geometry.dispose();
				}
				if (object.material) {
					object.material.dispose();
				}
			});
		}
		if (this.videoTexture) {
			this.videoTexture.dispose();
		}
	}

	// --- Event Handlers ---

	_onPointerDown(e) {
		if (!this.camera?.isPerspectiveCamera) {
			return;
		}
		this._handleDragStart(e.clientX, e.clientY);
		e.preventDefault();
	}

	_onPointerMove(e) {
		if (!this.isDragging || !this.camera?.isPerspectiveCamera) {
			return;
		}
		this._handleDragMove(e.clientX, e.clientY);
		e.preventDefault();
	}

	_onPointerUp() {
		this.isDragging = false;
	}

	_onTouchStart(e) {
		if (!this.camera?.isPerspectiveCamera || e.touches.length !== 1) {
			return;
		}
		const touch = e.touches[0];
		this._handleDragStart(touch.clientX, touch.clientY);
		e.preventDefault();
	}

	_onTouchMove(e) {
		if (!this.camera?.isPerspectiveCamera || !this.isDragging || e.touches.length !== 1) {
			return;
		}
		const touch = e.touches[0];
		this._handleDragMove(touch.clientX, touch.clientY);
		e.preventDefault();
	}

	_onWheel(e) {
		if (!this.camera?.isPerspectiveCamera) {
			return;
		}

		const delta = e.deltaY;
		this.camera.fov = Utils.zoomFromWheel(this.camera.fov, delta, SETTINGS.ZOOM_SENSITIVITY);
		this._applyPanAndZoomClamps(); // This will clamp FOV and update projection matrix
		this.requestRender();
		e.preventDefault();
	}

	// --- Internal Helpers ---

	_createOrthographicCamera() {
		const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, SETTINGS.CAMERA_NEAR, SETTINGS.CAMERA_FAR);
		cam.position.z = SETTINGS.CAMERA_DEFAULT_Z;
		return cam;
	}

	_createPerspectiveCamera() {
		const { clientWidth: cw, clientHeight: ch } = this.canvas;
		const aspect = (cw && ch) ? cw / ch : 16 / 9;
		const cam = new THREE.PerspectiveCamera(
			SETTINGS.VR_VFOV_DEG,
			aspect,
			SETTINGS.CAMERA_NEAR,
			SETTINGS.CAMERA_FAR,
		);
		cam.position.set(0, 0, 0);
		return cam;
	}

	_createVrGeometry(projection) {
		const hFov = (projection === "vr180") ? 180 : (projection === "vr360") ? 360 : 0;
		const vFov = (projection === "vr180" || projection === "vr360") ? 180 : 0;
		this._projHFovDeg = hFov;
		this._projVFovDeg = vFov;
		const hFovRad = THREE.MathUtils.degToRad(hFov);

		// Center projection around camera's -Z axis
		const thetaStart = -hFovRad / 2 - Math.PI / 2;

		return new THREE.SphereGeometry(
			SETTINGS.SPHERE_RADIUS,
			SETTINGS.SPHERE_WIDTH_SEGMENTS,
			SETTINGS.SPHERE_HEIGHT_SEGMENTS,
			thetaStart, // phiStart in older three.js
			hFovRad,    // phiLength
			0,          // thetaStart
			Math.PI,     // thetaLength
		);
	}

	_createEquirectMaterial(s) {
		const { layout, view, projection, resolution, eye } = s;
		// Precompute radians to avoid per-call conversions
		const hFovRad = (projection === "vr180") ? Math.PI : (Math.PI * 2);
		const vFovRad = Math.PI;

		return new THREE.ShaderMaterial({
			uniforms: {
				map: { value: this.videoTexture },
				u_h_fov_rad: { value: hFovRad },
				u_v_fov_rad: { value: vFovRad },
				uLayout: { value: layout === "sbs" ? 0 : 1 },
				uIsWatchView: { value: view === "watch" },
				uHalfRes: { value: resolution === "half" },
				uLeftEye: { value: eye !== "right" },
				uEdgeFeather: { value: new THREE.Vector2(0, 0) },
			},
			vertexShader: Shaders.EQUIRECT_VERTEX_SHADER,
			fragmentShader: Shaders.EQUIRECT_FRAGMENT_SHADER,
		});
	}

	_createAnaglyphVrMaterial(s) {
		const { layout, projection, resolution } = s;
		// Precompute radians to avoid per-call conversions
		const hFovRad = (projection === "vr180") ? Math.PI : (Math.PI * 2);
		const vFovRad = Math.PI;

		const mat = new THREE.ShaderMaterial({
			uniforms: {
				map: { value: this.videoTexture },
				u_h_fov_rad: { value: hFovRad },
				u_v_fov_rad: { value: vFovRad },
				uLayout: { value: layout === "sbs" ? 0 : 1 },
				uSwapEyes: { value: 0 },
				uHalfRes: { value: resolution === "half" },
				uEdgeFeather: { value: new THREE.Vector2(0, 0) },
			},
			vertexShader: Shaders.EQUIRECT_VERTEX_SHADER,
			fragmentShader: Shaders.ANAGLYPH_FRAGMENT_SHADER,
		});
		mat.toneMapped = false; // Avoid renderer applying tone mapping to custom shader output
		return mat;
	}

	_createAnaglyphFlatMaterial(s) {
		const { layout } = s;
		const mat = new THREE.ShaderMaterial({
			uniforms: {
				map: { value: this.videoTexture },
				uLayout: { value: layout === "sbs" ? 0 : 1 },
				uSwapEyes: { value: 0 },
			},
			vertexShader: Shaders.FLAT_VERTEX_SHADER,
			fragmentShader: Shaders.ANAGLYPH_FLAT_FRAGMENT_SHADER,
		});
		mat.toneMapped = false; // Avoid renderer applying tone mapping to custom shader output
		return mat;
	}

	// Create flat-projection Watch material (samples a single eye)
	_createWatchFlatMaterial(s) {
		const { layout, eye } = s;
		return new THREE.ShaderMaterial({
			uniforms: {
				map: { value: this.videoTexture },
				uLayout: { value: layout === "sbs" ? 0 : 1 },
				uLeftEye: { value: eye !== "right" },
			},
			vertexShader: Shaders.FLAT_VERTEX_SHADER,
			fragmentShader: Shaders.WATCH_FLAT_FRAGMENT_SHADER,
		});
	}

	_isVrProjection(projection) {
		return Utils.isVrProjection(projection);
	}

	_handleDragStart(clientX, clientY) {
		this.isDragging = true;
		this.dragLastX = clientX;
		this.dragLastY = clientY;
	}

	_handleDragMove(clientX, clientY) {
		const dx = clientX - this.dragLastX;
		const dy = clientY - this.dragLastY;
		this._applyDragDelta(dx, dy);
		this.dragLastX = clientX;
		this.dragLastY = clientY;
		this.requestRender();
	}

	_applyDragDelta(dx, dy) {
		const res = Utils.dragToYawPitch(this.yaw, this.pitch, dx, dy, SETTINGS.DRAG_SENSITIVITY);
		this.yaw = res.yaw;
		this.pitch = res.pitch;
		this._applyPanAndZoomClamps();
	}

	_applyProjectionAndViewGeometry(projection) {
		const isVr = this._isVrProjection(projection);

		this.camera = isVr ? this.perspCamera : this.orthoCamera;

		if (this.mesh.geometry) {
			this.mesh.geometry.dispose();
		}
		this.mesh.geometry = isVr ? this._createVrGeometry(projection) : new THREE.PlaneGeometry(2, 2);

		if (isVr) {
			// Reset orientation when switching to VR mode
			this.yaw = 0;
			this.pitch = 0;
			this.perspCamera.fov = SETTINGS.VR_VFOV_DEG;
			this._applyPanAndZoomClamps();
		} else {
			this.camera.rotation.set(0, 0, 0);
		}
	}

	_applyPanAndZoomClamps() {
		if (!this.camera?.isPerspectiveCamera) {
			return;
		}

		const aspect = Utils.currentAspect(this.canvas);
		const projHFovDeg = this._projHFovDeg;
		const projVFovDeg = this._projVFovDeg;

		// Clamp camera FOV
		const unclampedVFov = this.camera.fov;
		this.camera.fov = Utils.clampFov(unclampedVFov, {
			min: SETTINGS.VR_VFOV_MIN_DEG,
			max: SETTINGS.VR_VFOV_MAX_DEG,
			projVFovDeg,
			projHFovDeg,
			aspect,
		});
		this.camera.updateProjectionMatrix();

		// Recompute H/V FOVs and clamp yaw/pitch
		const currentVFovDeg = this.camera.fov;
		const currentHFovDeg = Utils.vFovDegToHFovDeg(currentVFovDeg, aspect);
		const clamped = Utils.clampYawPitch(this.yaw, this.pitch, {
			projHFovDeg,
			projVFovDeg,
			currentVFovDeg,
			currentHFovDeg,
		});
		this.yaw = clamped.yaw;
		this.pitch = clamped.pitch;
		this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
	}

	/**
	 * Return normalized UV edge feather values for a projection mode.
	 * @param {string} projection Current projection identifier.
	 * @returns {{u: number, v: number}} Fractional feather widths per axis.
	 */
	_edgeFeatherForProjection(projection) {
		if (projection === "vr180") {
			return {
				u: SETTINGS.VR180_EDGE_FEATHER_U,
				v: SETTINGS.VR180_EDGE_FEATHER_V,
			};
		}
		return { u: 0, v: 0 };
	}

}
