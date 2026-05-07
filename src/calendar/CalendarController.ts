import type { Request, Response } from "express";
import type { UserRole } from "../auth/User";
import type { ILoggingService } from "../service/LoggingService";
import type { IEventService } from "../events/EventService";
import type { IRsvpService } from "../rsvps/RsvpService";
import type { IRsvpWithEvent } from "../rsvps/Rsvp";
import {
  formatIcsCalendar,
  type ICalendarEvent,
} from "./IcsFormatter";

export interface ICalendarController {
  exportEvent(
    req: Request,
    res: Response,
    userId: string,
    userRole: UserRole,
  ): Promise<void>;
  exportMyRsvps(
    req: Request,
    res: Response,
    userId: string,
  ): Promise<void>;
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9-_]+/g, "-").slice(0, 60) || "event";
}

function sendIcs(res: Response, filename: string, body: string): void {
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  res.status(200).send(body);
}

class CalendarController implements ICalendarController {
  constructor(
    private readonly events: IEventService,
    private readonly rsvps: IRsvpService,
    private readonly logger: ILoggingService,
  ) {}

  async exportEvent(
    req: Request,
    res: Response,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    const eventId = req.params.id as string;
    const result = await this.events.findVisibleEventById(
      eventId,
      userId,
      userRole,
    );

    if (result.ok === false) {
      this.logger.error(
        `Calendar export failed: ${result.value.message}`,
      );
      res.status(500).render("partials/error", {
        message: "Unable to export this event.",
        layout: false,
      });
      return;
    }

    const event = result.value;
    if (!event) {
      res.status(404).render("partials/error", {
        message: "Event not found.",
        layout: false,
      });
      return;
    }

    const calendarEvent: ICalendarEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startDate: event.startDate,
      endDate: event.endDate,
    };

    const body = formatIcsCalendar([calendarEvent]);
    const filename = `${safeFilenamePart(event.title)}.ics`;
    this.logger.info(`Exported calendar for event ${event.id}`);
    sendIcs(res, filename, body);
  }

  async exportMyRsvps(
    _req: Request,
    res: Response,
    userId: string,
  ): Promise<void> {
    const result = await this.rsvps.listUserRsvps(userId);

    if (result.ok === false) {
      this.logger.error(
        `Calendar export failed: ${result.value.message}`,
      );
      res.status(500).render("partials/error", {
        message: "Unable to export your RSVPs.",
        layout: false,
      });
      return;
    }

    const upcoming = result.value.upcoming;
    const calendarEvents: ICalendarEvent[] = upcoming.map(
      (item: IRsvpWithEvent) => ({
        id: item.event.id,
        title: item.event.title,
        description: "",
        location: item.event.location,
        startDate: item.event.startDate,
        endDate: item.event.endDate,
      }),
    );

    const body = formatIcsCalendar(calendarEvents);
    this.logger.info(
      `Exported calendar for ${calendarEvents.length} upcoming RSVPs (user ${userId})`,
    );
    sendIcs(res, "my-rsvps.ics", body);
  }
}

export function CreateCalendarController(
  events: IEventService,
  rsvps: IRsvpService,
  logger: ILoggingService,
): ICalendarController {
  return new CalendarController(events, rsvps, logger);
}
