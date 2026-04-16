export type EventError =
  | { name: "TitleRequired"; message: string }
  | { name: "TitleTooLong"; message: string }
  | { name: "DescriptionRequired"; message: string }
  | { name: "DescriptionTooLong"; message: string }
  | { name: "LocationRequired"; message: string }
  | { name: "LocationTooLong"; message: string }
  | { name: "CategoryRequired"; message: string }
  | { name: "CategoryInvalid"; message: string }
  | { name: "CapacityRequired"; message: string }
  | { name: "CapacityInvalid"; message: string }
  | { name: "StartDateRequired"; message: string }
  | { name: "StartDateInvalid"; message: string }
  | { name: "EndDateRequired"; message: string }
  | { name: "EndDateInvalid"; message: string }
  | { name: "EndDateBeforeStartDate"; message: string }
  | { name: "EventNotFound"; message: string }
  | { name: "UnexpectedEventError"; message: string }
  | { name: "EventUnauthorized"; message: string }
  | { name: "InvalidEventStateTransition"; message: string };

export const TitleRequired = (message: string): EventError => ({
  name: "TitleRequired",
  message,
});

export const TitleTooLong = (message: string): EventError => ({
  name: "TitleTooLong",
  message,
});

export const DescriptionRequired = (message: string): EventError => ({
  name: "DescriptionRequired",
  message,
});

export const DescriptionTooLong = (message: string): EventError => ({
  name: "DescriptionTooLong",
  message,
});

export const LocationRequired = (message: string): EventError => ({
  name: "LocationRequired",
  message,
});

export const LocationTooLong = (message: string): EventError => ({
  name: "LocationTooLong",
  message,
});

export const CategoryRequired = (message: string): EventError => ({
  name: "CategoryRequired",
  message,
});

export const CategoryInvalid = (message: string): EventError => ({
  name: "CategoryInvalid",
  message,
});

export const CapacityRequired = (message: string): EventError => ({
  name: "CapacityRequired",
  message,
});

export const CapacityInvalid = (message: string): EventError => ({
  name: "CapacityInvalid",
  message,
});

export const StartDateRequired = (message: string): EventError => ({
  name: "StartDateRequired",
  message,
});

export const StartDateInvalid = (message: string): EventError => ({
  name: "StartDateInvalid",
  message,
});

export const EndDateRequired = (message: string): EventError => ({
  name: "EndDateRequired",
  message,
});

export const EndDateInvalid = (message: string): EventError => ({
  name: "EndDateInvalid",
  message,
});

export const EndDateBeforeStartDate = (message: string): EventError => ({
  name: "EndDateBeforeStartDate",
  message,
});

export const EventNotFound = (message: string): EventError => ({
  name: "EventNotFound",
  message,
});

export const UnexpectedEventError = (message: string): EventError => ({
  name: "UnexpectedEventError",
  message,
});

export const EventUnauthorized = (message: string): EventError => ({
  name: "EventUnauthorized",
  message,
});

export const InvalidEventStateTransition = (message: string): EventError => ({
  name: "InvalidEventStateTransition",
  message,
});
