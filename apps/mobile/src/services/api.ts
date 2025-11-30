import { AuthResponse, User, Student, ClassGroup, Subject, Attendance, Mark, Fee, DashboardStats } from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.31.10.67:4000';
// Billing disabled in this deployment
const BILLING_ENABLED = false;

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(response.token);
    return response;
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

  // Health check
  async healthCheck(): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>('/health');
  }
}

export const api = new ApiService();

