import {
  type ValidationContext,
  type ASTVisitor,
  type FieldNode,
  type FragmentDefinitionNode,
  type InlineFragmentNode,
  type OperationDefinitionNode,
  GraphQLError,
  Kind,
} from 'graphql';

/**
 * Depth limit validation rule enforcing maximum query nesting.
 * PRD requirement: depth limit 8.
 */
export function createDepthLimitRule(maxDepth = 8) {
  return (context: ValidationContext): ASTVisitor => {
    return {
      OperationDefinition(node: OperationDefinitionNode) {
        const depth = getDepth(node, context, 0);
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(
              `Query depth of ${depth} exceeds maximum allowed depth of ${maxDepth}`,
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

function getDepth(
  node: OperationDefinitionNode | FieldNode | InlineFragmentNode | FragmentDefinitionNode,
  context: ValidationContext,
  currentDepth: number,
): number {
  if (!node.selectionSet) {
    return currentDepth;
  }

  let maxChildDepth = currentDepth;

  for (const selection of node.selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      // Ignore __typename and metadata introspection
      if (selection.name.value.startsWith('__')) {
        continue;
      }
      const childDepth = getDepth(selection, context, currentDepth + 1);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      const childDepth = getDepth(selection, context, currentDepth);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = context.getFragment(selection.name.value);
      if (fragment) {
        const childDepth = getDepth(fragment, context, currentDepth);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
    }
  }

  return maxChildDepth;
}
