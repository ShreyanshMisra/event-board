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

const UUID_RE =
  /\/events\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;

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

  const homeRes = await request(app)
    .get("/home")
    .set("Cookie", cookie);

  const ids = extractEventIds(homeRes.text);
  return ids[ids.length - 1] ?? "";
}

/** Publish an event by id. */
async function publishEvent(cookie: string, eventId: string): Promise<void> {
  await request(app)
    .post(`/events/${eventId}/publish`)
    .set("Cookie", cookie)
    .set("HX-Request", "true")
    .type("form")
    .send({});
}

describe("Event Detail Page — integration", () => {
  let staffCookie: string;
  let adminCookie: string;
  let userCookie: string;

  beforeAll(async () => {
    staffCookie = await loginAs("staff@app.test", "password123");
    adminCookie = await loginAs("admin@app.test", "password123");
    userCookie = await loginAs("user@app.test", "password123");
  });

  it("returns 200 for a published event", async () => {
    const eventId = await createEvent(staffCookie, {
      title: "Published Detail Event",
      description: "Visible to authenticated users after publish",
    });

    await publishEvent(staffCookie, eventId);

    const res = await request(app)
      .get(`/events/${eventId}`)
      .set("Cookie", userCookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Published Detail Event");
  });

  it("returns 404 for a missing event", async () => {
    const res = await request(app)
      .get("/events/00000000-0000-0000-0000-000000000000")
      .set("Cookie", userCookie);

    expect(res.status).toBe(404);
    expect(res.text).toContain("Event not found");
  });

  it("returns 200 when organizer views own draft", async () => {
    const eventId = await createEvent(staffCookie, {
      title: "Organizer Draft Event",
    });

    const res = await request(app)
      .get(`/events/${eventId}`)
      .set("Cookie", staffCookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Organizer Draft Event");
  });

  it("returns 200 when admin views a staff draft", async () => {
    const eventId = await createEvent(staffCookie, {
      title: "Admin Can View Draft",
    });

    const res = await request(app)
      .get(`/events/${eventId}`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Admin Can View Draft");
  });

  it("returns 404 when a normal user tries to view someone else's draft", async () => {
    const eventId = await createEvent(staffCookie, {
      title: "Hidden Draft",
    });

    const res = await request(app)
      .get(`/events/${eventId}`)
      .set("Cookie", userCookie);

    expect(res.status).toBe(404);
    expect(res.text).toContain("Event not found");
  });

  it("returns 401 error fragment for HTMX detail request when not authenticated", async () => {
    const res = await request(app)
      .get("/events/00000000-0000-0000-0000-000000000000")
      .set("HX-Request", "true");

    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue");
  });
});