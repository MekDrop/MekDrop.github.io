module.exports = {
  meta: {
    type: "layout",
    docs: { description: "Keep super() constructor calls on their own lines." },
    fixable: "whitespace",
    schema: [],
    messages: { ownLine: "Place super() on its own line." },
  },
  create(context) {
    const source = context.sourceCode;

    return {
      "ExpressionStatement[expression.type='CallExpression'][expression.callee.type='Super']"(node) {
        const before = source.getTokenBefore(node, { includeComments: true });
        const after = source.getTokenAfter(node, { includeComments: true });
        const lineIndent = source.lines[node.loc.start.line - 1].match(/^\s*/)[0];
        const sharesPreviousLine = before && before.loc.end.line === node.loc.start.line;
        const indent = sharesPreviousLine ? `${lineIndent}  ` : lineIndent;

        if (before && before.loc.end.line === node.loc.start.line) {
          context.report({
            node,
            messageId: "ownLine",
            fix: (fixer) => fixer.replaceTextRange([before.range[1], node.range[0]], `\n${indent}`),
          });
        }

        if (after && after.loc.start.line === node.loc.end.line) {
          context.report({
            node,
            messageId: "ownLine",
            fix: (fixer) => fixer.replaceTextRange(
              [node.range[1], after.range[0]],
              `\n${after.value === "}" ? indent.slice(0, -2) : indent}`,
            ),
          });
        }
      },
    };
  },
};
