/**
 * GraphQL SDL Schema for Gateway (INT-3)
 * Exactly per docs/04-api-contracts.md section 8.2
 */
export const typeDefs = `#graphql
scalar DateTime

enum TicketStatus {
  NEW
  OPEN
  PENDING_CUSTOMER
  ON_HOLD
  RESOLVED
  CLOSED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum Role {
  OWNER
  LEAD
  AGENT
  VIEWER
  PLATFORM_ADMIN
}

enum SenderType {
  CUSTOMER
  AI
  AGENT
  SYSTEM
}

type Customer {
  id: ID!
  email: String
  name: String
}

type Agent {
  id: ID!
  name: String!
  role: Role!
}

type Citation {
  chunkId: ID!
  docId: ID!
  title: String!
}

type Message {
  id: ID!
  seq: Int!
  senderType: SenderType!
  body: String!
  isInternal: Boolean!
  citations: [Citation!]!
  createdAt: DateTime!
}

type Ticket {
  id: ID!
  number: Int!
  subject: String!
  status: TicketStatus!
  priority: Priority!
  assignee: Agent
  customer: Customer!
  tags: [String!]!
  version: Int!
  messages(limit: Int, cursor: String): MessagePage!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type MessagePage {
  items: [Message!]!
  nextCursor: String
}

type TicketPage {
  items: [Ticket!]!
  nextCursor: String
}

type AnalyticsOverview {
  open: Int!
  newToday: Int!
  medianFirstResponseMin: Float
  medianResolutionMin: Float
  deflectionRate: Float
  slaCompliance: Float
}

input TicketFilter {
  status: [TicketStatus!]
  priority: [Priority!]
  assigneeId: ID
  tag: String
  q: String
}

input UpdateTicketInput {
  status: TicketStatus
  priority: Priority
  assigneeId: ID
  tags: [String!]
  version: Int!
}

type Query {
  tickets(filter: TicketFilter, limit: Int = 25, cursor: String): TicketPage!
  ticket(id: ID!): Ticket
  analyticsOverview(rangeDays: Int = 7): AnalyticsOverview!
  me: Agent!
}

type Mutation {
  createTicket(subject: String!, description: String!, customerId: ID!): Ticket!
  updateTicket(id: ID!, input: UpdateTicketInput!): Ticket!
  addMessage(ticketId: ID!, body: String!, isInternal: Boolean = false): Message!
  assignTicket(id: ID!, agentId: ID!): Ticket!
  suggestReply(ticketId: ID!): String!
}

type Subscription {
  ticketUpdated: Ticket!
  messageAdded(ticketId: ID!): Message!
}
`;
