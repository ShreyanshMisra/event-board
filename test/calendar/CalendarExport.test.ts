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

async function createEvent(
  cookie: string,
  overrides: Record<string, string> = {},
): Promise<string> {
  const baseTitle =
    overrides.title ??
    `Calendar Test ${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const uniqueTitle = `${baseTitle} ${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { title: _ignored, ...rest } = overrides;
  const body = {
    description: "Default description text",
    location: "Room 101",
    category: "academic",
    capacity: "30",
    startDate: "2027-06-01T10:00",
    endDate: "2027-06-01T12:00",
    ...rest,
    title: uniqueTitle,
  };

  await request(server)
    .post("/events")
    .set("Cookie", cookie)
    .type("form")
    .send(body);

  const homeRes = await request(server).get("/home").set("Cookie", cookie);
  const escaped = uniqueTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = homeRes.text.match(
    new RegExp(`${escaped}[\\s\\S]*?/events/([0-9a-f-]{36})`),
  );
  return match?.[1] ?? "";
}

async function publishEvent(cookie: string, eventId: string): Promise<void> {
  await request(server)
    .post(`/events/${eventId}/publish`)
    .set("Cookie", cookie)
    .type("form")
    .send({});
}

async function rsvpToEvent(cookie: string, eventId: string): Promise<void> {
  await request(server)
    .post(`/events/${eventId}/rsvp`)
    .set("Cookie", cookie)
    .type("form")
    .send({});
}

describe("Calendar export — integration", () => {
  let staffCookie: string;
  let userCookie: string;
  let adminCookie: string;
  let publishedId: string;

  beforeAll(async () => {
    staffCookie = await loginAs("staff@app.test", "password123");
    userCookie = await loginAs("user@app.test", "password123");
    adminCookie = await loginAs("admin@app.test", "password123");

    publishedId = await createEvent(staffCookie, {
      title: "Calendar Export Demo",
      description: "Bring laptops; coffee provided.",
      location: "Room 101",
    });
    await publishEvent(staffCookie, publishedId);
  });

  describe("GET /events/:id/calendar.ics", () => {
    it("redirects unauthenticated requests to /login", async () => {
      const res = await request(server).get(
        `/events/${publishedId}/calendar.ics`,
      );
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });

    it("returns a text/calendar response with VEVENT for an authenticated user", async () => {
      const res = await request(server)
        .get(`/events/${publishedId}/calendar.ics`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/calendar/);
      expect(res.headers["content-disposition"]).toMatch(/attachment/);
      expect(res.headers["content-disposition"]).toMatch(/\.ics/);
      expect(res.text).toContain("BEGIN:VCALENDAR");
      expect(res.text).toContain("BEGIN:VEVENT");
      expect(res.text).toContain("SUMMARY:Calendar Export Demo");
      expect(res.text).toContain("LOCATION:Room 101");
      expect(res.text).toContain("END:VCALENDAR");
    });

    it("returns 404 for an unknown event id", async () => {
      const res = await request(server)
        .get("/events/00000000-0000-0000-0000-000000000000/calendar.ics")
        .set("Cookie", userCookie);
      expect(res.status).toBe(404);
    });

    it("hides draft events from non-organizers (404)", async () => {
      const draftId = await createEvent(staffCookie, {
        title: "Hidden Draft",
      });

      const res = await request(server)
        .get(`/events/${draftId}/calendar.ics`)
        .set("Cookie", userCookie);
      expect(res.status).toBe(404);
    });

    it("lets the organizer export a draft event they own", async () => {
      const draftId = await createEvent(staffCookie, {
        title: "Organizer Draft",
      });

      const res = await request(server)
        .get(`/events/${draftId}/calendar.ics`)
        .set("Cookie", staffCookie);
      expect(res.status).toBe(200);
      expect(res.text).toContain("SUMMARY:Organizer Draft");
    });
  });

  describe("GET /my-rsvps/calendar.ics", () => {
    it("redirects unauthenticated requests to /login", async () => {
      const res = await request(server).get("/my-rsvps/calendar.ics");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });

    it("returns 403 for non-member roles", async () => {
      const staffRes = await request(server)
        .get("/my-rsvps/calendar.ics")
        .set("Cookie", staffCookie);
      expect(staffRes.status).toBe(403);

      const adminRes = await request(server)
        .get("/my-rsvps/calendar.ics")
        .set("Cookie", adminCookie);
      expect(adminRes.status).toBe(403);
    });

    it("returns a calendar containing the member's upcoming RSVPed events", async () => {
      const eventId = await createEvent(staffCookie, {
        title: "Bulk Calendar Event",
        startDate: "2028-03-01T10:00",
        endDate: "2028-03-01T12:00",
      });
      await publishEvent(staffCookie, eventId);
      await rsvpToEvent(userCookie, eventId);

      const res = await request(server)
        .get("/my-rsvps/calendar.ics")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/calendar/);
      expect(res.headers["content-disposition"]).toMatch(
        /filename="my-rsvps\.ics"/,
      );
      expect(res.text).toContain("BEGIN:VCALENDAR");
      expect(res.text).toContain("SUMMARY:Bulk Calendar Event");
      expect(res.text).toContain("END:VCALENDAR");
    });
  });
});
