/**
 * mainspring/no-float-money
 *
 * Money is never a float (docs/DOMAIN_MODEL.md §2). `Money.of` is typed to accept
 * a string only, so the compiler already rejects typed numbers. This rule is the
 * static backstop for the cases types miss:
 *  - a numeric *literal* written inline, e.g. `Money.of(123.45)`;
 *  - stringifying a JS float artifact into the exact pipeline (F6):
 *    `Money.of(String(1 / 3))` or `x.multiply(String(a / b))`. Compute with
 *    Decimal/MoneyDecimal and pass that, never `String(<arithmetic>)`.
 */

const ARITHMETIC = new Set(["+", "-", "*", "/", "%", "**"]);

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow constructing Money from a numeric literal or a stringified float artifact." },
    schema: [],
    messages: {
      floatMoney:
        "Money must not be built from a number literal — use a decimal string, e.g. Money.of(\"{{ value }}\").",
      floatString:
        "Do not stringify a JS float artifact into exact-decimal math — compute with Decimal/MoneyDecimal and pass that instead of String({{ value }}).",
    },
  },
  create(context) {
    const numericLiteralArg = (arg) => {
      if (!arg) return null;
      if (arg.type === "Literal" && typeof arg.value === "number") return arg;
      // negative literals: -5, -0.1
      if (
        arg.type === "UnaryExpression" &&
        arg.operator === "-" &&
        arg.argument.type === "Literal" &&
        typeof arg.argument.value === "number"
      ) {
        return arg;
      }
      return null;
    };

    // `String(<arithmetic | numeric literal>)` — a float artifact being stringified.
    const floatStringCall = (arg) => {
      if (!arg || arg.type !== "CallExpression") return null;
      if (arg.callee.type !== "Identifier" || arg.callee.name !== "String") return null;
      const inner = arg.arguments[0];
      if (!inner) return null;
      if (inner.type === "BinaryExpression" && ARITHMETIC.has(inner.operator)) return inner;
      if (numericLiteralArg(inner)) return inner;
      return null;
    };

    const isCallTo = (callee, obj, prop) =>
      callee.type === "MemberExpression" &&
      !callee.computed &&
      callee.object.type === "Identifier" &&
      callee.object.name === obj &&
      callee.property.type === "Identifier" &&
      callee.property.name === prop;

    return {
      CallExpression(node) {
        const callee = node.callee;

        // Money.of(<numeric literal>) or Money.of(String(<arithmetic>))
        if (isCallTo(callee, "Money", "of")) {
          const bad = numericLiteralArg(node.arguments[0]);
          if (bad) {
            context.report({ node: bad, messageId: "floatMoney", data: { value: context.sourceCode.getText(bad) } });
            return;
          }
          const floaty = floatStringCall(node.arguments[0]);
          if (floaty) {
            context.report({ node: floaty, messageId: "floatString", data: { value: context.sourceCode.getText(floaty) } });
          }
          return;
        }

        // <expr>.multiply(String(<arithmetic>))
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "multiply"
        ) {
          const floaty = floatStringCall(node.arguments[0]);
          if (floaty) {
            context.report({ node: floaty, messageId: "floatString", data: { value: context.sourceCode.getText(floaty) } });
          }
        }
      },
    };
  },
};
