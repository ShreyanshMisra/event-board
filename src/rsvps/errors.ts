export type RsvpError =
  | { name: "RsvpNotFound"; message: string }
  | { name: "EventNotFound"; message: string }
  | { name: "AlreadyRsvped"; message: string }
  | { name: "InvalidRsvpStatus"; message: string }
  | { name: "UnexpectedRsvpError"; message: string }
  | { name: "RsvpForbiddenRole"; message: string }
  | { name: "OwnEventRsvpForbidden"; message: string }
  | { name: "EventNotPublishedForRsvp"; message: string }
  | { name: "EventClosedForRsvp"; message: string };

export const RsvpNotFound = (message: string): RsvpError => ({
  name: "RsvpNotFound",
  message,
});

export const EventNotFound = (message: string): RsvpError => ({
  name: "EventNotFound",
  message,
});

export const AlreadyRsvped = (message: string): RsvpError => ({
  name: "AlreadyRsvped",
  message,
});

export const InvalidRsvpStatus = (message: string): RsvpError => ({
  name: "InvalidRsvpStatus",
  message,
});

export const UnexpectedRsvpError = (message: string): RsvpError => ({
  name: "UnexpectedRsvpError",
  message,
});

export const RsvpForbiddenRole = (message: string): RsvpError => ({
  name: "RsvpForbiddenRole",
  message,
});

export const OwnEventRsvpForbidden = (message: string): RsvpError => ({
  name: "OwnEventRsvpForbidden",
  message,
});

export const EventNotPublishedForRsvp = (message: string): RsvpError => ({
  name: "EventNotPublishedForRsvp",
  message,
});

export const EventClosedForRsvp = (message: string): RsvpError => ({
  name: "EventClosedForRsvp",
  message,
});
