import request from "supertest";
import app from "../server.js";
import {jest, beforeEach, test, expect, describe} from "@jest/globals";

describe("GET /api/wind", () => {

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("returns wind details", async () => {

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        wind: {
          direction: {
            degrees: 270
          },
          speed: {
            value: 36
          }
        }
      })
    });

    const response = await request(app)
      .get("/api/wind");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      direction: 270,
      speed: 10
    });
  });

});
