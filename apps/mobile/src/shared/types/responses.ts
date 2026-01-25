/**
 * API Response Types
 * Standard response wrappers for API endpoints
 */

export interface ListResponse<T> {
  data: T[];
}

export interface SingleResponse<T> {
  data: T;
}

export interface CreateResponse {
  id: string;
  message?: string | null;
}

export interface UpdateResponse {
  success: boolean;
  message?: string | null;
}

export interface DeleteResponse {
  success: boolean;
  message?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
