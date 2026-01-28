/**
 * Lightweight helper to enforce multi-tenant scoping on all queries.
 * Usage:
 *   scoped(adminSupabase.from('students').select('id'), user.schoolId)
 */
export function scoped<T extends { eq: (column: string, value: unknown) => unknown }>(
  query: T,
  schoolId: string
): T {
  // Always scope by school_id for multi-tenant safety
  query.eq('school_id', schoolId);
  return query;
}

