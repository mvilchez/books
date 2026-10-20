/**
 * Saga book reading-status transitions.
 *
 * The saga detail page and the saga series list offer the same two actions
 * for a book in the library, so the decision lives here (pure and testable)
 * instead of being duplicated in the components.
 */

/** The action offered for a book that is already in the library. */
export type SagaBookAction = "start" | "unread";

/**
 * Which action a saga book should offer:
 * - `start` for a wishlist / not-started book ("Start reading"),
 * - `unread` for a started or finished book ("Mark unread"),
 * - `null` when the book is not in the library (no action).
 */
export function getSagaBookAction(
  status: string | null | undefined,
): SagaBookAction | null {
  if (status === "PENDING" || status === "WISH_LIST") return "start";
  if (status === "READING" || status === "COMPLETED") return "unread";
  return null;
}
