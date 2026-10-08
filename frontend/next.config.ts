import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const config = (phase: string): NextConfig => {
  if (phase === PHASE_PRODUCTION_BUILD && !process.env.NEXT_PUBLIC_API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL must be set for production builds (e.g. https://<service>.up.railway.app)"
    );
  }
  return {};
};

export default config;
