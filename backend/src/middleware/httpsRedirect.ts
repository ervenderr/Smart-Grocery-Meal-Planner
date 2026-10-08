/**
 * HTTPS enforcement (production).
 *
 * The redirect target is built from a configured canonical host, never from
 * the request's Host header, so a spoofed Host cannot cause an open redirect.
 * 308 keeps the method and body of non-GET requests intact.
 */

import type { RequestHandler } from "express";

export function httpsRedirect(canonicalHost: string | undefined): RequestHandler {
  return (req, res, next) => {
    if (req.secure) {
      next();
      return;
    }
    if (canonicalHost === undefined) {
      res.status(400).json({
        status: "error",
        statusCode: 400,
        message: "HTTPS required",
      });
      return;
    }
    res.redirect(308, `https://${canonicalHost}${req.originalUrl}`);
  };
}
