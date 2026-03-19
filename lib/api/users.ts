import { useAuthStore } from '@/lib/stores/auth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface UserRecord {
  id: string
  email: string
  name: string
  is_developer: boolean
  is_active: boolean
}

export interface CreateUserPayload {
  email: string
  password: string
  name: string
  is_developer: boolean
  is_active: boolean
}

export interface UpdateUserPayload {
  email?: string
  password?: string
  name?: string
  is_developer?: boolean
  is_active?: boolean
}

export interface ModulePermissionData {
  module_code: string
  module_name: string
  permissions: {
    access: boolean
    view: boolean
    create: boolean
    edit: boolean
    delete: boolean
    approve: boolean
  }
}

export interface UserPermissionsResponse {
  user_id: string
  company_code: string
  modules: ModulePermissionData[]
}

export interface CompanyRoleData {
  company_code: string
  company_name: string
  role: string | null
}

export interface ModulePermissionPayload {
  module_code: string
  permissions: {
    access: boolean
    view: boolean
    create: boolean
    edit: boolean
    delete: boolean
    approve: boolean
  }
}

class UserApiService {
  private getAuthHeaders(): HeadersInit {
    const { accessToken } = useAuthStore.getState()
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData?.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail)
        } else if (errorData?.message) {
          errorMessage = errorData.message
        }
      } catch {
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }
    return response.json()
  }

  async getUsers(): Promise<UserRecord[]> {
    const response = await fetch(`${API_BASE}/auth/users`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })
    return this.handleResponse<UserRecord[]>(response)
  }

  async createUser(payload: CreateUserPayload): Promise<UserRecord> {
    const response = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    return this.handleResponse<UserRecord>(response)
  }

  async updateUser(userId: string, payload: UpdateUserPayload): Promise<UserRecord> {
    const response = await fetch(`${API_BASE}/auth/users/${userId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    return this.handleResponse<UserRecord>(response)
  }

  async deleteUser(email: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/auth/users/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    })
    return this.handleResponse<{ message: string }>(response)
  }

  async getPermissions(companyCode: string, userId: string): Promise<UserPermissionsResponse> {
    const response = await fetch(`${API_BASE}/auth/permissions/${companyCode}/${userId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })
    return this.handleResponse<UserPermissionsResponse>(response)
  }

  async updatePermissions(companyCode: string, userId: string, modules: ModulePermissionPayload[]): Promise<void> {
    const response = await fetch(`${API_BASE}/auth/permissions/${companyCode}/${userId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ modules }),
    })
    await this.handleResponse(response)
  }

  async getCompanyRoles(userId: string): Promise<CompanyRoleData[]> {
    const response = await fetch(`${API_BASE}/auth/users/${userId}/companies`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })
    return this.handleResponse<CompanyRoleData[]>(response)
  }

  async updateCompanyRoles(userId: string, companies: { company_code: string; role: string }[]): Promise<void> {
    const response = await fetch(`${API_BASE}/auth/users/${userId}/companies`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ companies }),
    })
    await this.handleResponse(response)
  }
}

export const userApiService = new UserApiService()
