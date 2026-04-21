import request from "supertest";
import { createComposedApp } from "../../src/composition";

let app: ReturnType<ReturnType<typeof createComposedApp>["getExpressApp"]>;

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

/**
 * Helper: create an event as staff/admin.
 */
async function createEvent(
  cookie: string,
  overrides: Partial<{
    title: string;
    description: string;
    location: string;
    category: string;
    capacity: string;
    startDate: string;
    endDate: string;
  }> = {},
): Promise<void> {
  const body = {
    title: "Default Event",
    description: "Default description",
    location: "Default location",
    category: "academic",
    capacity: "25",
    startDate: "2026-06-10T10:00",
    endDate: "2026-06-10T12:00",
    ...overrides,
  };

  const res = await request(app)
    .post("/events")
    .set("Cookie", cookie)
    .type("form")
    .send(body);

  expect(res.status).toBe(302);
  expect(res.headers.location).toBe("/home");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Helper: publish an event by matching its title on the home page,
 * then POSTing to /events/:id/publish.
 */
async function publishEventByTitle(
  cookie: string,
  title: string,
): Promise<void> {
  const home = await request(app).get("/home").set("Cookie", cookie);

  expect(home.status).toBe(200);

  const escapedTitle = escapeRegExp(title);
  const cardRegex = new RegExp(
    `<article[\\s\\S]*?<h3[^>]*>${escapedTitle}<\\/h3>[\\s\\S]*?<a\\s+href="/events/([0-9a-f-]{36})"`,
    "i",
  );

  const match = home.text.match(cardRegex);
  expect(match).not.toBeNull();

  const eventId = match?.[1];
  expect(eventId).toBeTruthy();

  const publishRes = await request(app)
    .post(`/events/${eventId}/publish`)
    .set("Cookie", cookie);

  expect(publishRes.status).toBe(302);
}

describe("Event Search — integration", () => {
  let staffCookie: string;

  beforeEach(async () => {
    app = createComposedApp().getExpressApp();
    staffCookie = await loginAs("staff@app.test", "password123");
  });

  it("returns matching published upcoming events by title", async () => {
    await createEvent(staffCookie, {
      title: "Career Fair",
      description: "Meet recruiters from top companies",
      location: "Student Center",
      category: "career",
    });

    await createEvent(staffCookie, {
      title: "Chess Club Night",
      description: "Weekly club meetup",
      location: "Library",
      category: "club",
      startDate: "2026-06-11T18:00",
      endDate: "2026-06-11T20:00",
    });

    await publishEventByTitle(staffCookie, "Career Fair");
    await publishEventByTitle(staffCookie, "Chess Club Night");

    const res = await request(app).get("/events/search").query({ q: "career" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Career Fair");
    expect(res.text).not.toContain("Chess Club Night");
  });

  it("matches description and location", async () => {
    await createEvent(staffCookie, {
      title: "Resume Workshop",
      description: "Recruiters will review resumes",
      location: "Innovation Lab",
      category: "career",
    });

    await publishEventByTitle(staffCookie, "Resume Workshop");

    const descriptionRes = await request(app)
      .get("/events/search")
      .query({ q: "recruiters" });

    expect(descriptionRes.status).toBe(200);
    expect(descriptionRes.text).toContain("Resume Workshop");

    const locationRes = await request(app)
      .get("/events/search")
      .query({ q: "innovation" });

    expect(locationRes.status).toBe(200);
    expect(locationRes.text).toContain("Resume Workshop");
  });

  it("returns no results when nothing matches", async () => {
    await createEvent(staffCookie, {
      title: "Study Group",
      description: "Weekly CS326 study session",
      location: "Room 101",
    });

    await publishEventByTitle(staffCookie, "Study Group");

    const res = await request(app)
      .get("/events/search")
      .query({ q: "basket weaving" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("No matching events found");
  });

  it("returns all published upcoming events for an empty query", async () => {
    await createEvent(staffCookie, {
      title: "Hackathon Kickoff",
      description: "Start building projects",
      location: "Engineering Hall",
      startDate: "2026-06-12T09:00",
      endDate: "2026-06-12T11:00",
    });

    await createEvent(staffCookie, {
      title: "Volunteer Day",
      description: "Community service event",
      location: "Town Center",
      category: "volunteer",
      startDate: "2026-06-13T09:00",
      endDate: "2026-06-13T12:00",
    });

    await publishEventByTitle(staffCookie, "Hackathon Kickoff");
    await publishEventByTitle(staffCookie, "Volunteer Day");

    const res = await request(app).get("/events/search").query({ q: "" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Hackathon Kickoff");
    expect(res.text).toContain("Volunteer Day");
  });

  it("trims surrounding whitespace in the query", async () => {
    await createEvent(staffCookie, {
      title: "Art Show",
      description: "Student artwork display",
      location: "Gallery",
      category: "arts",
    });

    await publishEventByTitle(staffCookie, "Art Show");

    const res = await request(app)
      .get("/events/search")
      .query({ q: "   art   " });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Art Show");
  });

  it("does not return draft events", async () => {
    await createEvent(staffCookie, {
      title: "Hidden Draft Event",
      description: "Should not appear in search",
      location: "Secret Room",
    });

    const res = await request(app).get("/events/search").query({ q: "hidden" });

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("Hidden Draft Event");
    expect(res.text).toContain("No matching events found");
  });

  it("returns 400 for invalid search input", async () => {
    const res = await request(app)
      .get("/events/search")
      .query({ q: "x".repeat(201) });

    expect(res.status).toBe(400);
    expect(res.text).toContain("Search query must be 200 characters or fewer");
  });

  it("returns partial HTML for HTMX search requests", async () => {
    await createEvent(staffCookie, {
      title: "Campus Movie Night",
      description: "Outdoor screening",
      location: "Main Quad",
      category: "social",
    });

    await publishEventByTitle(staffCookie, "Campus Movie Night");

    const res = await request(app)
      .get("/events/search")
      .set("HX-Request", "true")
      .query({ q: "movie" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Campus Movie Night");
    expect(res.text).not.toContain("<html");
  });
});