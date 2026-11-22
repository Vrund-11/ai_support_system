# Keyset Cursor Pagination for Data Streams

SupportPilot uses keyset cursor pagination to deliver consistent, high-performance querying over large datasets.

## Query Parameters

- `limit`: Number of records to return (default 20, maximum 50).
- `cursor`: Opaque base64-encoded pointer containing the `updatedAt` timestamp and UUID of the last item in the previous page.

## Advantages over Offset Pagination

Keyset pagination avoids the $O(N)$ performance cliff of `OFFSET` queries in MongoDB and PostgreSQL and guarantees that records created or deleted during traversal do not cause skipped or duplicated items.
