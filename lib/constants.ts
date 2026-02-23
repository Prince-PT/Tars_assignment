/* ────────────────────────────────────────────────────
 *  App-wide layout / UI constants.
 *  Keep magic numbers here so every file can reference
 *  the same value and a change propagates automatically.
 * ──────────────────────────────────────────────────── */

/** Height of the fixed header bar */
export const HEADER_HEIGHT = "4rem";

/** Height available for the main chat content below the header */
export const MAIN_HEIGHT = `calc(100vh - ${HEADER_HEIGHT})`;

/** Sidebar width (desktop) */
export const SIDEBAR_WIDTH_CLASS = "w-80"; // 320 px

/** Max image upload size in bytes (5 MB) */
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

/** Max group members enforced on the client side (matches server) */
export const MAX_GROUP_MEMBERS = 50;
