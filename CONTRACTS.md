# Contracts

What we are commiting to expose as a part of each feature

## Feature 1: Event Creation (Shrey)

#### Types

```ts
type EventStatus = "draft" | "published" | "cancelled" | "past";
type EventCategory = "academic" | "social" | "sports" | "club" | "career" | "arts" | "volunteer" | "other";
```

#### IEventRecord

```ts
interface IEventRecord {
  id: string;
  title: string;
  description: string;
  location: string;
  category: EventCategory;
  capacity: number;
  startDate: string;       // ISO 8601
  endDate: string;         // ISO 8601
  status: EventStatus;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
}
```

#### `IEventService.createEvent`

```
Method: createEvent(input: CreateEventInput, organizerId: string): Promise<Result<IEventRecord, EventError>>
```

**Parameters:** `title` (1–100), `description` (1–2000), `location` (1–200), `category` (valid EventCategory), `capacity` (positive integer), `startDate`/`endDate` (ISO 8601, end must be after start). `organizerId` comes from the session.

**Success:** `Ok<IEventRecord>` — status `"draft"`, generated `id`, `createdAt`, `updatedAt`

**Errors:** Named error per validation rule (`TitleRequired`, `TitleTooLong`, `DescriptionRequired`, `DescriptionTooLong`, `LocationRequired`, `LocationTooLong`, `CategoryRequired`, `CategoryInvalid`, `CapacityRequired`, `CapacityInvalid`, `StartDateRequired`, `StartDateInvalid`, `EndDateRequired`, `EndDateInvalid`, `EndDateBeforeStartDate`), plus `UnexpectedEventError` for repository failures.

#### `IEventRepository.findById` (shared — needed by Features 2, 3, 5, 8)

```
Method: findById(id: string, userRole: UserRole): Promise<Result<IEventRecord | null, EventError>>
```

Returns the event if found, `null` otherwise. Errors: `UnexpectedEventError`.

#### `IEventRepository.findByOrganizerId` (shared)

```
Method: findByOrganizerId(organizerId: string): Promise<Result<IEventRecord[], EventError>>
```

Returns all events by that organizer (may be empty). Errors: `UnexpectedEventError`.

## Feature 2: Event Detail Page (Karl)

## Feature 3: Event Editing (Jay)

#### `IEventService.editEvent`

```
Method: editEvent(eventId: string, input: EditEventInput, actingUserId: string, actingUserRole: UserRole): Promise<Result<IEventRecord, EventError>>
```

**Parameters:**
- `eventId` — string, the ID of the event to edit
- `input.title` — string, required, 1–100 chars
- `input.description` — string, required, 1–2000 chars
- `input.location` — string, required, 1–200 chars
- `input.category` — string, must be a valid EventCategory
- `input.capacity` — string (parsed to number), must be a positive integer
- `input.startDate` — string, ISO 8601 datetime
- `input.endDate` — string, ISO 8601 datetime, must be after startDate
- `actingUserId` — string, the authenticated user's ID (from session)
- `actingUserRole` — `"admin" | "staff" | "user"`, the authenticated user's role (from session)

**Success:** `Ok<IEventRecord>` — the updated event record with refreshed `updatedAt`; all other fields (e.g. `status`, `organizerId`) are unchanged

**Errors:**
- `EventNotFound` — no event exists with the given `eventId`
- `EventUnauthorized` — acting user is not the organizer and not an admin
- `InvalidEventStateTransition` — event status is `"cancelled"` or `"past"`
- `TitleRequired`, `TitleTooLong`, `DescriptionRequired`, `DescriptionTooLong`, `LocationRequired`, `LocationTooLong`, `CategoryRequired`, `CategoryInvalid`, `CapacityRequired`, `CapacityInvalid`, `StartDateRequired`, `StartDateInvalid`, `EndDateRequired`, `EndDateInvalid`, `EndDateBeforeStartDate` — same validation rules as `createEvent`
- `UnexpectedEventError` — repository failure

#### `IEventRepository.update`

```
Method: update(event: IEventRecord): Promise<Result<IEventRecord, EventError>>
```

**Parameters:**
- `event` — the full `IEventRecord` with updated fields and refreshed `updatedAt`

**Success:** `Ok<IEventRecord>` — the saved event record

**Errors:**
- `EventNotFound` — no event exists with the given `id`
- `UnexpectedEventError` — repository failure

#### Routes

- `GET /events/:id/edit` — Auth: `staff` or `admin`. Renders pre-populated edit form. Returns 403 if user is a member, 400 if event is cancelled or past, 404 if event not found.
- `POST /events/:id/edit` — Auth: `staff` or `admin`. Submits edits. On success redirects to `/events/:id`. On validation failure re-renders the form with the error message.

## Feature 4: My RSVPs Dashboard (Shrey)

#### Types

```ts
type RsvpStatus = "going" | "waitlisted" | "not_going";

interface IRsvpRecord {
  id: string;
  userId: string;
  eventId: string;
  status: RsvpStatus;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
}

interface IRsvpWithEvent {
  rsvp: IRsvpRecord;
  event: { id: string; title: string; location: string; category: string; startDate: string; endDate: string; status: string; };
}

interface IGroupedRsvps {
  upcoming: IRsvpWithEvent[];  // published + not ended, sorted by startDate asc
  past: IRsvpWithEvent[];      // ended or cancelled, sorted by startDate desc
}
```

#### `IRsvpRepository` (shared — used by Features 4 and 5)

