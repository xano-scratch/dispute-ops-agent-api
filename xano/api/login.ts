import { query, input, s, c, ref, inp, expr } from "@xanots/sdk";
import { disputeApi } from "./dispute.js";
import { operators } from "../tables/operators.js";

/**
 * Exchange email + password for a token. Lets the demo switch between the two
 * human roles and the agent identity by logging in as each.
 *
 * The password is taken as `input.text()` (not `input.password`, which would
 * hash the submission a second time), and the read names the internal `password`
 * column in `output` so `check_password` can see the stored hash.
 */
export const loginQuery = query({
  name: "login",
  verb: "POST",
  apiGroup: disputeApi,
  input: {
    email: input.email({ required: true, methods: ["lower"] }),
    password: input.text({ required: true }),
  },
  stack: [
    s.db.get({
      table: operators,
      fieldName: "email",
      fieldValue: inp("email"),
      output: ["id", "name", "email", "kind", "role", "resolve_limit_cents", "password"],
      as: "op",
    }),
    s.precondition({
      expr: expr(ref("op", { safe: true }), "!=", c.null()),
      error: c.text("No operator with that email."),
      error_type: "notfound",
    }),
    s.security.check_password({
      text_password: inp("password"),
      hash_password: ref("op.password"),
      as: "ok",
    }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error: c.text("Wrong password."),
      error_type: "unauthorized",
    }),
    s.security.create_auth_token({ table: operators, id: ref("op.id"), as: "token" }),
  ],
  response: {
    token: ref("token"),
    id: ref("op.id"),
    name: ref("op.name"),
    email: ref("op.email"),
    kind: ref("op.kind"),
    role: ref("op.role"),
    resolve_limit_cents: ref("op.resolve_limit_cents"),
  },
});
