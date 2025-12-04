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

	EDGE_FEATHER: `
	float featherAxis(float coord, float feather) {
		if (feather <= 0.0) {
			return 1.0;
		}
		float nearEdge = smoothstep(0.0, feather, coord);
		float farEdge = smoothstep(0.0, feather, 1.0 - coord);
		return nearEdge * farEdge;
	}

	float edgeFade(vec2 uv, vec2 feather) {
		return featherAxis(uv.x, feather.x) * featherAxis(uv.y, feather.y);
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
	uniform bool uLeftEye;
	uniform vec2 uEdgeFeather;

	varying vec3 v_viewDirection;

	${GLSL.EQUIRECT_UV}
	${GLSL.EDGE_FEATHER}

	void main() {
		vec2 uv = getEquirectUV(v_viewDirection, u_h_fov_rad, u_v_fov_rad);
		float fade = edgeFade(uv, uEdgeFeather);
		vec2 sampleUv = uv;

		if (uIsWatchView) {
			bool leftEye = uLeftEye;
			if (uLayout == 0) { // SBS
				if (uHalfRes) {
					sampleUv.x = leftEye ? 0.25 + (uv.x - 0.5) * 0.25 : 0.75 + (uv.x - 0.5) * 0.25;
				} else {
					sampleUv.x = leftEye ? uv.x * 0.5 : uv.x * 0.5 + 0.5;
				}
			} else { // OU
				if (uHalfRes) {
					sampleUv.y = leftEye ? 0.25 + (uv.y - 0.5) * 0.25 : 0.75 + (uv.y - 0.5) * 0.25;
				} else {
					sampleUv.y = leftEye ? uv.y * 0.5 : uv.y * 0.5 + 0.5;
				}
			}
		}

		vec4 tex = texture2D(map, sampleUv);
		gl_FragColor = vec4(tex.rgb * fade, tex.a);
	}
`;

