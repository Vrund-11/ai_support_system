import {
  type ValidationContext,
  type ASTVisitor,
  type OperationDefinitionNode,
  GraphQLError,
  Kind,
} from 'graphql';

/**
 * Complexity limit validation rule counting requested field selections.
 * Prevents resource exhaustion from wide or malicious queries (INT-3).
 */
export function createComplexityLimitRule(maxComplexity = 100) {
  return (context: ValidationContext): ASTVisitor => {
    return {
      OperationDefinition(node: OperationDefinitionNode) {
        let fieldCount = 0;

        function countFields(selectionSet: typeof node.selectionSet): void {
          if (!selectionSet) return;
          for (const sel of selectionSet.selections) {
            if (sel.kind === Kind.FIELD) {
              if (!sel.name.value.startsWith('__')) {
                fieldCount += 1;
              }
              if (sel.selectionSet) {
                countFields(sel.selectionSet);
              }
            } else if (sel.kind === Kind.INLINE_FRAGMENT) {
              countFields(sel.selectionSet);
            }
          }
        }

        countFields(node.selectionSet);

        if (fieldCount > maxComplexity) {
          context.reportError(
            new GraphQLError(
              `Query complexity of ${fieldCount} exceeds maximum allowed complexity of ${maxComplexity}`,
              {
                nodes: [node],
                extensions: { code: 'BAD_USER_INPUT' },
              },
            ),
          );
        }
      },
    };
  };
}
