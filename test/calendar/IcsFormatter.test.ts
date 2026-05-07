import {
  formatGoogleCalendarUrl,
  formatIcsCalendar,
  type ICalendarEvent,
} from "../../src/calendar/IcsFormatter";

const sampleEvent: ICalendarEvent = {
  id: "evt-123",
  title: "Spring Hackathon",
  description: "Bring laptops and snacks.",
  location: "CS Building",
  startDate: "2026-06-01T14:00:00Z",
  endDate: "2026-06-01T18:00:00Z",
};

const fixedNow = new Date("2026-05-06T12:00:00Z");

describe("formatIcsCalendar", () => {
  it("emits a valid VCALENDAR with one VEVENT", () => {
    const ics = formatIcsCalendar([sampleEvent], fixedNow);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Event Board//Local Event Board//EN");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:evt-123@event-board.local");
    expect(ics).toContain("DTSTAMP:20260506T120000Z");
    expect(ics).toContain("DTSTART:20260601T140000Z");
    expect(ics).toContain("DTEND:20260601T180000Z");
    expect(ics).toContain("SUMMARY:Spring Hackathon");
    expect(ics).toContain("LOCATION:CS Building");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("uses CRLF line endings as required by RFC 5545", () => {
    const ics = formatIcsCalendar([sampleEvent], fixedNow);
    expect(ics).toMatch(/\r\n/);
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("emits multiple VEVENTs for a list", () => {
    const second: ICalendarEvent = {
      ...sampleEvent,
      id: "evt-456",
      title: "Career Fair",
    };
    const ics = formatIcsCalendar([sampleEvent, second], fixedNow);
    const vevents = ics.match(/BEGIN:VEVENT/g) ?? [];
    expect(vevents.length).toBe(2);
    expect(ics).toContain("UID:evt-456@event-board.local");
  });

  it("escapes commas, semicolons, backslashes, and newlines in text fields", () => {
    const tricky: ICalendarEvent = {
      ...sampleEvent,
      title: "Pizza, soda; bring it all",
      description: "Line one\nLine two\\backslash",
    };
    const ics = formatIcsCalendar([tricky], fixedNow);
    expect(ics).toContain("SUMMARY:Pizza\\, soda\\; bring it all");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\\\\backslash");
  });

  it("produces an empty calendar when no events are given", () => {
    const ics = formatIcsCalendar([], fixedNow);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

describe("formatGoogleCalendarUrl", () => {
  it("builds a Google Calendar template URL with required params", () => {
    const url = formatGoogleCalendarUrl(sampleEvent);
    expect(url).toContain("https://calendar.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("text=Spring+Hackathon");
    expect(url).toContain("dates=20260601T140000Z%2F20260601T180000Z");
    expect(url).toContain("location=CS+Building");
    expect(url).toContain("details=Bring+laptops+and+snacks.");
  });
});
