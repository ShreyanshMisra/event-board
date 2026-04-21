import type { Request, Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { IEventService, CreateEventInput, EditEventInput } from "./EventService";
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
  showDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
    isSaved?: boolean,
  ): Promise<void>;
  showHomePage(res: Response, session: IAppBrowserSession): Promise<void>;
  publishFromDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void>;

  cancelFromDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void>;
  showEditForm(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
    pageError?: string | null,
  ): Promise<void>;
  updateFromForm(
    req: Request,
    res: Response,
    input: EditEventInput,
    session: IAppBrowserSession,
  ): Promise<void>;
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

  async showDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
    isSaved: boolean = false,
  ): Promise<void> {
    const eventId = req.params.id as string;

    const user = session.authenticatedUser;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const result = await this.service.findVisibleEventById(
      eventId,
      user.userId,
      user.role,
    );

    if (result.ok === false) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Find event failed: ${error.message}`);

      res.status(status).render("errors/not-found", {
        pageError: error.message,
        session,
      });
      return;
    }

    if (!result.value) {
      res.status(404).render("errors/not-found", {
        pageError: "Event not found.",
        session,
      });
      return;
    }

    const event = result.value;

    const isOrganizer = event.organizerId === user.userId;
    const isAdmin = user.role === "admin";

    const canEdit = isOrganizer || isAdmin;
    const hasEnded = new Date(event.endDate).getTime() <= Date.now();
    const canRsvp =
      event.status === "published" && !isOrganizer && !isAdmin && !hasEnded;
    const canPublish = event.status === "draft" && (isOrganizer || isAdmin);
    const canCancel = event.status === "published" && (isOrganizer || isAdmin);

    const canSave = event.status === "published" && user.role === "user";

    res.render("events/detail", {
      event,
      session,
      pageError: null,
      canEdit,
      canRsvp,
      canPublish,
      canCancel,
      canSave,
      isSaved,
    });
  }

  async showHomePage(
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void> {
    const user = session.authenticatedUser;

    if (!user) {
      res.redirect("/login");
      return;
    }

    const result = await this.service.listVisibleEvents(user.userId, user.role);

    if (!result.ok) {
      const status = this.mapErrorStatus(result.value);
      res.status(status).render("home", {
        session,
        pageError: result.value.message,
        events: [],
      });
      return;
    }

    res.render("home", {
      session,
      pageError: null,
      events: result.value,
    });
  }

  async publishFromDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void> {
    const user = session.authenticatedUser;

    if (!user) {
      res.redirect("/login");
      return;
    }

    const eventId = req.params.id as string;
    const result = await this.service.publishEvent(
      eventId,
      user.userId,
      user.role,
    );

    const isHtmx = req.get("HX-Request") === "true";

    if (result.ok === false) {
      const error = result.value;
      const status = this.mapErrorStatus(error);

      res.status(status).render("errors/not-found", {
        pageError: error.message,
        session,
        layout: isHtmx ? false : undefined,
      });
      return;
    }

    const event = result.value;

    const isOrganizer = event.organizerId === user.userId;
    const isAdmin = user.role === "admin";

    const canEdit = isOrganizer || isAdmin;
    const hasEnded = new Date(event.endDate).getTime() <= Date.now();
    const canRsvp =
      event.status === "published" && !isOrganizer && !isAdmin && !hasEnded;
    const canPublish = event.status === "draft" && (isOrganizer || isAdmin);
    const canCancel = event.status === "published" && (isOrganizer || isAdmin);
    
    const canSave = event.status === "published" && user.role === "user";
    if (isHtmx) {
      res.render("events/detail", {
        event,
        session,
        pageError: null,
        canEdit,
        canRsvp,
        canPublish,
        canCancel,
        canSave,
        layout: false,
      });
      return;
    }

    res.redirect(`/events/${event.id}`);
  }

  async cancelFromDetailPage(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
  ): Promise<void> {
    const user = session.authenticatedUser;

    if (!user) {
      res.redirect("/login");
      return;
    }

    const eventId = req.params.id as string;
    const result = await this.service.cancelEvent(
      eventId,
      user.userId,
      user.role,
    );

    const isHtmx = req.get("HX-Request") === "true";

    if (result.ok === false) {
      const error = result.value;
      const status = this.mapErrorStatus(error);

      res.status(status).render("errors/not-found", {
        pageError: error.message,
        session,
        layout: isHtmx ? false : undefined,
      });
      return;
    }

    const event = result.value;

    const isOrganizer = event.organizerId === user.userId;
    const isAdmin = user.role === "admin";

    const canEdit = isOrganizer || isAdmin;
    const hasEnded = new Date(event.endDate).getTime() <= Date.now();
    const canRsvp =
      event.status === "published" && !isOrganizer && !isAdmin && !hasEnded;
    const canPublish = event.status === "draft" && (isOrganizer || isAdmin);
    const canCancel = event.status === "published" && (isOrganizer || isAdmin);
    
    const canSave = event.status === "published" && user.role === "user";
    if (isHtmx) {
      res.render("events/detail", {
        event,
        session,
        pageError: null,
        canEdit,
        canRsvp,
        canPublish,
        canCancel,
        canSave,
        layout: false,
      });
      return;
    }

    res.redirect(`/events/${event.id}`);
  }
  async showEditForm(
    req: Request,
    res: Response,
    session: IAppBrowserSession,
    pageError: string | null = null,
  ): Promise<void> {
    const user = session.authenticatedUser;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const eventId = req.params.id as string;
    const result = await this.service.findVisibleEventById(eventId, user.userId, user.role);

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      res.status(status).render("errors/not-found", { pageError: result.value.message, session });
      return;
    }

    if (!result.value) {
      res.status(404).render("errors/not-found", { pageError: "Event not found.", session });
      return;
    }

    const event = result.value;
    const isOrganizer = event.organizerId === user.userId;
    const isAdmin = user.role === "admin";

    if (!isOrganizer && !isAdmin) {
      res.status(403).render("errors/not-found", { pageError: "You are not allowed to edit this event.", session });
      return;
    }

    if (event.status === "cancelled" || event.status === "past") {
      res.status(400).render("errors/not-found", { pageError: "Cancelled or past events cannot be edited.", session });
      return;
    }

    res.render("events/edit", { event, pageError, session });
  }

  async updateFromForm(
    req: Request,
    res: Response,
    input: EditEventInput,
    session: IAppBrowserSession,
  ): Promise<void> {
    const user = session.authenticatedUser;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const eventId = req.params.id as string;
    const isHtmx = req.get("HX-Request") === "true";
    const result = await this.service.editEvent(eventId, input, user.userId, user.role);

    if (result.ok === false) {
      const error = result.value;
      const status = this.mapErrorStatus(error);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Edit event failed: ${error.message}`);

      if (isHtmx) {
        // Re-fetch event for pre-population
        const findResult = await this.service.findVisibleEventById(eventId, user.userId, user.role);
        const event = findResult.ok && findResult.value ? findResult.value : null;
        res.status(status).render("events/partials/edit-form", {
          event,
          pageError: error.message,
          session,
          layout: false,
        });
        return;
      }

      await this.showEditForm(req, res, session, error.message);
      return;
    }

    this.logger.info(`Edited event "${result.value.title}" (${result.value.id})`);

    if (isHtmx) {
      res.set("HX-Redirect", `/events/${result.value.id}`);
      res.sendStatus(204);
      return;
    }

    res.redirect(`/events/${result.value.id}`);
  }
}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(service, logger);
}
