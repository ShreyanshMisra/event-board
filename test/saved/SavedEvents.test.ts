import http from "http";
import request from "supertest";
import { createComposedApp } from "../../src/composition";

const app = createComposedApp().getExpressApp();
let server: http.Server;

beforeAll((done) => {
  server = app.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(server)
    .post("/login")
    .type("form")
    .send({ email, password });
  const cookies = res.headers["set-cookie"];
  const cookieHeader = Array.isArray(cookies) ? cookies[0] : cookies;
  return cookieHeader ?? "";
}

async function createEventAndGetId(cookie: string): Promise<string> {
  await request(server)
    .post("/events")
    .set("Cookie", cookie)
    .type("form")
    .send({
      title: "Test Event",
      description: "Test description",
      location: "Room 101",
      category: "academic",
      capacity: "30",
      startDate: "2026-06-01T10:00",
      endDate: "2026-06-01T12:00",
    });

  const homeRes = await request(server).get("/home").set("Cookie", cookie);
  const matches = [...homeRes.text.matchAll(/href="\/events\/([a-f0-9-]+)"/g)];
  const lastMatch = matches[matches.length - 1];
  if (!lastMatch?.[1]) throw new Error("Event ID not found after creation");
  return lastMatch[1];
}

describe("Save for Later — integration", () => {
  let staffCookie: string;
  let adminCookie: string;
  let userCookie: string;
  let publishedEventId: string;
  let cancelledEventId: string;

  beforeAll(async () => {
    staffCookie = await loginAs("staff@app.test", "password123");
    adminCookie = await loginAs("admin@app.test", "password123");
    userCookie = await loginAs("user@app.test", "password123");

    publishedEventId = await createEventAndGetId(staffCookie);
    await request(server).post(`/events/${publishedEventId}/publish`).set("Cookie", staffCookie);

    cancelledEventId = await createEventAndGetId(staffCookie);
    await request(server).post(`/events/${cancelledEventId}/publish`).set("Cookie", staffCookie);
    await request(server).post(`/events/${cancelledEventId}/cancel`).set("Cookie", staffCookie);
  });

  // ── Role restrictions — toggle ──────────────────────────────────────

  it("rejects unauthenticated POST /events/:id/save with 401", async () => {
    const res = await request(server).post(`/events/${publishedEventId}/save`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when staff tries to save an event", async () => {
    const res = await request(server)
      .post(`/events/${publishedEventId}/save`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(403);
  });

  it("returns 403 when admin tries to save an event", async () => {
    const res = await request(server)
      .post(`/events/${publishedEventId}/save`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(403);
  });

  // ── Role restrictions — saved list ─────────────────────────────────

  it("redirects unauthenticated GET /saved-events to /login", async () => {
    const res = await request(server).get("/saved-events");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("returns 403 when staff visits /saved-events", async () => {
    const res = await request(server)
      .get("/saved-events")
      .set("Cookie", staffCookie);
    expect(res.status).toBe(403);
  });

  it("returns 403 when admin visits /saved-events", async () => {
    const res = await request(server)
      .get("/saved-events")
      .set("Cookie", adminCookie);
    expect(res.status).toBe(403);
  });

  // ── Invalid save attempts ───────────────────────────────────────────

  it("returns 400 when member tries to save a cancelled event", async () => {
    const res = await request(server)
      .post(`/events/${cancelledEventId}/save`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(400);
    expect(res.text).toContain("Only published events can be saved");
  });

  it("returns 404 when member tries to save a non-existent event", async () => {
    const res = await request(server)
      .post("/events/does-not-exist/save")
      .set("Cookie", userCookie);
    expect(res.status).toBe(404);
  });

  // ── Toggle behaviour ────────────────────────────────────────────────

  it("returns 302 when member saves a published event", async () => {
    const res = await request(server)
      .post(`/events/${publishedEventId}/save`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/events/${publishedEventId}`);
  });

  it("event appears in saved list after saving", async () => {
    const res = await request(server)
      .get("/saved-events")
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Test Event");
  });

  it("saving the same event again unsaves it", async () => {
    await request(server)
      .post(`/events/${publishedEventId}/save`)
      .set("Cookie", userCookie);

    const res = await request(server)
      .get("/saved-events")
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.text).not.toContain("Test Event");
  });

  it("saved list shows empty message when nothing is saved", async () => {
    const res = await request(server)
      .get("/saved-events")
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("You haven't saved any events yet");
  });

  it("re-saving an event after unsaving adds it back to the list", async () => {
    await request(server)
      .post(`/events/${publishedEventId}/save`)
      .set("Cookie", userCookie);

    const res = await request(server)
      .get("/saved-events")
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Test Event");
  });

  // ── HTMX behaviour ──────────────────────────────────────────────────

  it("returns save button partial without layout on HTMX toggle", async () => {
    const res = await request(server)
      .post(`/events/${publishedEventId}/save`)
      .set("Cookie", userCookie)
      .set("HX-Request", "true");
    expect(res.status).toBe(200);
    expect(res.text).not.toContain("<html");
    expect(res.text).toContain(`save-button-${publishedEventId}`);
  });

  it("HTMX response shows Unsave when event is currently saved", async () => {
    // At this point the event is saved (from re-save test above, then the HTMX test unsaved it)
    // Save it first so we know the state
    await request(server)
      .post(`/events/${publishedEventId}/save`)
      .set("Cookie", userCookie);

    const res = await request(server)
      .post(`/events/${publishedEventId}/save`)
      .set("Cookie", userCookie)
      .set("HX-Request", "true");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Save for Later");
  });

  it("HTMX response shows Save for Later when event is currently unsaved", async () => {
    // At this point event is unsaved (previous test unsaved it)
    const res = await request(server)
      .post(`/events/${publishedEventId}/save`)
      .set("Cookie", userCookie)
      .set("HX-Request", "true");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Unsave");
  });
});
