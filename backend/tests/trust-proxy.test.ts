import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

const remaining = async (xff: string): Promise<number> => {
  const res = await request(app).get("/api/v1").set("X-Forwarded-For", xff);
  expect(res.status).toBe(200);
  return Number(res.headers["ratelimit-remaining"]);
};

describe("trust proxy and rate-limit keying", () => {
  it("sets trust proxy to 2", () => {
    expect(app.get("trust proxy")).toBe(2);
  });

  it("keys buckets on the client entry (second from right) of X-Forwarded-For", async () => {
    // Railway format: "<real client>, <edge ip>"; the edge ip varies per request
    const first = await remaining("198.51.100.1, 203.0.113.7");
    const second = await remaining("198.51.100.1, 203.0.113.8");
    expect(second).toBe(first - 1);

    const other = await remaining("198.51.100.2, 203.0.113.7");
    expect(other).toBeGreaterThan(second);
  });
});
