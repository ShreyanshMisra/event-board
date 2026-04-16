import request from "supertest";
import { createComposedApp } from "../../src/composition";

const app = createComposedApp().getExpressApp();

/**
 * Helper: log in as a demo user and return the session cookie.
 */
async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post("/login")
    .type("form")
    .send({ email, password });

  const cookies = res.headers["set-cookie"];
  const cookieHeader = Array.isArray(cookies) ? cookies[0] : cookies;
  return cookieHeader ?? "";
}

describe("My RSVPs Dashboard — integration", () => {
  let userCookie: string;

  beforeAll(async () => {
    userCookie = await loginAs("user@app.test", "password123");
  });

  // ── Auth guards ────────────────────────────────────────────────────

  it("redirects unauthenticated GET /my-rsvps to /login", async () => {
    const res = await request(app).get("/my-rsvps");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("returns 401 for unauthenticated HTMX request to /my-rsvps", async () => {
    const res = await request(app)
      .get("/my-rsvps")
      .set("HX-Request", "true");
    expect(res.status).toBe(401);
  });

  // ── Dashboard rendering ────────────────────────────────────────────

  it("renders dashboard for authenticated user", async () => {
    const res = await request(app)
      .get("/my-rsvps")
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("My RSVPs");
  });

  it("shows empty state when user has no RSVPs", async () => {
    const res = await request(app)
      .get("/my-rsvps")
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("haven't RSVP'd");
  });

  // ── Toggle stub ────────────────────────────────────────────────────

  it("returns placeholder for POST /events/:id/rsvp when authenticated", async () => {
    const res = await request(app)
      .post("/events/some-event-id/rsvp")
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("under construction");
  });

  it("rejects unauthenticated POST /events/:id/rsvp", async () => {
    const res = await request(app)
      .post("/events/some-event-id/rsvp");
    expect(res.status).toBe(401);
  });
});
