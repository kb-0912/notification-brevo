// ─── Node.js Polyfill for @getbrevo/brevo ───────────────────────────────────
// This file MUST have zero imports so that when required, its code runs
// synchronously before any other module is loaded.
//
// Root cause: @getbrevo/brevo's Fern-generated runtime.js calls evaluateRuntime()
// at module load time. If `window` is defined (e.g. by another dependency) but
// `window.navigator` is missing, it crashes:
//   TypeError: Cannot read properties of undefined (reading 'userAgent')
//
// Fix: ensure navigator (with userAgent) exists on both globalThis and window
// before the SDK is required.

if (typeof (globalThis as any).navigator === "undefined") {
	;(globalThis as any).navigator = { userAgent: "node", product: "node" }
}

if (typeof (globalThis as any).window === "undefined") {
	;(globalThis as any).window = { navigator: (globalThis as any).navigator }
} else if (typeof (globalThis as any).window.navigator === "undefined") {
	// window exists (from some other polyfill/lib) but navigator is missing
	;(globalThis as any).window.navigator = (globalThis as any).navigator
}
