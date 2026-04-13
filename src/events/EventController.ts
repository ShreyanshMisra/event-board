import type { Request, Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { IEventService, CreateEventInput } from "./EventService";
import type { EventError } from "./errors";

export interface IEventController {
  showCreateForm(
    res: Response,
    session: IAppBrowserSession,
    pageError?: string | null,
  ): Promise<void>;
  createFromForm(
    req: Request,
    res: Response,
    input: CreateEventInput,
    organizerId: string,
    session: IAppBrowserSession,
  ): Promise<void>;

  searchUpcoming(req: Request, res: Response): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly service: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  private mapErrorStatus(error: EventError): number {
    if (error.name === "EventNotFound") return 404;
    if (error.name === "UnexpectedEventError") return 500;
    return 400;
  }

  async showCreateForm(
    res: Response,
    session: IAppBrowserSession,
    pageError: string | null = null,
  ): Promise<void> {
    res.render("events/create", { pageError, session });
  }

  async createFromForm(
    req: Request,
    res: Response,
    input: CreateEventInput,
    organizerId: string,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.createEvent(input, organizerId);
    const isHtmx = req.get("HX-Request") === "true";

    if (result.ok === false) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Create event failed: ${error.message}`);

      if (isHtmx) {
        res.status(status).render("events/partials/form", {
          pageError: error.message,
          session,
          layout: false,
        });
        return;
      }

      res.status(status);
      await this.showCreateForm(res, session, error.message);
      return;
    }

    this.logger.info(
      `Created event "${result.value.title}" (${result.value.id})`,
    );

    if (isHtmx) {
      res.set("HX-Redirect", "/home");
      res.sendStatus(204);
      return;
    }

    res.redirect("/home");
  }

  async searchUpcoming(req: Request, res: Response): Promise<void> {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const result = await this.service.searchUpcoming(query);

    if (result.ok === false) {
      res.status(500).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    res.render("events/partials/list", {
      events: result.value,
      layout: false,
    });
  }
}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(service, logger);
}
