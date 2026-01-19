import { AuthResponse, User, Student, ClassGroup, Subject, Attendance, Mark, Fee, DashboardStats } from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.31.10.67:4000';
// Billing disabled in this deployment
const BILLING_ENABLED = false;

// Log API URL on initialization (for debugging - remove in production)
if (__DEV__) {
  console.log('[API Service] API_BASE_URL:', API_BASE_URL);
  console.log('[API Service] EXPO_PUBLIC_API_URL from env:', process.env.EXPO_PUBLIC_API_URL);
}

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (__DEV__) {
      if (token) {
        console.log(`[API Service] Token set. Length: ${token.length}, Preview: ${token.substring(0, 20)}...`);
      } else {
        console.log('[API Service] Token cleared');
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Normalize API_BASE_URL (remove trailing slash) and endpoint (ensure leading slash)
    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${normalizedEndpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Only add Authorization header if token exists and is not empty
    if (this.token && this.token.trim()) {
      headers['Authorization'] = `Bearer ${this.token}`;
      if (__DEV__) {
        console.log(`[API Request] Adding Bearer token to ${endpoint}. Token length: ${this.token.length}`);
      }
    } else {
      // Log warning if token is missing for protected endpoints (except auth endpoints)
      if (!endpoint.startsWith('/auth/')) {
        console.warn(`[API Request] ${endpoint} made without token. Token: ${this.token ? 'exists but empty' : 'null'}`);
        console.warn(`[API Request] Current token state:`, {
          token: this.token,
          tokenType: typeof this.token,
          tokenLength: this.token?.length || 0
        });
      }
      // Clear any invalid token state
      if (this.token && !this.token.trim()) {
        this.token = null;
      }
    }

    let response: Response;
    try {
      if (__DEV__) {
        console.log(`[API Request] Making ${options.method || 'GET'} request to: ${url}`);
        console.log(`[API Request] Headers:`, JSON.stringify(headers, null, 2));
      }
      response = await fetch(url, {
        ...options,
        headers,
      });
      if (__DEV__) {
        console.log(`[API Request] Response status: ${response.status} ${response.statusText}`);
      }
    } catch (networkError: any) {
      console.error('[API Request] Network error:', networkError);
      console.error('[API Request] Error details:', {
        message: networkError.message,
        name: networkError.name,
        stack: networkError.stack?.substring(0, 200)
      });
      throw new Error(`Network error: ${networkError.message || 'Unable to connect to server'}`);
    }

    if (!response.ok) {
      let error: any;
      let errorText: string = '';
      try {
        errorText = await response.text();
        error = errorText ? JSON.parse(errorText) : { error: `HTTP ${response.status}` };
      } catch (parseError) {
        // Response is not JSON
        error = { error: `HTTP ${response.status}: ${response.statusText || 'Unknown error'}` };
        errorText = error.error;
      }
      
      // Log error details for debugging
      if (__DEV__) {
        console.error(`[API Request] Error for ${endpoint}:`, {
          status: response.status,
          statusText: response.statusText,
          error: error.error || error.message,
          errorText: errorText.substring(0, 200) // First 200 chars
        });
      }
      
      // Handle authentication errors for protected endpoints only
      // Auth endpoints (like /auth/login) return 401 for invalid credentials, which is different
      const isAuthEndpoint = endpoint.startsWith('/auth/');
      
      if (!isAuthEndpoint && (response.status === 401 || error.error?.toLowerCase().includes('bearer') || error.error?.toLowerCase().includes('token'))) {
        // Clear token if it's invalid (but not for auth endpoints)
        this.token = null;
        throw new Error('Authentication required. Please log in again.');
      }
      
      // For auth endpoints and other errors, use the original error message
      const errorMessage = error.error || error.message || `HTTP ${response.status}`;
      
      // Log additional context for debugging
      if (__DEV__ && isAuthEndpoint && errorMessage.toLowerCase().includes('bearer')) {
        console.error(`[API Request] Unexpected bearer token error on auth endpoint ${endpoint}:`, {
          status: response.status,
          error: errorMessage,
          url: url
        });
      }
      
      throw new Error(errorMessage);
    }

    // Parse JSON response with better error handling
    try {
      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server');
      }
      return JSON.parse(text);
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError);
      throw new Error(`Invalid response format: ${parseError.message || 'Could not parse server response'}`);
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<AuthResponse> {
    if (__DEV__) {
      console.log('[API Login] Starting login request to /auth/login');
      console.log('[API Login] Current token before login:', this.token ? 'exists' : 'null');
    }
    
    try {
      const response = await this.request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      // Debug logging
      if (__DEV__) {
        console.log('[API Login] Response received:', {
          hasUser: !!response.user,
          hasToken: !!response.token,
          tokenLength: response.token?.length || 0,
          tokenPreview: response.token ? `${response.token.substring(0, 20)}...` : 'none'
        });
      }
      
      if (!response.token) {
        console.error('[API Login] No token in response!', response);
        throw new Error('Login response missing token');
      }
      
      this.setToken(response.token);
      
      if (__DEV__) {
        console.log('[API Login] Token set in API service. Current token:', this.token ? 'exists' : 'null');
      }
      
      return response;
    } catch (error: any) {
      console.error('[API Login] Login request failed:', {
        message: error.message,
        endpoint: '/auth/login',
        url: `${API_BASE_URL}/auth/login`
      });
      throw error;
    }
  }

  async signupPrincipal(data: {
    email: string;
    password: string;
    full_name: string;
    school_name: string;
    school_address?: string;
    contact_phone?: string;
    contact_email?: string;
  }): Promise<AuthResponse> {
    const response = await this.request<{ user: User; token: string }>('/auth/signup-principal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(response.token);
    return response;
  }

  async signupJoin(data: {
    email: string;
    password: string;
    full_name: string;
    role: 'clerk' | 'teacher' | 'student' | 'parent';
    join_code: string;
    roll_number?: string;
    child_student_id?: string;
  }): Promise<AuthResponse> {
    const response = await this.request<{ user: User; token: string }>('/auth/signup-join', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(response.token);
    return response;
  }

  // Dashboard
  async getDashboard(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/dashboard');
  }

  // Students
  async getStudents(): Promise<{ students: Student[] }> {
    return this.request<{ students: Student[] }>('/students');
  }

  async getStudentProfile(): Promise<{ student: Student }> {
    return this.request<{ student: Student }>('/students/profile');
  }

  // Classes
  async getClasses(): Promise<{ classes: ClassGroup[] }> {
    return this.request<{ classes: ClassGroup[] }>('/classes');
  }

  // Subjects
  async getSubjects(): Promise<{ subjects: Subject[] }> {
    return this.request<{ subjects: Subject[] }>('/subjects');
  }

  // Attendance
  async getAttendance(params: { student_id?: string; class_group_id?: string; start_date?: string; end_date?: string }): Promise<{ attendance: Attendance[] }> {
    const query = new URLSearchParams();
    if (params.student_id) query.append('student_id', params.student_id);
    if (params.class_group_id) query.append('class_group_id', params.class_group_id);
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    
    return this.request<{ attendance: Attendance[] }>(`/attendance?${query.toString()}`);
  }

  async submitAttendance(attendance: Attendance[]): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/attendance', {
      method: 'POST',
      body: JSON.stringify({ attendance }),
    });
  }

  // Marks
  async getMarks(params: { student_id?: string; subject_id?: string; exam_id?: string }): Promise<{ marks: Mark[] }> {
    const query = new URLSearchParams();
    if (params.student_id) query.append('student_id', params.student_id);
    if (params.subject_id) query.append('subject_id', params.subject_id);
    if (params.exam_id) query.append('exam_id', params.exam_id);
    
    return this.request<{ marks: Mark[] }>(`/marks?${query.toString()}`);
  }

  async submitMarks(marks: Mark[]): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/marks', {
      method: 'POST',
      body: JSON.stringify({ marks }),
    });
  }

  // Fees
  async getFees(params?: { student_id?: string; status?: string }): Promise<{ fees: Fee[] }> {
    if (!BILLING_ENABLED) {
      return { fees: [] } as { fees: Fee[] };
    }

    const query = new URLSearchParams();
    if (params?.student_id) query.append('student_id', params.student_id);
    if (params?.status) query.append('status', params.status);
    
    return this.request<{ fees: Fee[] }>(`/fees${query.toString() ? '?' + query.toString() : ''}`);
  }

  async getPayments(params?: { student_id?: string }): Promise<{ payments: any[] }> {
    if (!BILLING_ENABLED) {
      return { payments: [] };
    }

    const query = new URLSearchParams();
    if (params?.student_id) query.append('student_id', params.student_id);
    
    return this.request<{ payments: any[] }>(`/payments${query.toString() ? '?' + query.toString() : ''}`);
  }

  // Unpaid Fee Analytics
  async getUnpaidFeeAnalytics(params: {
    class_group_id?: string;
    time_scope?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    summary: {
      total_students: number;
      unpaid_count: number;
      partially_paid_count: number;
      paid_count: number;
      total_unpaid_amount: number;
    };
    chart_data: {
      paid: number;
      unpaid: number;
      partially_paid: number;
    };
    students: Array<{
      student_id: string;
      student_name: string;
      roll_number: string;
      class_name: string;
      parent_name: string;
      parent_phone: string;
      parent_address: string;
      pending_months: number | string;
      total_pending: number;
      total_fee: number;
      total_paid: number;
      payment_status: 'paid' | 'unpaid' | 'partially-paid';
      fee_component_breakdown?: Array<{
        fee_type: string;
        fee_name: string;
        total_months_due: number;
        paid_months: number;
        pending_months: number;
        total_fee_amount: number;
        total_paid_amount: number;
        total_pending_amount: number;
      }>;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params.class_group_id) query.append('class_group_id', params.class_group_id);
    if (params.time_scope) query.append('time_scope', params.time_scope);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    
    return this.request(`/clerk-fees/analytics/unpaid?${query.toString()}`);
  }

  // Unpaid Salaries
  async getUnpaidSalaries(params: {
    teacher_id?: string;
    time_scope?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    summary: {
      total_teachers: number;
      total_unpaid_amount: number;
      total_unpaid_months: number;
      time_scope: string;
      start_date: string;
      end_date: string;
    };
    teachers: Array<{
      teacher_id: string;
      teacher_name: string;
      teacher_email: string;
      unpaid_months_count: number;
      total_unpaid_amount: number;
      max_days_unpaid: number;
      oldest_unpaid_month: {
        month: number;
        year: number;
        period_label: string;
        period_start: string;
        days_since_period_start: number;
      } | null;
      latest_unpaid_month: {
        month: number;
        year: number;
        period_label: string;
        period_start: string;
        days_since_period_start: number;
      } | null;
      unpaid_months: Array<{
        month: number;
        year: number;
        period_start: string;
        period_label: string;
        payment_status: string;
        net_salary: number;
        paid_amount: number;
        credit_applied: number;
        effective_paid_amount: number;
        pending_amount: number;
        days_since_period_start: number;
        payment_date: string | null;
      }>;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params.teacher_id) query.append('teacher_id', params.teacher_id);
    if (params.time_scope) query.append('time_scope', params.time_scope);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    
    return this.request(`/salary/unpaid?${query.toString()}`);
  }

  // Health check
  async healthCheck(): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>('/health');
  }
}

export const api = new ApiService();