```ts
interface IRsvpRepository {
  findByUserId(userId: string): Promise<Result<IRsvpWithEvent[], RsvpError>>;
  findByUserIdAndEventId(userId: string, eventId: string): Promise<Result<IRsvpRecord | null, RsvpError>>;
  upsert(rsvp: IRsvpRecord): Promise<Result<IRsvpRecord, RsvpError>>;
  delete(userId: string, eventId: string): Promise<Result<void, RsvpError>>;
  countByEventId(eventId: string): Promise<Result<number, RsvpError>>;
}
```

#### `IRsvpService.listUserRsvps`

```
Method: listUserRsvps(userId: string): Promise<Result<IGroupedRsvps, RsvpError>>
```

Filters out `not_going` RSVPs, groups the rest into `upcoming` (published events whose `endDate > now`) and `past` (ended/cancelled events). Each group is sorted by `startDate`.

**Errors:** `UnexpectedRsvpError`

#### Route: `GET /my-rsvps`

- **Auth:** `user` role only (staff/admin get 403)
- **Success:** Renders dashboard with "Upcoming" and "Past & Cancelled" sections
- **Upcoming rows** include an HTMX cancel button (`hx-post="/events/:id/rsvp"`) reusing the toggle route
- **Empty state:** "You haven't RSVP'd to any events yet."

#### Errors

```ts
type RsvpError =
  | { name: "RsvpNotFound"; message: string }
  | { name: "EventNotFound"; message: string }
  | { name: "AlreadyRsvped"; message: string }
  | { name: "InvalidRsvpStatus"; message: string }
  | { name: "UnexpectedRsvpError"; message: string };
```

## Feature 5: RSVP Toggle (Than)

#### Route: `POST /events/:id/rsvp`

- **Auth:** `user` role only (staff/admin rejected)
- **Behavior:** Toggles RSVP status — going/waitlisted → not_going, not_going/none → going (or waitlisted if at capacity)
- **HTMX:** Returns updated toggle partial with button + attendee count
- **Shared contract:** Uses `IRsvpRepository` defined in Feature 4


## Feature 6: Event Search (Than)


#### `IEventRepository.findUpcoming`

Method: `findUpcoming(): Promise<Result<IEventRecord[], EventError>>`

**Success:** `Ok<IEventRecord[]>` — all upcoming events excluding `cancelled` and `past`

**Errors:**
- `UnexpectedEventError` — repository failure

#### `IEventService.searchUpcoming`
Method: `searchUpcoming(query: string): Promise<Result<IEventSummary[], EventError>>`

**Parameters:**
- `query` — string; trimmed before matching
- empty query returns all upcoming events
- matching is case-insensitive across `title`, `description`, and `location`

**Success:** `Ok<IEventSummary[]>`

**Errors:**
- `UnexpectedEventError` — repository failure



## Feature 7: Publish and Cancel Events (Karl)

## Feature 8: Save for Later (Jay)

#### Types

```ts
interface ISavedEventRecord {
  id: string;
  userId: string;
  eventId: string;
  createdAt: string;   // ISO 8601
}

interface ISavedEventWithEvent {
  saved: ISavedEventRecord;
  event: {
    id: string;
    title: string;
    location: string;
    category: string;
    startDate: string;
    endDate: string;
    status: string;
  };
}
```

#### `ISavedEventRepository`

```ts
interface ISavedEventRepository {
  findByUserId(userId: string): Promise<Result<ISavedEventWithEvent[], SavedEventError>>;
  findByUserIdAndEventId(userId: string, eventId: string): Promise<Result<ISavedEventRecord | null, SavedEventError>>;
  save(record: ISavedEventRecord): Promise<Result<ISavedEventRecord, SavedEventError>>;
  unsave(userId: string, eventId: string): Promise<Result<void, SavedEventError>>;
}
```

#### `ISavedEventService.toggleSaved`

```
Method: toggleSaved(eventId: string, actingUserId: string, actingUserRole: UserRole): Promise<Result<{ saved: boolean }, SavedEventError>>
```

**Parameters:**
- `eventId` — string, the ID of the event to save or unsave
- `actingUserId` — string, the authenticated user's ID (from session)
- `actingUserRole` — `"admin" | "staff" | "user"`, the authenticated user's role (from session)

**Success:** `Ok<{ saved: boolean }>` — `saved: true` if the event was just saved, `saved: false` if it was just unsaved

**Errors:**
- `SavedEventUnauthorized` — acting user is not a member (role is `"admin"` or `"staff"`)
- `EventNotFound` — no event exists with the given `eventId`
- `UnexpectedSavedEventError` — repository failure

#### `ISavedEventService.listSaved`

```
Method: listSaved(actingUserId: string, actingUserRole: UserRole): Promise<Result<ISavedEventWithEvent[], SavedEventError>>
```

**Parameters:**
- `actingUserId` — string, the authenticated user's ID (from session)
- `actingUserRole` — the authenticated user's role (from session)

**Success:** `Ok<ISavedEventWithEvent[]>` — all saved events for the user joined with event details (may be empty)

**Errors:**
- `SavedEventUnauthorized` — acting user is not a member (role is `"admin"` or `"staff"`)
- `UnexpectedSavedEventError` — repository failure

#### Routes

- `POST /events/:id/save` — Auth: `user` role only. Toggles saved state for the event. Responds inline (HTMX) with an updated save/unsave button reflecting the new state. Returns 403 for staff/admin, 404 if event not found.
- `GET /saved-events` — Auth: `user` role only. Renders the member's saved events list. Returns 403 for staff/admin.

#### Errors

```ts
type SavedEventError =
  | { name: "EventNotFound"; message: string }
  | { name: "SavedEventUnauthorized"; message: string }
  | { name: "UnexpectedSavedEventError"; message: string };
```