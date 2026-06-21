/**
 * mainspring/no-float-money
 *
 * Money is never a float (docs/DOMAIN_MODEL.md §2). `Money.of` is typed to accept
 * a string only, so the compiler already rejects typed numbers. This rule is the
 * static backstop for the case types miss: a numeric *literal* written inline,
 * e.g. `Money.of(123.45)`. Use a string: `Money.of("123.45")`.
 */

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow constructing Money from a numeric literal (use a decimal string)." },
    schema: [],
    messages: {
      floatMoney:
        "Money must not be built from a number literal — use a decimal string, e.g. Money.of(\"{{ value }}\").",
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

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.object.type === "Identifier" &&
          callee.object.name === "Money" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "of"
        ) {
          const bad = numericLiteralArg(node.arguments[0]);
          if (bad) {
            const text = context.sourceCode.getText(bad);
            context.report({ node: bad, messageId: "floatMoney", data: { value: text } });
          }
        }
      },
    };
  },
};
