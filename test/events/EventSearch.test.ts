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

const UUID_RE = /\/events\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;

/** Extract all event UUIDs from an HTML page. */
function extractEventIds(html: string): string[] {
  return [...html.matchAll(UUID_RE)].map((m) => m[1]);
}

/** Create an event and return its id. */
async function createEvent(
  cookie: string,
  overrides: Record<string, string> = {},
): Promise<string> {
  const body = {
    title: "Default Title",
    description: "Default description text",
    location: "Room 101",
    category: "academic",
    capacity: "30",
    startDate: "2027-06-01T10:00",
    endDate: "2027-06-01T12:00",
    ...overrides,
  };

  await request(app)
    .post("/events")
    .set("Cookie", cookie)
    .type("form")
    .send(body);

  // Get home page and find the most recently added event ID
  const homeRes = await request(app)
    .get("/home")
    .set("Cookie", cookie);

  const ids = extractEventIds(homeRes.text);
  // Return the last unique ID (most recently created event appears last)
  return ids[ids.length - 1] ?? "";
}

/** Publish an event by id. */
async function publishEvent(cookie: string, eventId: string): Promise<void> {
  await request(app)
    .post(`/events/${eventId}/publish`)
    .set("Cookie", cookie)
    .type("form")
    .send({});
}

describe("Event Search — integration", () => {
  let staffCookie: string;

  beforeAll(async () => {
    staffCookie = await loginAs("staff@app.test", "password123");

    // Create events with distinct fields
    const id1 = await createEvent(staffCookie, {
      title: "React Workshop",
      description: "Learn React fundamentals",
      location: "Engineering Lab",
    });
    const id2 = await createEvent(staffCookie, {
      title: "Career Fair",
      description: "Meet top employers",
      location: "Student Union",
    });
    const id3 = await createEvent(staffCookie, {
      title: "Chess Club Meeting",
      description: "Weekly practice at the Engineering building",
      location: "Room 202",
    });

    // Publish all events
    await publishEvent(staffCookie, id1);
    await publishEvent(staffCookie, id2);
    await publishEvent(staffCookie, id3);
  });

  // ── Matching results ────────────────────────────────────────────────

  it("returns events matching by title", async () => {
    const res = await request(app)
      .get("/events/search?q=React");

    expect(res.status).toBe(200);
    expect(res.text).toContain("React Workshop");
    expect(res.text).not.toContain("Career Fair");
  });

  it("returns events matching by description", async () => {
    const res = await request(app)
      .get("/events/search?q=employers");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Career Fair");
    expect(res.text).not.toContain("React Workshop");
  });

  it("returns events matching by location", async () => {
    const res = await request(app)
      .get("/events/search?q=Student+Union");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Career Fair");
    expect(res.text).not.toContain("Chess Club");
  });

  it("search is case-insensitive", async () => {
    const res = await request(app)
      .get("/events/search?q=react");

    expect(res.status).toBe(200);
    expect(res.text).toContain("React Workshop");
  });

  it("matches across multiple fields (description contains 'Engineering')", async () => {
    const res = await request(app)
      .get("/events/search?q=Engineering");

    expect(res.status).toBe(200);
    // "React Workshop" is at Engineering Lab, "Chess Club" description mentions Engineering building
    expect(res.text).toContain("React Workshop");
    expect(res.text).toContain("Chess Club");
  });

  // ── No results ──────────────────────────────────────────────────────

  it("returns no-results message when nothing matches", async () => {
    const res = await request(app)
      .get("/events/search?q=zzzznotfound");

    expect(res.status).toBe(200);
    expect(res.text).toContain("No matching events found");
  });

  // ── Empty query ─────────────────────────────────────────────────────

  it("returns all published upcoming events for an empty query", async () => {
    const res = await request(app)
      .get("/events/search?q=");

    expect(res.status).toBe(200);
    expect(res.text).toContain("React Workshop");
    expect(res.text).toContain("Career Fair");
    expect(res.text).toContain("Chess Club");
  });

  it("returns all published upcoming events when q param is missing", async () => {
    const res = await request(app)
      .get("/events/search");

    expect(res.status).toBe(200);
    expect(res.text).toContain("React Workshop");
    expect(res.text).toContain("Career Fair");
  });

  // ── Invalid input ───────────────────────────────────────────────────

  it("returns 400 when query exceeds 200 characters", async () => {
    const longQuery = "x".repeat(201);
    const res = await request(app)
      .get(`/events/search?q=${longQuery}`);

    expect(res.status).toBe(400);
    expect(res.text).toContain("Search query must be 200 characters or fewer");
  });

  // ── HTMX partial response ──────────────────────────────────────────

  it("returns HTML partial without full page layout", async () => {
    const res = await request(app)
      .get("/events/search?q=React");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("<html");
    expect(res.text).not.toContain("<!doctype");
  });
});
