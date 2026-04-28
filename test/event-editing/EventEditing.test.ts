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

function validEditBody() {
  return {
    title: "Updated Study Group",
    description: "Updated weekly session",
    location: "Room 202",
    category: "social",
    capacity: "50",
    startDate: "2026-07-01T10:00",
    endDate: "2026-07-01T12:00",
  };
}

async function createEventAndGetId(cookie: string): Promise<string> {
  await request(app)
    .post("/events")
    .set("Cookie", cookie)
    .type("form")
    .send(validEventBody());

  const homeRes = await request(app).get("/home").set("Cookie", cookie);
  const matches = [...homeRes.text.matchAll(/href="\/events\/([a-f0-9-]+)"/g)];
  const lastMatch = matches[matches.length - 1];
  if (!lastMatch?.[1]) throw new Error("Event ID not found after creation");
  return lastMatch[1];
}

describe("Event Editing — integration", () => {
  let staffCookie: string;
  let adminCookie: string;
  let userCookie: string;
  let staffEventId: string;     // created by staff, stays draft
  let adminEventId: string;     // created by admin (used to test unauthorized access)
  let cancelledEventId: string; // created by staff, published then cancelled

  beforeAll(async () => {
    staffCookie = await loginAs("staff@app.test", "password123");
    adminCookie = await loginAs("admin@app.test", "password123");
    userCookie = await loginAs("user@app.test", "password123");

    staffEventId = await createEventAndGetId(staffCookie);
    adminEventId = await createEventAndGetId(adminCookie);

    cancelledEventId = await createEventAndGetId(staffCookie);
    await request(app).post(`/events/${cancelledEventId}/publish`).set("Cookie", staffCookie);
    await request(app).post(`/events/${cancelledEventId}/cancel`).set("Cookie", staffCookie);
  });

  // ── Auth & role guards ──────────────────────────────────────────────

  it("redirects unauthenticated GET to /login", async () => {
    const res = await request(app).get(`/events/${staffEventId}/edit`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("rejects unauthenticated POST with 401", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .type("form")
      .send(validEditBody());
    expect(res.status).toBe(401);
  });

  it("rejects a member GET with 403", async () => {
    const res = await request(app)
      .get(`/events/${staffEventId}/edit`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(403);
  });

  it("rejects a member POST with 403", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", userCookie)
      .type("form")
      .send(validEditBody());
    expect(res.status).toBe(403);
  });

  // ── Not found ───────────────────────────────────────────────────────

  it("returns 404 on GET for a non-existent event", async () => {
    const res = await request(app)
      .get("/events/does-not-exist/edit")
      .set("Cookie", staffCookie);
    expect(res.status).toBe(404);
  });

  it("returns 404 on POST for a non-existent event", async () => {
    const res = await request(app)
      .post("/events/does-not-exist/edit")
      .set("Cookie", staffCookie)
      .type("form")
      .send(validEditBody());
    expect(res.status).toBe(404);
  });

  // ── Not authorized ──────────────────────────────────────────────────

  it("returns 403 when staff edits an event they do not own", async () => {
    const res = await request(app)
      .post(`/events/${adminEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send(validEditBody());
    expect(res.status).toBe(403);
  });

  it("allows admin to edit an event they did not create", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", adminCookie)
      .type("form")
      .send(validEditBody());
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/events/${staffEventId}`);
  });

  // ── Invalid state ───────────────────────────────────────────────────

  it("returns 400 on GET for a cancelled event", async () => {
    const res = await request(app)
      .get(`/events/${cancelledEventId}/edit`)
      .set("Cookie", staffCookie);
    expect(res.status).toBe(400);
  });

  it("returns 400 on POST for a cancelled event", async () => {
    const res = await request(app)
      .post(`/events/${cancelledEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send(validEditBody());
    expect(res.status).toBe(400);
    expect(res.text).toContain("Cancelled or past events cannot be edited");
  });

  // ── Happy path ──────────────────────────────────────────────────────

  it("edits an event and redirects to the detail page on valid input", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send(validEditBody());
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/events/${staffEventId}`);
  });

  // ── Validation — title ──────────────────────────────────────────────

  it("returns 400 when title is missing", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), title: "" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Title is required");
  });

  it("returns 400 when title exceeds 100 characters", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), title: "x".repeat(101) });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Title must be 100 characters or fewer");
  });

  // ── Validation — description ────────────────────────────────────────

  it("returns 400 when description is missing", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), description: "" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Description is required");
  });

  it("returns 400 when description exceeds 2000 characters", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), description: "x".repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Description must be 2000 characters or fewer");
  });

  // ── Validation — location ───────────────────────────────────────────

  it("returns 400 when location is missing", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), location: "" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Location is required");
  });

  it("returns 400 when location exceeds 200 characters", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), location: "x".repeat(201) });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Location must be 200 characters or fewer");
  });

  // ── Validation — category ───────────────────────────────────────────

  it("returns 400 when category is missing", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), category: "" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Category is required");
  });

  it("returns 400 when category is invalid", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), category: "cooking" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Category must be one of");
  });

  // ── Validation — capacity ───────────────────────────────────────────

  it("returns 400 when capacity is missing", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), capacity: "" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Capacity is required");
  });

  it("returns 400 when capacity is zero", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), capacity: "0" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Capacity must be a positive whole number");
  });

  it("returns 400 when capacity is not an integer", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), capacity: "2.5" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Capacity must be a positive whole number");
  });

  // ── Validation — dates ──────────────────────────────────────────────

  it("returns 400 when start date is missing", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), startDate: "" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Start date is required");
  });

  it("returns 400 when start date is invalid", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), startDate: "not-a-date" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Start date is not a valid date");
  });

  it("returns 400 when end date is missing", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), endDate: "" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("End date is required");
  });

  it("returns 400 when end date is invalid", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), endDate: "not-a-date" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("End date is not a valid date");
  });

  it("returns 400 when end date is before start date", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), startDate: "2026-07-01T14:00", endDate: "2026-07-01T10:00" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("End date must be after the start date");
  });

  it("returns 400 when end date equals start date", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .type("form")
      .send({ ...validEditBody(), startDate: "2026-07-01T10:00", endDate: "2026-07-01T10:00" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("End date must be after the start date");
  });

  // ── HTMX behaviour ──────────────────────────────────────────────────

  it("returns HX-Redirect on successful HTMX submission", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .set("HX-Request", "true")
      .type("form")
      .send(validEditBody());
    expect(res.status).toBe(204);
    expect(res.headers["hx-redirect"]).toBe(`/events/${staffEventId}`);
  });

  it("returns form partial without layout on HTMX validation error", async () => {
    const res = await request(app)
      .post(`/events/${staffEventId}/edit`)
      .set("Cookie", staffCookie)
      .set("HX-Request", "true")
      .type("form")
      .send({ ...validEditBody(), title: "" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Title is required");
    expect(res.text).not.toContain("<html");
  });
});
