// Centralized shader strings and small shared GLSL chunks

// Shared GLSL helpers used across multiple shaders — getEquirectUV maps a 3D direction vector to equirectangular UVs
export const GLSL = {
	EQUIRECT_UV: `
	vec2 getEquirectUV(vec3 dir, float h_fov, float v_fov) {
		vec3 d = normalize(dir);
		float lambda = atan(d.x, -d.z);
		float phi = asin(clamp(d.y, -1.0, 1.0));
		float u = (lambda + h_fov / 2.0) / h_fov;
		float v = (phi + v_fov / 2.0) / v_fov;
		return vec2(u, v);
	}
	`,

	// sRGB <-> Linear conversion helpers for accurate color math
	COLORSPACE: `
	vec3 sRGBToLinear(vec3 c) {
		vec3 lo = c / 12.92;
		vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
		vec3 cond = step(vec3(0.04045), c);
		return mix(lo, hi, cond);
	}

	vec3 linearToSRGB(vec3 c) {
		c = max(c, vec3(0.0));
		vec3 lo = 12.92 * c;
		vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
		vec3 cond = step(vec3(0.0031308), c);
		return clamp(mix(lo, hi, cond), 0.0, 1.0);
	}
	`,
};

// Vertex shader used for VR materials (equirectangular mapping)
export const EQUIRECT_VERTEX_SHADER = `
	varying vec3 v_viewDirection;
	void main() {
		v_viewDirection = position;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

// Fragment shader for VR equirect watch/original sampling
export const EQUIRECT_FRAGMENT_SHADER = `
	uniform sampler2D map;
	uniform float u_h_fov_rad;
	uniform float u_v_fov_rad;
	uniform int uLayout; // 0 for SBS, 1 for OU
	uniform bool uIsWatchView;
	uniform bool uHalfRes; // true if resolution === 'half'

	varying vec3 v_viewDirection;

	${GLSL.EQUIRECT_UV}

	void main() {
		vec2 uv = getEquirectUV(v_viewDirection, u_h_fov_rad, u_v_fov_rad);

		if (uIsWatchView) {
			if (uLayout == 0) { // SBS
				if (uHalfRes) {
					uv.x = 0.25 + (uv.x - 0.5) * 0.25;
				} else {
					uv.x *= 0.5;
				}
			} else { // OU
				if (uHalfRes) {
					uv.y = 0.25 + (uv.y - 0.5) * 0.25;
				} else {
					uv.y *= 0.5;
				}
			}
		}

		gl_FragColor = texture2D(map, uv);
	}
`;

// Fragment shader for VR anaglyph rendering (Dubois)
export const ANAGLYPH_FRAGMENT_SHADER = `
	uniform sampler2D map;
	uniform float u_h_fov_rad;
	uniform float u_v_fov_rad;
	uniform int uLayout; // 0 = SBS, 1 = OU
	uniform int uSwapEyes; // 0 = normal, 1 = swap
	uniform bool uHalfRes; // true if resolution === 'half'
	varying vec3 v_viewDirection;

	${GLSL.EQUIRECT_UV}

	${GLSL.COLORSPACE}

	void main() {
		vec2 uv = getEquirectUV(v_viewDirection, u_h_fov_rad, u_v_fov_rad);

		vec2 uvL, uvR;
		if (uLayout == 0) { // SBS
			if (uHalfRes) {
				uvL = vec2(0.25 + (uv.x - 0.5) * 0.25, uv.y);
				uvR = vec2(0.75 + (uv.x - 0.5) * 0.25, uv.y);
			} else {
				uvL = vec2(uv.x * 0.5, uv.y);
				uvR = vec2(uv.x * 0.5 + 0.5, uv.y);
			}
		} else { // OU
			if (uHalfRes) {
				uvL = vec2(uv.x, 0.25 + (uv.y - 0.5) * 0.25);
				uvR = vec2(uv.x, 0.75 + (uv.y - 0.5) * 0.25);
			} else {
				uvL = vec2(uv.x, uv.y * 0.5);
				uvR = vec2(uv.x, uv.y * 0.5 + 0.5);
			}
		}
		if (uSwapEyes == 1) { vec2 t = uvL; uvL = uvR; uvR = t; }


		// Sample and linearize sRGB video texels for accurate Dubois math
		vec3 leftRGB  = sRGBToLinear(texture2D(map, uvL).rgb);
		vec3 rightRGB = sRGBToLinear(texture2D(map, uvR).rgb);

		// Dubois color anaglyph matrices
		mat3 ML = mat3(
			0.456100, -0.0400822, -0.0152161,
			0.500484, -0.0378246, -0.0205971,
			0.176381, -0.0157589, -0.00546856
		);
		mat3 MR = mat3(
			-0.0434706, 0.378476, -0.0721527,
			-0.0879388, 0.733640, -0.1129610,
			-0.00155529, -0.0184503, 1.2264000
		);
		vec3 colorLinear = clamp(ML * leftRGB + MR * rightRGB, 0.0, 1.0);
		vec3 colorSRGB = linearToSRGB(colorLinear);

		gl_FragColor = vec4(colorSRGB, 1.0);
	}
`;

// Vertex shader for flat-projection passes
export const FLAT_VERTEX_SHADER = `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

// Fragment shader for flat anaglyph rendering
export const ANAGLYPH_FLAT_FRAGMENT_SHADER = `
	uniform sampler2D map;
	uniform int uLayout; // 0 = SBS, 1 = OU
	uniform int uSwapEyes; // 0 = normal, 1 = swap
	varying vec2 vUv;

	${GLSL.COLORSPACE}

	void main() {
		vec2 uvL, uvR;
		if (uLayout == 0) { // SBS
			uvL = vec2(vUv.x * 0.5, vUv.y);
			uvR = vec2(vUv.x * 0.5 + 0.5, vUv.y);
		} else { // OU
			uvL = vec2(vUv.x, vUv.y * 0.5);
			uvR = vec2(vUv.x, vUv.y * 0.5 + 0.5);
		}
		if (uSwapEyes == 1) { vec2 t = uvL; uvL = uvR; uvR = t; }

		// Sample and linearize sRGB video texels for accurate Dubois math
		vec3 leftRGB  = sRGBToLinear(texture2D(map, uvL).rgb);
		vec3 rightRGB = sRGBToLinear(texture2D(map, uvR).rgb);

		// Dubois color anaglyph matrices
		mat3 ML = mat3(
			0.456100, -0.0400822, -0.0152161,
			0.500484, -0.0378246, -0.0205971,
			0.176381, -0.0157589, -0.00546856
		);
		mat3 MR = mat3(
			-0.0434706, 0.378476, -0.0721527,
			-0.0879388, 0.733640, -0.1129610,
			-0.00155529, -0.0184503, 1.2264000
		);
		vec3 colorLinear = clamp(ML * leftRGB + MR * rightRGB, 0.0, 1.0);
		vec3 colorSRGB = linearToSRGB(colorLinear);

		gl_FragColor = vec4(colorSRGB, 1.0);
	}
`;

// Fragment shader for flat watch view, sampling a single eye
export const WATCH_FLAT_FRAGMENT_SHADER = `
	uniform sampler2D map;
	uniform int uLayout; // 0 = SBS, 1 = OU
	varying vec2 vUv;

	void main() {
		vec2 uv = vUv;
		if (uLayout == 0) {
			uv = vec2(vUv.x * 0.5, vUv.y);
		} else {
			uv = vec2(vUv.x, vUv.y * 0.5);
		}
		gl_FragColor = texture2D(map, uv);
	}
`;
