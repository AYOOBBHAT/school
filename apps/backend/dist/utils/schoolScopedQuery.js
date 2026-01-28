/**
 * Lightweight helper to enforce multi-tenant scoping on all queries.
 * Usage:
 *   scoped(adminSupabase.from('students').select('id'), user.schoolId)
 */
export function scoped(query, schoolId) {
    // Always scope by school_id for multi-tenant safety
    query.eq('school_id', schoolId);
    return query;
}
