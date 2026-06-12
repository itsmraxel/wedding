/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attendance from "../attendance.js";
import type * as contacts from "../contacts.js";
import type * as dashboard from "../dashboard.js";
import type * as events from "../events.js";
import type * as groups from "../groups.js";
import type * as guest from "../guest.js";
import type * as guide from "../guide.js";
import type * as kapso from "../kapso.js";
import type * as scheduled from "../scheduled.js";
import type * as seating from "../seating.js";
import type * as seed from "../seed.js";
import type * as sends from "../sends.js";
import type * as templates from "../templates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attendance: typeof attendance;
  contacts: typeof contacts;
  dashboard: typeof dashboard;
  events: typeof events;
  groups: typeof groups;
  guest: typeof guest;
  guide: typeof guide;
  kapso: typeof kapso;
  scheduled: typeof scheduled;
  seating: typeof seating;
  seed: typeof seed;
  sends: typeof sends;
  templates: typeof templates;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
