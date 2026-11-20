/** Room naming conventions per PRD & API contracts */
export function tenantRoom(tenantId: string): string {
  return `t:${tenantId}`;
}

export function userRoom(userId: string): string {
  return `u:${userId}`;
}

export function conversationRoom(conversationId: string): string {
  return `c:${conversationId}`;
}
