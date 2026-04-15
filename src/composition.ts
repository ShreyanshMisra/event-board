import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateEventController } from "./events/EventController";
import { CreateEventService } from "./events/EventService";
import { CreatePrismaEventRepository } from "./events/PrismaEventRepository";
import { CreateInMemoryEventRepository } from "./events/InMemoryEventRepository";
import { CreateRsvpController } from "./rsvps/RsvpController";
import { CreateRsvpService } from "./rsvps/RsvpService";
import { CreatePrismaRsvpRepository } from "./rsvps/PrismaRsvpRepository";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";

export function createComposedApp(logger?: ILoggingService): IApp {
  const resolvedLogger = logger ?? CreateLoggingService();

  // Authentication & authorization wiring
  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(authService, adminUserService, resolvedLogger);

  // Event wiring
  const eventRepository = CreateInMemoryEventRepository();
  const eventService = CreateEventService(eventRepository);
  const eventController = CreateEventController(eventService, resolvedLogger);

  // RSVP wiring
  const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  const prisma = new PrismaClient({ adapter });
  const rsvpRepository = CreatePrismaRsvpRepository(prisma);
  const rsvpService = CreateRsvpService(rsvpRepository);
  const rsvpController = CreateRsvpController(rsvpService, resolvedLogger);

  return CreateApp(authController, eventController, rsvpController, resolvedLogger);
}
