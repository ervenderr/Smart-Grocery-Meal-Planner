import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

const remaining = async (xff: string): Promise<number> => {
  const res = await request(app).get("/api/v1").set("X-Forwarded-For", xff);
  expect(res.status).toBe(200);
  return Number(res.headers["ratelimit-remaining"]);
};

describe("trust proxy and rate-limit keying", () => {
  it("sets trust proxy to 1", () => {
    expect(app.get("trust proxy")).toBe(1);
  });

  it("keys buckets on the rightmost X-Forwarded-For entry", async () => {
    const first = await remaining("1.1.1.1, 203.0.113.7");
    const second = await remaining("2.2.2.2, 203.0.113.7");
    expect(second).toBe(first - 1);

    const other = await remaining("1.1.1.1, 203.0.113.8");
    expect(other).toBeGreaterThan(second);
  });
});
