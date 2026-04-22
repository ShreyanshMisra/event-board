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

/** Cancel an event by id. */
async function cancelEvent(cookie: string, eventId: string): Promise<void> {
  await request(app)
    .post(`/events/${eventId}/cancel`)
    .set("Cookie", cookie)
    .set("HX-Request", "true")
    .type("form")
    .send({});
}

describe("Event Publish and Cancel — integration", () => {
  let staffCookie: string;
  let userCookie: string;

  beforeAll(async () => {
    staffCookie = await loginAs("staff@app.test", "password123");
    userCookie = await loginAs("user@app.test", "password123");
  });

  it("publishes a draft event", async () => {
    const eventId = await createEvent(staffCookie, {
      title: "Draft To Publish",
    });

    const res = await request(app)
      .post(`/events/${eventId}/publish`)
      .set("Cookie", staffCookie)
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(res.status).toBe(200);
    expect(res.text.toLowerCase()).toContain("published");
  });

  it("returns 403 when unauthorized user tries to publish", async () => {
    const eventId = await createEvent(staffCookie, {
      title: "Only Organizer Can Publish",
    });

    const res = await request(app)
      .post(`/events/${eventId}/publish`)
      .set("Cookie", userCookie)
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(res.status).toBe(403);
    expect(res.text).toContain("not allowed");
  });

  it("returns 404 when trying to publish a missing event", async () => {
    const res = await request(app)
      .post("/events/00000000-0000-0000-0000-000000000000/publish")
      .set("Cookie", staffCookie)
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(res.status).toBe(404);
    expect(res.text).toContain("Event not found");
  });

  it("returns 400 when trying to publish an already published event", async () => {
    const eventId = await createEvent(staffCookie, {
      title: "Already Published",
    });

    await publishEvent(staffCookie, eventId);

    const res = await request(app)
      .post(`/events/${eventId}/publish`)
      .set("Cookie", staffCookie)
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(res.status).toBe(400);
    expect(res.text).toContain("Only draft events can be published");
  });

  it("cancels a published event", async () => {
    const eventId = await createEvent(staffCookie, {
      title: "Published Then Cancelled",
    });

    await publishEvent(staffCookie, eventId);

    const res = await request(app)
      .post(`/events/${eventId}/cancel`)
      .set("Cookie", staffCookie)
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(res.status).toBe(200);
    expect(res.text.toLowerCase()).toContain("cancel");
  });

  it("returns 403 when unauthorized user tries to cancel", async () => {
    const eventId = await createEvent(staffCookie, {
      title: "Someone Else's Published Event",
    });

    await publishEvent(staffCookie, eventId);

    const res = await request(app)
      .post(`/events/${eventId}/cancel`)
      .set("Cookie", userCookie)
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(res.status).toBe(403);
    expect(res.text).toContain("not allowed");
  });

  it("returns 404 when trying to cancel a missing event", async () => {
    const res = await request(app)
      .post("/events/00000000-0000-0000-0000-000000000000/cancel")
      .set("Cookie", staffCookie)
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(res.status).toBe(404);
    expect(res.text).toContain("Event not found");
  });

  it("returns 400 when trying to cancel an already cancelled event", async () => {
    const eventId = await createEvent(staffCookie, {
      title: "Already Cancelled",
    });

    await publishEvent(staffCookie, eventId);
    await cancelEvent(staffCookie, eventId);

    const res = await request(app)
      .post(`/events/${eventId}/cancel`)
      .set("Cookie", staffCookie)
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(res.status).toBe(400);
    expect(res.text).toContain("Only published events can be cancelled");
  });

  it("returns HTML partial without full page layout for publish HTMX request", async () => {
    const eventId = await createEvent(staffCookie, {
      title: "HTMX Publish Fragment",
    });

    const res = await request(app)
      .post(`/events/${eventId}/publish`)
      .set("Cookie", staffCookie)
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("<html");
    expect(res.text).not.toContain("<!doctype");
  });

  it("returns 401 error fragment for HTMX publish request when not authenticated", async () => {
    const res = await request(app)
      .post("/events/00000000-0000-0000-0000-000000000000/publish")
      .set("HX-Request", "true")
      .type("form")
      .send({});

    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue");
  });
});