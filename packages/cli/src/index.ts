/**
 * @openstrux/cli — public API.
 *
 * Exposes the three command runners so they can be used programmatically
 * (e.g. in integration tests or custom build scripts).
 */

export { runBuild } from "./commands/build.js";
export { runInit } from "./commands/init.js";
export { runDoctor } from "./commands/doctor.js";
