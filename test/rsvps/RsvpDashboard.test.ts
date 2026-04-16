import request from "supertest";
import { createComposedApp } from "../../src/composition";

const app = createComposedApp().getExpressApp();

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

function extractEventIds(html: string): string[] {
  return [...html.matchAll(UUID_RE)].map((m) => m[1]);
}

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

  const homeRes = await request(app).get("/home").set("Cookie", cookie);
  const ids = extractEventIds(homeRes.text);
  return ids[ids.length - 1] ?? "";
}

async function publishEvent(
  cookie: string,
  eventId: string,
): Promise<void> {
  await request(app)
    .post(`/events/${eventId}/publish`)
    .set("Cookie", cookie)
    .type("form")
    .send({});
}

async function rsvpToEvent(
  cookie: string,
  eventId: string,
): Promise<void> {
  await request(app)
    .post(`/events/${eventId}/rsvp`)
    .set("Cookie", cookie)
    .type("form")
    .send({});
}

describe("My RSVPs Dashboard — integration", () => {
  let staffCookie: string;
  let userCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    staffCookie = await loginAs("staff@app.test", "password123");
    userCookie = await loginAs("user@app.test", "password123");
    adminCookie = await loginAs("admin@app.test", "password123");
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

  // ── Role restriction ───────────────────────────────────────────────

  it("returns 403 for staff users", async () => {
    const res = await request(app)
      .get("/my-rsvps")
      .set("Cookie", staffCookie);
    expect(res.status).toBe(403);
  });

  it("returns 403 for admin users", async () => {
    const res = await request(app)
      .get("/my-rsvps")
      .set("Cookie", adminCookie);
    expect(res.status).toBe(403);
  });

  // ── Empty state ────────────────────────────────────────────────────

  it("shows empty state when user has no RSVPs", async () => {
    const res = await request(app)
      .get("/my-rsvps")
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("haven't RSVP'd");
  });

  // ── Grouping and sorting ───────────────────────────────────────────

  describe("with RSVPs", () => {
    let eventIdA: string;
    let eventIdB: string;
    let eventIdC: string;

    beforeAll(async () => {
      // Create events with different start dates for sort testing
      eventIdA = await createEvent(staffCookie, {
        title: "Alpha Workshop",
        startDate: "2027-09-01T10:00",
        endDate: "2027-09-01T12:00",
      });
      eventIdB = await createEvent(staffCookie, {
        title: "Beta Conference",
        startDate: "2027-07-15T09:00",
        endDate: "2027-07-15T17:00",
      });
      eventIdC = await createEvent(staffCookie, {
        title: "Gamma Meetup",
        startDate: "2027-08-10T14:00",
        endDate: "2027-08-10T16:00",
      });

      await publishEvent(staffCookie, eventIdA);
      await publishEvent(staffCookie, eventIdB);
      await publishEvent(staffCookie, eventIdC);

      await rsvpToEvent(userCookie, eventIdA);
      await rsvpToEvent(userCookie, eventIdB);
      await rsvpToEvent(userCookie, eventIdC);
    });

    it("renders dashboard with Upcoming section", async () => {
      const res = await request(app)
        .get("/my-rsvps")
        .set("Cookie", userCookie);
      expect(res.status).toBe(200);
      expect(res.text).toContain("Upcoming");
      expect(res.text).toContain("Alpha Workshop");
      expect(res.text).toContain("Beta Conference");
      expect(res.text).toContain("Gamma Meetup");
    });

    it("sorts upcoming RSVPs by startDate ascending", async () => {
      const res = await request(app)
        .get("/my-rsvps")
        .set("Cookie", userCookie);

      const html = res.text;
      const betaPos = html.indexOf("Beta Conference");
      const gammaPos = html.indexOf("Gamma Meetup");
      const alphaPos = html.indexOf("Alpha Workshop");

      // Beta (Jul) < Gamma (Aug) < Alpha (Sep)
      expect(betaPos).toBeLessThan(gammaPos);
      expect(gammaPos).toBeLessThan(alphaPos);
    });

    it("shows Going badge for active RSVPs", async () => {
      const res = await request(app)
        .get("/my-rsvps")
        .set("Cookie", userCookie);
      expect(res.text).toContain("Going");
    });

    it("shows Cancel RSVP button for upcoming events", async () => {
      const res = await request(app)
        .get("/my-rsvps")
        .set("Cookie", userCookie);
      expect(res.text).toContain("Cancel RSVP");
    });

    it("moves cancelled event RSVPs to Past & Cancelled section", async () => {
      // Cancel event B
      await request(app)
        .post(`/events/${eventIdB}/cancel`)
        .set("Cookie", staffCookie)
        .type("form")
        .send({});

      const res = await request(app)
        .get("/my-rsvps")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Past & Cancelled");
      // Beta should be in the past section now
      const pastPos = res.text.indexOf("Past & Cancelled");
      const betaPos = res.text.indexOf("Beta Conference");
      expect(betaPos).toBeGreaterThan(pastPos);
    });
  });

  // ── Inline cancel via HTMX ────────────────────────────────────────

  describe("inline cancel", () => {
    let cancelEventId: string;

    beforeAll(async () => {
      cancelEventId = await createEvent(staffCookie, {
        title: "Cancellable Seminar",
        startDate: "2027-11-01T10:00",
        endDate: "2027-11-01T12:00",
      });
      await publishEvent(staffCookie, cancelEventId);
      await rsvpToEvent(userCookie, cancelEventId);
    });

    it("cancels RSVP via POST toggle route and dashboard reflects it", async () => {
      // Verify it appears first
      let res = await request(app)
        .get("/my-rsvps")
        .set("Cookie", userCookie);
      expect(res.text).toContain("Cancellable Seminar");

      // Toggle (cancel) the RSVP
      await rsvpToEvent(userCookie, cancelEventId);

      // Verify it no longer appears in upcoming
      res = await request(app)
        .get("/my-rsvps")
        .set("Cookie", userCookie);
      expect(res.text).not.toContain("Cancellable Seminar");
    });
  });

  // ── Waitlisted RSVPs ──────────────────────────────────────────────

  describe("waitlisted RSVPs", () => {
    let fullEventId: string;
    let secondUserCookie: string;

    beforeAll(async () => {
      // Create an event with capacity 1
      fullEventId = await createEvent(staffCookie, {
        title: "Tiny Workshop",
        capacity: "1",
        startDate: "2027-12-01T10:00",
        endDate: "2027-12-01T12:00",
      });
      await publishEvent(staffCookie, fullEventId);

      // First user takes the only spot
      await rsvpToEvent(userCookie, fullEventId);
    });

    it("shows waitlisted RSVP in upcoming section", async () => {
      const res = await request(app)
        .get("/my-rsvps")
        .set("Cookie", userCookie);
      expect(res.status).toBe(200);
      expect(res.text).toContain("Tiny Workshop");
    });
  });
});
