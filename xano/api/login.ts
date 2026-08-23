import { query, input, s, ref, inp, expr, c, obj } from "@xanots/core";
import { disputeApi } from "./dispute-group.js";
import { operators } from "../tables/operators.js";

/**
 * POST api:dispute/login — exchange email + password for a token, so the demo
 * can switch between the human roles and the agent identity. Password is taken
 * as text() (not password()) so it is not double-hashed before check_password.
 */
export const loginQuery = query({
  name: "login",
  verb: "POST",
  apiGroup: disputeApi,
  auth: false,
  input: {
    email: input.email({ required: true, methods: ["lower", "trim"] }),
    password: input.text({ required: true }),
  },
  stack: [
    // `output` must name the internal password column to read its hash.
    s.db.get({
      table: operators,
      fieldName: "email",
      fieldValue: inp("email"),
      output: [
        "id",
        "email",
        "name",
        "kind",
        "role",
        "resolve_limit_cents",
        "password",
      ],
      as: "u",
    }),
    s.precondition({
      expr: expr(ref("u"), "!=", c.null()),
      error: c.text("That email and password do not match."),
      error_type: "unauthorized",
    }),
    s.security.check_password({
      text_password: inp("password"),
      hash_password: ref("u.password"),
      as: "ok",
    }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error: c.text("That email and password do not match."),
      error_type: "unauthorized",
    }),
    s.security.create_auth_token({
      table: operators,
      id: ref("u.id"),
      as: "token",
    }),
  ],
  response: {
    token: ref("token"),
    operator: obj({
      id: ref("u.id"),
      name: ref("u.name"),
      email: ref("u.email"),
      kind: ref("u.kind"),
      role: ref("u.role"),
      resolve_limit_cents: ref("u.resolve_limit_cents"),
    }),
  },
});

export type LoginBody = import("@xanots/core").InferInput<typeof loginQuery>;
export type LoginResponse = import("@xanots/core").InferResponse<
  typeof loginQuery
>;