// Fragment shader for VR anaglyph rendering (simple red/cyan)
export const ANAGLYPH_FRAGMENT_SHADER = `
	uniform sampler2D map;
	uniform float u_h_fov_rad;
	uniform float u_v_fov_rad;
	uniform int uLayout; // 0 = SBS, 1 = OU
	uniform int uSwapEyes; // 0 = normal, 1 = swap
	uniform bool uHalfRes; // true if resolution === 'half'
	uniform vec2 uEdgeFeather;
	uniform float uAntiRed;
	uniform float uAntiGreen;
	uniform float uAntiBlue;
	uniform float uGreenBalance;
	uniform float uConvergence;
	uniform float uDepth;
	varying vec3 v_viewDirection;

	${GLSL.EQUIRECT_UV}

	${GLSL.EDGE_FEATHER}

	void main() {
		const float MAX_SHIFT = 0.01;
		const float SBS_LEFT_CENTER = 0.25;
		const float SBS_RIGHT_CENTER = 0.75;
		const float OU_TOP_CENTER = 0.25;
		const float OU_BOTTOM_CENTER = 0.75;
		const float LUMA_R = 0.2126;
		const float LUMA_G = 0.7152;
		const float LUMA_B = 0.0722;

		vec2 uv = getEquirectUV(v_viewDirection, u_h_fov_rad, u_v_fov_rad);
		float fade = edgeFade(uv, uEdgeFeather);

		vec2 uvL, uvR;
		vec2 baseL, baseR;
	float convergence = clamp(uConvergence, 0.0, 1.0);
	float depthAmount = clamp(uDepth, 0.0, 1.0) * 0.1;
	float shift = MAX_SHIFT * ((convergence - 0.5) * 2.0);
	if (uLayout == 1) {
		shift = 0.0;
	}
		if (uLayout == 1) {
			shift = 0.0; // OU uses shared width; skip convergence shift
		}
		bool isOU = (uLayout == 1);

		if (!isOU) { // SBS
			if (uHalfRes) {
				baseL = vec2(0.25 + (uv.x - 0.5) * 0.25, uv.y);
				baseR = vec2(0.75 + (uv.x - 0.5) * 0.25, uv.y);
			} else {
				baseL = vec2(uv.x * 0.5, uv.y);
				baseR = vec2(uv.x * 0.5 + 0.5, uv.y);
			}
			float adjustedLeft = clamp(baseL.x + shift, 0.0, 1.0);
			float adjustedRight = clamp(baseR.x - shift, 0.0, 1.0);
			float localLeft = (adjustedLeft - SBS_LEFT_CENTER) * 2.0;
			float localRight = (adjustedRight - SBS_RIGHT_CENTER) * 2.0;
			float depthScaleLeft = mix(1.0 + depthAmount, 1.0 - depthAmount, clamp(abs(localLeft), 0.0, 1.0));
			float depthScaleRight = mix(1.0 - depthAmount, 1.0 + depthAmount, clamp(abs(localRight), 0.0, 1.0));
			localLeft *= depthScaleLeft;
			localRight *= depthScaleRight;
			uvL = vec2(SBS_LEFT_CENTER + localLeft * 0.5, baseL.y);
			uvR = vec2(SBS_RIGHT_CENTER + localRight * 0.5, baseR.y);
		} else { // OU
			if (uHalfRes) {
				baseL = vec2(uv.x, 0.25 + (uv.y - 0.5) * 0.25);
				baseR = vec2(uv.x, 0.75 + (uv.y - 0.5) * 0.25);
			} else {
				baseL = vec2(uv.x, uv.y * 0.5);
				baseR = vec2(uv.x, uv.y * 0.5 + 0.5);
			}
			float adjustedTop = clamp(baseL.y + shift, 0.0, 1.0);
			float adjustedBottom = clamp(baseR.y - shift, 0.0, 1.0);
			float localTop = (adjustedTop - OU_TOP_CENTER) * 2.0;
			float localBottom = (adjustedBottom - OU_BOTTOM_CENTER) * 2.0;
			float depthScaleTop = mix(1.0 + depthAmount, 1.0 - depthAmount, clamp(abs(localTop), 0.0, 1.0));
			float depthScaleBottom = mix(1.0 - depthAmount, 1.0 + depthAmount, clamp(abs(localBottom), 0.0, 1.0));
			localTop *= depthScaleTop;
			localBottom *= depthScaleBottom;
			uvL = vec2(baseL.x, OU_TOP_CENTER + localTop * 0.5);
			uvR = vec2(baseR.x, OU_BOTTOM_CENTER + localBottom * 0.5);
		}
		if (uSwapEyes == 1) { vec2 t = uvL; uvL = uvR; uvR = t; }

		vec3 leftRGB  = texture2D(map, uvL).rgb;
		vec3 rightRGB = texture2D(map, uvR).rgb;

	float antiRed = clamp(uAntiRed, 0.0, 1.0) * 0.5;
	float antiGreen = clamp(uAntiGreen, 0.0, 1.0) * 0.5;
	float antiBlue = clamp(uAntiBlue, 0.0, 1.0) * 0.5;
	float greenBalance = clamp(uGreenBalance, 0.0, 1.0) * 0.5;

		float leftGreenShare = leftRGB.g * greenBalance;
		float rightGreenShare = rightRGB.g * (1.0 - greenBalance);
		float redChannel = clamp(leftRGB.r + leftGreenShare, 0.0, 1.0);

	float preservedRed = 1.0 - antiRed;
	float preservedGreen = 1.0 - antiGreen;
	float preservedBlue = 1.0 - antiBlue;
	float gainRed = 1.0 / max(0.01, 1.0 - antiRed * LUMA_R);
	float gainGreen = 1.0 / max(0.01, 1.0 - antiGreen * LUMA_G);
	float gainBlue = 1.0 / max(0.01, 1.0 - antiBlue * LUMA_B);

	vec3 color = vec3(
		redChannel * preservedRed * gainRed,
		rightGreenShare * preservedGreen * gainGreen,
		rightRGB.b * preservedBlue * gainBlue
	);
		color = clamp(color, 0.0, 1.0);

		gl_FragColor = vec4(color * fade, 1.0);
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

// Fragment shader for flat anaglyph rendering (simple red/cyan)
export const ANAGLYPH_FLAT_FRAGMENT_SHADER = `
	uniform sampler2D map;
	uniform int uLayout; // 0 = SBS, 1 = OU
	uniform int uSwapEyes; // 0 = normal, 1 = swap
	uniform float uAntiRed;
	uniform float uAntiGreen;
	uniform float uAntiBlue;
	uniform float uGreenBalance;
	uniform float uConvergence;
	uniform float uDepth;
	varying vec2 vUv;

	void main() {
		const float MAX_SHIFT = 0.01;
		const float SBS_LEFT_CENTER = 0.25;
		const float SBS_RIGHT_CENTER = 0.75;
		const float OU_TOP_CENTER = 0.25;
		const float OU_BOTTOM_CENTER = 0.75;
		const float LUMA_R = 0.2126;
		const float LUMA_G = 0.7152;
		const float LUMA_B = 0.0722;

		vec2 baseL, baseR;
		vec2 uvL, uvR;
		float convergence = clamp(uConvergence, 0.0, 1.0);
		float depthAmount = clamp(uDepth, 0.0, 1.0) * 0.1;
		float shift = MAX_SHIFT * ((convergence - 0.5) * 2.0);

		float centerLeft = (uLayout == 0) ? SBS_LEFT_CENTER : 0.5;
		float centerRight = (uLayout == 0) ? SBS_RIGHT_CENTER : 0.5;
		float halfSpanLeft = (uLayout == 0) ? 0.25 : 0.5;
		float halfSpanRight = halfSpanLeft;

		if (uLayout == 0) { // SBS
			baseL = vec2(vUv.x * 0.5, vUv.y);
			baseR = vec2(vUv.x * 0.5 + 0.5, vUv.y);
		} else { // OU
			baseL = vec2(vUv.x, vUv.y * 0.5);
			baseR = vec2(vUv.x, vUv.y * 0.5 + 0.5);
		}

		float adjustedLeft = clamp(baseL.x + shift, 0.0, 1.0);
		float adjustedRight = clamp(baseR.x - shift, 0.0, 1.0);
		float localLeft = (adjustedLeft - centerLeft) / halfSpanLeft;
		float localRight = (adjustedRight - centerRight) / halfSpanRight;
		float depthScaleLeft = mix(1.0 + depthAmount, 1.0 - depthAmount, clamp(abs(localLeft), 0.0, 1.0));
		float depthScaleRight = mix(1.0 - depthAmount, 1.0 + depthAmount, clamp(abs(localRight), 0.0, 1.0));
		localLeft *= depthScaleLeft;
		localRight *= depthScaleRight;
		uvL.x = centerLeft + localLeft * halfSpanLeft;
		uvR.x = centerRight + localRight * halfSpanRight;
		uvL.y = baseL.y;
		uvR.y = baseR.y;
		if (uLayout == 1) {
			uvL.y = baseL.y;
			uvR.y = baseR.y;
		}
		if (uSwapEyes == 1) { vec2 t = uvL; uvL = uvR; uvR = t; }

		vec3 leftRGB  = texture2D(map, uvL).rgb;
		vec3 rightRGB = texture2D(map, uvR).rgb;

		float antiRed = clamp(uAntiRed, 0.0, 1.0) * 0.5;
		float antiGreen = clamp(uAntiGreen, 0.0, 1.0) * 0.5;
		float antiBlue = clamp(uAntiBlue, 0.0, 1.0) * 0.5;
	float greenBalance = clamp(uGreenBalance, 0.0, 1.0) * 0.5;

		float leftGreenShare = leftRGB.g * greenBalance;
		float rightGreenShare = rightRGB.g * (1.0 - greenBalance);
		float redChannel = clamp(leftRGB.r + leftGreenShare, 0.0, 1.0);

	float preservedRed = 1.0 - antiRed;
	float preservedGreen = 1.0 - antiGreen;
	float preservedBlue = 1.0 - antiBlue;
	float gainRed = 1.0 / max(0.01, 1.0 - antiRed * LUMA_R);
	float gainGreen = 1.0 / max(0.01, 1.0 - antiGreen * LUMA_G);
	float gainBlue = 1.0 / max(0.01, 1.0 - antiBlue * LUMA_B);

		vec3 color = vec3(
			redChannel * preservedRed * gainRed,
			rightGreenShare * preservedGreen * gainGreen,
			rightRGB.b * preservedBlue * gainBlue
		);
		color = clamp(color, 0.0, 1.0);

		gl_FragColor = vec4(color, 1.0);
	}
`;

// Fragment shader for flat watch view, sampling a single eye
export const WATCH_FLAT_FRAGMENT_SHADER = `
	uniform sampler2D map;
	uniform int uLayout; // 0 = SBS, 1 = OU
	uniform bool uLeftEye;
	varying vec2 vUv;

	void main() {
		vec2 uv = vUv;
		bool leftEye = uLeftEye;
		if (uLayout == 0) {
			uv = vec2(vUv.x * 0.5 + (leftEye ? 0.0 : 0.5), vUv.y);
		} else {
			uv = vec2(vUv.x, vUv.y * 0.5 + (leftEye ? 0.0 : 0.5));
		}
		gl_FragColor = texture2D(map, uv);
	}
`;
