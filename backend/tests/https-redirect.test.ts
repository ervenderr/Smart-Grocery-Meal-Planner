import express from "express";
import request from "supertest";
import { httpsRedirect } from "../src/middleware/httpsRedirect";

const build = (host: string | undefined) => {
  const app = express();
  app.set("trust proxy", 2);
  app.use(httpsRedirect(host));
  app.all("/x", (_req, res) => res.json({ ok: true }));
  return app;
};

describe("httpsRedirect", () => {
  it("redirects with 308 to the configured host, ignoring the Host header", async () => {
    const res = await request(build("api.example.com"))
      .post("/x?a=1")
      .set("Host", "evil.example");
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe("https://api.example.com/x?a=1");
  });

  it("passes secure requests through", async () => {
    const res = await request(build("api.example.com"))
      .get("/x")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-For", "198.51.100.1, 203.0.113.7");
    expect(res.status).toBe(200);
  });

  it("refuses (400) instead of redirecting when no host is configured", async () => {
    const res = await request(build(undefined)).get("/x");
    expect(res.status).toBe(400);
    expect(res.headers.location).toBeUndefined();
  });
});
