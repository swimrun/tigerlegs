/**
 * Single source of truth for local development ports and origins.
 * The server currently serves both the static frontend and the API,
 * so both ports are equal; change either one here to split them.
 */
export const FRONTEND_PORT = 8123;
export const BACKEND_PORT = 8123;

export const FRONTEND_ORIGIN = `http://localhost:${FRONTEND_PORT}`;
export const BACKEND_ORIGIN = `http://localhost:${BACKEND_PORT}`;
export const PRODUCTION_ORIGIN = "https://swimrun.group";
