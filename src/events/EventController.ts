import type { Response } from "express";
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
    res: Response,
    input: CreateEventInput,
    organizerId: string,
    session: IAppBrowserSession,
  ): Promise<void>;
}

class EventController implements IEventController {
  constructor(
    private readonly service: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  private mapErrorStatus(error: EventError): number {
    if (error.name === "EventValidationError") return 400;
    if (error.name === "EventNotFound") return 404;
    return 500;
  }

  async showCreateForm(
    res: Response,
    session: IAppBrowserSession,
    pageError: string | null = null,
  ): Promise<void> {
    res.render("events/create", { pageError, session });
  }

  async createFromForm(
    res: Response,
    input: CreateEventInput,
    organizerId: string,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.createEvent(input, organizerId);

    if (result.ok === false) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Create event failed: ${error.message}`);
      res.status(status);
      await this.showCreateForm(res, session, error.message);
      return;
    }

    this.logger.info(`Created event "${result.value.title}" (${result.value.id})`);
    res.redirect("/home");
  }
}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(service, logger);
}
