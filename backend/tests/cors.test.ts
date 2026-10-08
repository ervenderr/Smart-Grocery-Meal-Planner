import express from "express";
import cors from "cors";
import request from "supertest";
import {
  buildCorsOptions,
  buildOriginPredicate,
  normalizeOrigin,
  originGuard,
} from "../src/config/cors.config";

const opts = {
  origins: ["https://kitcha-ai.vercel.app"],
  previewProject: "kitcha",
  previewScope: "ervenderrs-projects",
};

describe("buildOriginPredicate", () => {
  const isAllowed = buildOriginPredicate(opts);

  it.each([
    "https://kitcha-ai.vercel.app",
    "https://kitcha-94293z3ib-ervenderrs-projects.vercel.app",
    "https://kitcha-git-feature-ervenderrs-projects.vercel.app",
    "https://kitcha-ervenderrs-projects.vercel.app",
  ])("allows %s", (origin) => {
    expect(isAllowed(origin)).toBe(true);
  });

  it.each([
    "https://kitcha-evil.vercel.app",
    "https://kitcha-94293z3ib-otherscope.vercel.app",
    "http://kitcha-ai.vercel.app",
    "https://kitcha-ai.vercel.app.evil.com",
    "https://evil-kitcha-94293z3ib-ervenderrs-projects.vercel.app",
    "https://kitcha-git-x-evil-ervenderrs-projects.vercel.app",
    "https://kitcha-git-feature-x-ervenderrs-projects.vercel.app",
    "https://kitcha-git-x-ervenderrs-projects-evil.vercel.app",
  ])("rejects %s", (origin) => {
    expect(isAllowed(origin)).toBe(false);
  });

  it("allows only exact origins without previewScope", () => {
    const exactOnly = buildOriginPredicate({ ...opts, previewScope: undefined });
    expect(exactOnly("https://kitcha-ai.vercel.app")).toBe(true);
    expect(
      exactOnly("https://kitcha-94293z3ib-ervenderrs-projects.vercel.app")
    ).toBe(false);
  });
});

describe("normalizeOrigin", () => {
  it("strips trailing slashes and whitespace", () => {
    expect(normalizeOrigin("https://a.example/")).toBe("https://a.example");
    expect(normalizeOrigin(" https://a.example// ")).toBe("https://a.example");
  });
});

describe("originGuard + cors integration", () => {
  const isAllowed = buildOriginPredicate(opts);
  let postCalls = 0;
  const app = express();
  app.use(originGuard(isAllowed));
  app.use(cors(buildCorsOptions(isAllowed)));
  app.get("/ping", (_req, res) => {
    res.json({ ok: true });
  });
  app.post("/act", (_req, res) => {
    postCalls += 1;
    res.json({ ok: true });
  });

  beforeEach(() => {
    postCalls = 0;
  });

  it("returns 403 JSON for a disallowed origin and skips handlers", async () => {
    const getRes = await request(app).get("/ping").set("Origin", "https://evil.example");
    expect(getRes.status).toBe(403);
    expect(getRes.body).toEqual({
      status: "error",
      statusCode: 403,
      message: "Origin not allowed",
    });

    const postRes = await request(app).post("/act").set("Origin", "https://evil.example");
    expect(postRes.status).toBe(403);
    expect(postCalls).toBe(0);
  });

  it("allows an allowed origin and echoes it", async () => {
    const res = await request(app)
      .get("/ping")
      .set("Origin", "https://kitcha-ai.vercel.app");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "https://kitcha-ai.vercel.app"
    );
  });

  it("answers preflight for an allowed origin", async () => {
    const res = await request(app)
      .options("/act")
      .set("Origin", "https://kitcha-ai.vercel.app")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-headers"].toLowerCase()).toContain(
      "authorization"
    );
  });

  it("passes requests without an Origin header", async () => {
    const res = await request(app).get("/ping");
    expect(res.status).toBe(200);
  });
});
