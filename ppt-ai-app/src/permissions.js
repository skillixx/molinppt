import { AppError } from "./errors.js";

/**
 * Verifies whether an actor can access a resource.
 * @param {{actor: {userId: number, role?: string}, resource: {ownerUserId?: number}, action: string}} input
 * @returns {void}
 */
export function requirePermission({ actor, resource, action }) {
  if (actor.role === "admin" || actor.role === "operator") return;
  if (resource.ownerUserId === undefined || Number(resource.ownerUserId) === Number(actor.userId)) return;
  throw new AppError({
    code: "FORBIDDEN",
    status: 403,
    message: `FORBIDDEN: Forbidden to ${action} this resource`,
  });
}
