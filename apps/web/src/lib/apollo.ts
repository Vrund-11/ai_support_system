import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';
import { useAuthStore } from '../store/auth.store';

const httpLink = createHttpLink({
  uri: '/graphql',
});

const authLink = new ApolloLink((operation, forward) => {
  const token = useAuthStore.getState().accessToken;
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  }));
  return forward(operation);
});

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      Ticket: {
        keyFields: ['id'],
      },
      Message: {
        keyFields: ['id'],
      },
    },
  }),
});
