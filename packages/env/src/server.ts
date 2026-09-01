import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    USERS_DB_PATH: z.string().default("/config/users_database.yml"),
    BACKUPS_DIR: z.string().default("/config/backups"),
    AUTHELIA_URL: z.string().default("http://authelia:9091"),
    DOCKER_SOCKET: z.string().default("/var/run/docker.sock"),
    SERVICES_TAILNET_DOMAINS: z
      .string()
      .default("coolify.diegorincon.dev,byparr.diegorincon.dev,flaresolverr.diegorincon.dev"),
    SERVICES_AUTHELIA_DOMAINS: z.string().default("home.diegorincon.dev,transmute.diegorincon.dev"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
