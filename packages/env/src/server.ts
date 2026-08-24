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
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
