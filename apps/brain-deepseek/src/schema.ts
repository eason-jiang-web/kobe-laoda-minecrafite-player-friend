/**
 * MCP hands us JSON Schema built by the SDK from zod shapes. Model APIs are
 * pickier than MCP is: OpenAI-compatible endpoints dislike \$schema, choke on
 * bare \$ref pointers, and get weird about "type": ["string","null"].
 *
 * Normalising here keeps the MCP server untouched and means any new tool
 * registered on the server is callable by the model without extra ceremony.
 */

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asObj(v: unknown): Record<string, unknown> {
  return isObj(v) ? v : {};
}

const STRIP_KEYS = new Set(["$schema", "$id", "$comment", "$defs", "definitions"]);

export function normalizeSchema(input: unknown): Record<string, unknown> {
  const root = isObj(input) ? input : {};
  const defs: Record<string, unknown> = {
    ...asObj(root.definitions),
    ...asObj(root.$defs),
  };

  const walked = walk(root, defs, 0);
  const out = asObj(walked);

  for (const key of STRIP_KEYS) delete out[key];

  if (typeof out.type !== "string" && !Array.isArray(out.type)) out.type = "object";
  if (out.type === "object" && !isObj(out.properties)) out.properties = {};
  return out;
}

function walk(node: unknown, defs: Record<string, unknown>, depth: number): unknown {
  if (depth > 12) return {};
  if (Array.isArray(node)) return node.map((n) => walk(n, defs, depth + 1));
  if (!isObj(node)) return node;

  // Inline \$ref pointers — the model never sees a pointer it can't resolve.
  if (typeof node.$ref === "string") {
    const name = node.$ref.split("/").pop() ?? "";
    const target = defs[name];
    if (target === undefined) return {};
    return walk(target, defs, depth + 1);
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (STRIP_KEYS.has(key)) continue;
    out[key] = walk(value, defs, depth + 1);
  }

  // "type": ["string","null"] -> "string" (a null arg would break the tool anyway)
  if (Array.isArray(out.type)) {
    const types = out.type.filter((t) => typeof t === "string" && t !== "null");
    if (types.length === 1) out.type = types[0];
    else if (types.length === 0) delete out.type;
    else {
      delete out.type;
      out.anyOf = types.map((t) => ({ type: t }));
    }
  }

  if (Array.isArray(out.enum)) {
    const values = out.enum.filter((v) => v !== null);
    if (values.length > 0) out.enum = values;
    else delete out.enum;
  }

  if (out.type === "object" && !isObj(out.properties)) out.properties = {};
  return out;
}
