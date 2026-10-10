import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";
import { logReleaseWarnings } from "./lib/legal/release-checks";

const config = (phase: string): NextConfig => {
  if (phase === PHASE_PRODUCTION_BUILD && !process.env.NEXT_PUBLIC_API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL must be set for production builds (e.g. https://<service>.up.railway.app)"
    );
  }
  // Non-fatal: surface store-submission blockers without failing the build.
  if (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) {
    logReleaseWarnings(process.env);
  }
  return {};
};

export default config;
