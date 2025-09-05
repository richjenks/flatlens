import { defineConfig } from "vite";
import { createRequire } from "node:module";

// Use createRequire to load JSON in ESM without assertions
const require = createRequire(import.meta.url);
const pkg = require("./package.json");

export default defineConfig({
	base: "./",
	build: {
		outDir: "dist",
		assetsDir: "assets",
		rollupOptions: {
			input: {
				main: "index.html",
			},
		},
	},
	server: {
		port: 5173,
	},
	define: {
		__APP_NAME__: JSON.stringify(pkg.name),
		__APP_DESCRIPTION__: JSON.stringify(pkg.description),
	},
});
