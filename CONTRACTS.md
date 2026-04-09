# Contracts

What we are commiting to expose as a part of each feature

## Feature 1: Event Creation (Shrey)

#### Data Model: IEventRecord
- id (string)
- title (string)
- description (string)
- location (string)
- startDate (string ISO 8601)
- endDate (string ISO 8601)
- status ("draft" | "published")
- organizerId (string)
- createdAt (string ISO 8601)
- updatedAt (string ISO 8601)

#### File Structure
```
src/events/
    Event.ts              — IEventRecord, IEventSummary, status type
    errors.ts             — EventError union type + factory functions
    EventService.ts       — IEventService interface + implementation
    EventController.ts    — IEventController interface + implementation
    EventRepository.ts    — IEventRepository interface
    InMemoryEventRepository.ts   — Sprint 1-2
    PrismaEventRepository.ts     — Sprint 3
  src/views/events/
    create.ejs            — The creation form
    partials/
      form.ejs            — The form partial (for HTMX swap)

  export type EventStatus = "draft" | "published";
```

#### IEventRecord
```
  export interface IEventRecord {
    id: string;
    title: string;
    description: string;
    location: string;
    startDate: string;       // ISO 8601
    endDate: string;         // ISO 8601
    status: EventStatus;
    organizerId: string;
    createdAt: string;
    updatedAt: string;
  }
```

#### IEventSummary
```
  export interface IEventSummary {
    id: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    status: EventStatus;
  }
```

## Feature 2: Event Detail Page (Karl)

## Feature 3: Event Editing (Jay)

## Feature 4: My RSVPs Dashboard (Shrey) 

## Feature 5: RSVP Toggle (Than) 

## Feature 6: Event Search (Than) 

## Feature 7: Catagory and Date Filter (Karl)

## Feature 8: Save for Later (Jay)