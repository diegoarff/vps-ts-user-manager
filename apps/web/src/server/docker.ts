import http from "node:http";

import { env } from "@vps-ts-user-manager/env/server";

import type { ServiceEntry, ServiceVisibility } from "../lib/types";

interface ContainerSummary {
  Names?: string[];
  Labels?: Record<string, string>;
}

/**
 * Classify domains the app can't infer from the Docker socket alone.
 * The Traefik file-provider middlewares and Cloudflare DNS records are not
 * visible through Docker labels, so tailnet-only and Authelia-protected
 * domains are declared explicitly via env (comma-separated). Anything not
 * listed defaults to "public".
 */
export async function listProtectedServices(): Promise<ServiceEntry[]> {
  const containers = await dockerRequest<ContainerSummary[]>("/containers/json");
  const byDomain = new Map<string, { containers: Set<string>; autheliaProtected: boolean }>();

  for (const c of containers) {
    const name = (c.Names?.[0] ?? "").replace(/^\//, "");
    const labels = c.Labels ?? {};
    for (const [key, value] of Object.entries(labels)) {
      const ruleMatch = key.match(/^traefik\.http\.routers\.([^.@]+)(?:@[^.]*)?\.rule$/);
      if (!ruleMatch) continue;
      const domain = extractHost(value);
      if (!domain) continue;
      const entry = byDomain.get(domain) ?? { containers: new Set(), autheliaProtected: false };
      entry.containers.add(name);
      const mwKey = `traefik.http.routers.${ruleMatch[1]}.middlewares`;
      if (
        (labels[mwKey] ?? "")
          .split(",")
          .map((m) => m.trim())
          .includes("authelia@file")
      ) {
        entry.autheliaProtected = true;
      }
      byDomain.set(domain, entry);
    }
  }

  const tailnetDomains = parseDomains(env.SERVICES_TAILNET_DOMAINS);
  const autheliaDomains = parseDomains(env.SERVICES_AUTHELIA_DOMAINS);

  return [...byDomain.entries()]
    .map(([domain, e]) => ({
      domain,
      containers: [...e.containers].toSorted(),
      autheliaProtected: e.autheliaProtected,
      visibility: classify(e.autheliaProtected, tailnetDomains, autheliaDomains, domain),
    }))
    .toSorted((a, b) => a.domain.localeCompare(b.domain));
}

function classify(
  autheliaProtected: boolean,
  tailnetDomains: Set<string>,
  autheliaDomains: Set<string>,
  domain: string,
): ServiceVisibility {
  if (autheliaProtected || autheliaDomains.has(domain)) return "authelia";
  if (tailnetDomains.has(domain)) return "tailnet";
  return "public";
}

function parseDomains(list: string): Set<string> {
  return new Set(
    list
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean),
  );
}

function extractHost(rule: string): string | null {
  const match = rule.match(/Host\(`([^`]+)`\)/);
  return match ? match[1] : null;
}

function dockerRequest<T>(pathName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: env.DOCKER_SOCKET, path: pathName, method: "GET" },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            // SAFETY: GET /containers/json is documented to return an array of
            // container summaries; consumers only read Names and Labels, both optional.
            resolve(JSON.parse(body) as T);
          } catch {
            reject(new Error(`Docker API returned invalid JSON for ${pathName}`));
          }
        });
      },
    );
    req.on("error", (err) => {
      reject(new Error(`Docker socket unavailable at ${env.DOCKER_SOCKET}: ${err.message}`));
    });
    req.end();
  });
}
