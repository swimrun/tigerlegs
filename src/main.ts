import { startServer } from "./server/server.ts";
import { BACKEND_PORT, FRONTEND_ORIGIN } from "./server/config.ts";

startServer({
  port: BACKEND_PORT,
  allowedOrigins: [FRONTEND_ORIGIN],
  staticDir: "public",
  cacheDir: ".cache",
});
