/**
 * Safe Supabase Query Wrapper
 * 
 * Wraps Supabase queries to provide consistent error handling.
 * Throws errors instead of returning error objects, making it easier
 * to use in try/catch blocks.
 * 
 * @param promise - Supabase query promise (e.g., supabase.from('table').select('*'))
 * @returns The data from the query
 * @throws Error if the query fails
 * 
 * @example
 * const rows = await safeQuery(
 *   supabase.from('teacher_unpaid_salary_months').select('*')
 * );
 */
export async function safeQuery<T = any>(promise: Promise<{ data: T | null; error: any }>): Promise<T | null> {
  const { data, error } = await promise;

  if (error) {
    console.error('[safeQuery] Supabase Error:', error);
    throw new Error(error.message || 'Database query failed');
  }

  return data;
}
