import request from "supertest";
import { createComposedApp } from "../../src/composition";

// NOTE: createComposedApp() is constructed once per test file, so all tests
// in this file share the same in-memory state. That is fine today because
// nothing here asserts on counts; if you add stateful assertions, rebuild
// the app per test (e.g. inside beforeEach) to keep tests independent.
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

/** Valid event payload for reuse across tests. */
function validEventBody() {
  return {
    title: "Study Group",
    description: "Weekly CS326 study session",
    location: "Room 101",
    category: "academic",
    capacity: "30",
    startDate: "2026-06-01T10:00",
    endDate: "2026-06-01T12:00",
  };
}

describe("Event Creation — integration", () => {
  let staffCookie: string;

  beforeAll(async () => {
    staffCookie = await loginAs("staff@app.test", "password123");
  });

  // ── Happy path ──────────────────────────────────────────────────────

  it("creates an event and redirects on valid input", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send(validEventBody());

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/home");
  });

  // ── Auth & role guards ──────────────────────────────────────────────

  it("redirects unauthenticated GET to /login", async () => {
    const res = await request(app).get("/events/create");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("rejects unauthenticated POST with 401", async () => {
    const res = await request(app)
      .post("/events")
      .type("form")
      .send(validEventBody());

    expect(res.status).toBe(401);
  });

  it("rejects a regular user with 403", async () => {
    const userCookie = await loginAs("user@app.test", "password123");

    const res = await request(app)
      .post("/events")
      .set("Cookie", userCookie)
      .type("form")
      .send(validEventBody());

    expect(res.status).toBe(403);
  });

  // ── Title errors ────────────────────────────────────────────────────

  it("returns 400 when title is missing", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), title: "" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Title is required");
  });

  it("returns 400 when title exceeds 100 characters", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), title: "x".repeat(101) });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Title must be 100 characters or fewer");
  });

  // ── Description errors ──────────────────────────────────────────────

  it("returns 400 when description is missing", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), description: "" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Description is required");
  });

  it("returns 400 when description exceeds 2000 characters", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), description: "x".repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Description must be 2000 characters or fewer");
  });

  // ── Location errors ─────────────────────────────────────────────────

  it("returns 400 when location is missing", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), location: "" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Location is required");
  });

  it("returns 400 when location exceeds 200 characters", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), location: "x".repeat(201) });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Location must be 200 characters or fewer");
  });

  // ── Category errors ─────────────────────────────────────────────────

  it("returns 400 when category is missing", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), category: "" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Category is required");
  });

  it("returns 400 when category is invalid", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), category: "cooking" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Category must be one of");
  });

  // ── Capacity errors ─────────────────────────────────────────────────

  it("returns 400 when capacity is missing", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), capacity: "" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Capacity is required");
  });

  it("returns 400 when capacity is zero", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), capacity: "0" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Capacity must be a positive whole number");
  });

  it("returns 400 when capacity is negative", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), capacity: "-5" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Capacity must be a positive whole number");
  });

  it("returns 400 when capacity is not an integer", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), capacity: "2.5" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Capacity must be a positive whole number");
  });

  // ── Start date errors ───────────────────────────────────────────────

  it("returns 400 when start date is missing", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), startDate: "" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Start date is required");
  });

  it("returns 400 when start date is invalid", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), startDate: "not-a-date" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Start date is not a valid date");
  });

  // ── End date errors ─────────────────────────────────────────────────

  it("returns 400 when end date is missing", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), endDate: "" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("End date is required");
  });

  it("returns 400 when end date is invalid", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), endDate: "not-a-date" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("End date is not a valid date");
  });

  it("returns 400 when end date is before start date", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({
        ...validEventBody(),
        startDate: "2026-06-01T14:00",
        endDate: "2026-06-01T10:00",
      });

    expect(res.status).toBe(400);
    expect(res.text).toContain("End date must be after the start date");
  });

  it("returns 400 when end date equals start date", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({
        ...validEventBody(),
        startDate: "2026-06-01T10:00",
        endDate: "2026-06-01T10:00",
      });

    expect(res.status).toBe(400);
    expect(res.text).toContain("End date must be after the start date");
  });

  // ── HTMX behaviour ─────────────────────────────────────────────────

  it("returns HX-Redirect header on successful HTMX submission", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .set("HX-Request", "true")
      .type("form")
      .send(validEventBody());

    expect(res.status).toBe(204);
    expect(res.headers["hx-redirect"]).toBe("/home");
  });

  it("returns form partial without layout on HTMX validation error", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .set("HX-Request", "true")
      .type("form")
      .send({ ...validEventBody(), title: "" });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Title is required");
    // Should be the partial only — no full page layout (no <html> tag)
    expect(res.text).not.toContain("<html");
  });

  // ── Whitespace handling ────────────────────────────────────────────

  it("returns 400 when title is only whitespace", async () => {
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), title: "   " });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Title is required");
  });

  // ── Admin role allowlist ───────────────────────────────────────────

  it("allows admin users to create events", async () => {
    const adminCookie = await loginAs("admin@app.test", "password123");

    const res = await request(app)
      .post("/events")
      .set("Cookie", adminCookie)
      .type("form")
      .send(validEventBody());

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/home");
  });

  // ── Persistence & status invariants ────────────────────────────────

  it("creates the event in draft status and makes it retrievable", async () => {
    const uniqueTitle = `Draft-Status-Check-${Date.now()}`;
    await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEventBody(), title: uniqueTitle });

    const home = await request(app).get("/home").set("Cookie", staffCookie);
    const match = home.text.match(
      new RegExp(`${uniqueTitle}[\\s\\S]*?/events/([0-9a-f-]{36})`),
    );
    expect(match).not.toBeNull();
    const eventId = (match as RegExpMatchArray)[1];

    const detail = await request(app)
      .get(`/events/${eventId}`)
      .set("Cookie", staffCookie);

    expect(detail.status).toBe(200);
    expect(detail.text).toContain(uniqueTitle);
    // Status field on the detail page renders the literal status string
    expect(detail.text).toContain("draft");
  });

  // ── Organizer identity comes from session, not from the form ───────

  it("ignores organizerId in the body and uses the session user", async () => {
    const uniqueTitle = `Organizer-Spoof-Test-${Date.now()}`;
    const res = await request(app)
      .post("/events")
      .set("Cookie", staffCookie)
      .type("form")
      .send({
        ...validEventBody(),
        title: uniqueTitle,
        organizerId: "hostile-spoofed-id",
      });

    expect(res.status).toBe(302);

    const home = await request(app).get("/home").set("Cookie", staffCookie);
    const match = home.text.match(
      new RegExp(`${uniqueTitle}[\\s\\S]*?/events/([0-9a-f-]{36})`),
    );
    expect(match).not.toBeNull();
    const eventId = (match as RegExpMatchArray)[1];

    const detail = await request(app)
      .get(`/events/${eventId}`)
      .set("Cookie", staffCookie);

    expect(detail.status).toBe(200);
    // staff demo user id is "user-staff" per InMemoryUserRepository
    expect(detail.text).toContain("user-staff");
    expect(detail.text).not.toContain("hostile-spoofed-id");
  });
});

