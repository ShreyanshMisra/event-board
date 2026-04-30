import http from "http";
import request from "supertest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { createComposedApp } from "../../src/composition";

const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const app = createComposedApp().getExpressApp();
let server: http.Server;

beforeAll((done) => {
  server = app.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

let uniqueCounter = 0;

function unique(value: string): string {
  uniqueCounter += 1;
  return `${value}-${uniqueCounter}`;
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(server)
    .post("/login")
    .type("form")
    .send({ email, password });

  const cookies = res.headers["set-cookie"];
  const cookieHeader = Array.isArray(cookies) ? cookies[0] : cookies;
  return cookieHeader ?? "";
}

async function createRegularUser(
  adminCookie: string,
  email: string,
  displayName: string,
): Promise<void> {
  const res = await request(server)
    .post("/admin/users")
    .set("Cookie", adminCookie)
    .type("form")
    .send({
      email,
      displayName,
      password: "password123",
      role: "user",
    });

  expect(res.status).toBe(302);
}

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
): Promise<string> {
  const title = overrides.title ?? unique("Event");

  const body = {
    title,
    description: "Default description",
    location: "Default location",
    category: "academic",
    capacity: "25",
    startDate: "2026-06-10T10:00",
    endDate: "2026-06-10T12:00",
    ...overrides,
  };

  const res = await request(server)
    .post("/events")
    .set("Cookie", cookie)
    .type("form")
    .send(body);

  expect(res.status).toBe(302);
  return title;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findEventIdByTitle(
  cookie: string,
  title: string,
): Promise<string> {
  const home = await request(server).get("/home").set("Cookie", cookie);

  const escaped = escapeRegExp(title);
  const regex = new RegExp(
    `<h3[^>]*>${escaped}<\\/h3>[\\s\\S]*?href="/events/([0-9a-f-]{36})"`,
    "i",
  );

  const match = home.text.match(regex);
  expect(match).not.toBeNull();

  return match?.[1] as string;
}

async function publishEvent(cookie: string, title: string): Promise<string> {
  const id = await findEventIdByTitle(cookie, title);

  const res = await request(server)
    .post(`/events/${id}/publish`)
    .set("Cookie", cookie);

  expect(res.status).toBe(302);
  return id;
}

async function cancelEvent(cookie: string, id: string): Promise<void> {
  const res = await request(server)
    .post(`/events/${id}/cancel`)
    .set("Cookie", cookie);

  expect(res.status).toBe(302);
}

describe("RSVP Toggle — integration", () => {
  let userCookie: string;
  let user2Cookie: string;
  let staffCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    // ✅ CLEAN DATABASE BEFORE TESTS
    await prisma.rsvp.deleteMany();
    await prisma.event.deleteMany();

    staffCookie = await loginAs("staff@app.test", "password123");
    adminCookie = await loginAs("admin@app.test", "password123");
    userCookie = await loginAs("user@app.test", "password123");

    const email = `${unique("user")}@app.test`;
    await createRegularUser(adminCookie, email, "User 2");
    user2Cookie = await loginAs(email, "password123");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects unauthenticated toggle", async () => {
    const res = await request(server).post("/events/123/rsvp");
    expect(res.status).toBe(401);
  });

  it("creates RSVP as going", async () => {
    const title = await createEvent(staffCookie);
    const id = await publishEvent(staffCookie, title);

    const res = await request(server)
      .post(`/events/${id}/rsvp`)
      .set("Cookie", userCookie)
      .set("HX-Request", "true");

    expect(res.text).toContain("Cancel RSVP");
    expect(res.text).toContain("Attendees: 1");
  });

  it("toggles going -> not going", async () => {
    const title = await createEvent(staffCookie);
    const id = await publishEvent(staffCookie, title);

    await request(server).post(`/events/${id}/rsvp`).set("Cookie", userCookie);

    const res = await request(server)
      .post(`/events/${id}/rsvp`)
      .set("Cookie", userCookie)
      .set("HX-Request", "true");

    expect(res.text).toContain("RSVP");
    expect(res.text).toContain("Attendees: 0");
  });

  it("reactivates RSVP", async () => {
    const title = await createEvent(staffCookie);
    const id = await publishEvent(staffCookie, title);

    await request(server).post(`/events/${id}/rsvp`).set("Cookie", userCookie);
    await request(server).post(`/events/${id}/rsvp`).set("Cookie", userCookie);

    const res = await request(server)
      .post(`/events/${id}/rsvp`)
      .set("Cookie", userCookie)
      .set("HX-Request", "true");

    expect(res.text).toContain("Cancel RSVP");
  });

  it("puts second user on waitlist", async () => {
    const title = await createEvent(staffCookie, { capacity: "1" });
    const id = await publishEvent(staffCookie, title);

    await request(server).post(`/events/${id}/rsvp`).set("Cookie", userCookie);

    const res = await request(server)
      .post(`/events/${id}/rsvp`)
      .set("Cookie", user2Cookie)
      .set("HX-Request", "true");

    expect(res.text).toContain("Waitlisted");
    expect(res.text).toContain("Attendees: 1");
  });

  it("rejects staff RSVP", async () => {
    const title = await createEvent(staffCookie);
    const id = await publishEvent(staffCookie, title);

    const res = await request(server)
      .post(`/events/${id}/rsvp`)
      .set("Cookie", staffCookie);

    expect(res.status).toBe(400);
  });

  it("rejects draft event RSVP", async () => {
    const title = await createEvent(staffCookie);
    const id = await findEventIdByTitle(staffCookie, title);

    const res = await request(server)
      .post(`/events/${id}/rsvp`)
      .set("Cookie", userCookie);

    expect(res.status).toBe(400);
  });

  it("rejects cancelled event RSVP", async () => {
    const title = await createEvent(staffCookie);
    const id = await publishEvent(staffCookie, title);

    await cancelEvent(staffCookie, id);

    const res = await request(server)
      .post(`/events/${id}/rsvp`)
      .set("Cookie", userCookie);

    expect(res.status).toBe(400);
  });

  it("rejects past event RSVP", async () => {
    const title = await createEvent(staffCookie, {
      startDate: "2024-01-01T10:00",
      endDate: "2024-01-01T12:00",
    });

    const id = await publishEvent(staffCookie, title);

    const res = await request(server)
      .post(`/events/${id}/rsvp`)
      .set("Cookie", userCookie);

    expect(res.status).toBe(400);
  });

  it("returns partial HTML (no full page)", async () => {
    const title = await createEvent(staffCookie);
    const id = await publishEvent(staffCookie, title);

    const res = await request(server)
      .post(`/events/${id}/rsvp`)
      .set("Cookie", userCookie)
      .set("HX-Request", "true");

    expect(res.text).not.toContain("<html");
  });
});