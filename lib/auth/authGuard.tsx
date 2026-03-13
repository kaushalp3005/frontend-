// lib/auth/authGuard.ts
import React from 'react'
import { Company } from '@/lib/api'
import { PermissionError } from '@/lib/utils/errorHandling'

export interface User {
  id: string
  email: string
  name: string
  company: Company
  permissions: string[]
  role: string
  isActive: boolean
  lastLogin?: Date
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  checkPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
  hasCompanyAccess: (company: Company) => boolean
}

// Permission constants
export const PERMISSIONS = {
  // Inward form permissions
  INWARD_CREATE: 'inward:create',
  INWARD_READ: 'inward:read',
  INWARD_UPDATE: 'inward:update',
  INWARD_DELETE: 'inward:delete',
  INWARD_PRINT: 'inward:print',
  
  // Article permissions
  ARTICLE_CREATE: 'article:create',
  ARTICLE_READ: 'article:read',
  ARTICLE_UPDATE: 'article:update',
  ARTICLE_DELETE: 'article:delete',
  
  // Box permissions
  BOX_CREATE: 'box:create',
  BOX_READ: 'box:read',
  BOX_UPDATE: 'box:update',
  BOX_DELETE: 'box:delete',
  BOX_PRINT: 'box:print',
  
  // Vendor/Customer permissions
  VENDOR_READ: 'vendor:read',
  CUSTOMER_READ: 'customer:read',
  
  // System permissions
  SYSTEM_ADMIN: 'system:admin',
  COMPANY_ADMIN: 'company:admin',
  USER_MANAGEMENT: 'user:management'
} as const

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  COMPANY_ADMIN: 'company_admin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
} as const

// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.COMPANY_ADMIN]: [
    PERMISSIONS.INWARD_CREATE,
    PERMISSIONS.INWARD_READ,
    PERMISSIONS.INWARD_UPDATE,
    PERMISSIONS.INWARD_DELETE,
    PERMISSIONS.INWARD_PRINT,
    PERMISSIONS.ARTICLE_CREATE,
    PERMISSIONS.ARTICLE_READ,
    PERMISSIONS.ARTICLE_UPDATE,
    PERMISSIONS.ARTICLE_DELETE,
    PERMISSIONS.BOX_CREATE,
    PERMISSIONS.BOX_READ,
    PERMISSIONS.BOX_UPDATE,
    PERMISSIONS.BOX_DELETE,
    PERMISSIONS.BOX_PRINT,
    PERMISSIONS.VENDOR_READ,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.COMPANY_ADMIN,
    PERMISSIONS.USER_MANAGEMENT
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.INWARD_CREATE,
    PERMISSIONS.INWARD_READ,
    PERMISSIONS.INWARD_UPDATE,
    PERMISSIONS.INWARD_PRINT,
    PERMISSIONS.ARTICLE_CREATE,
    PERMISSIONS.ARTICLE_READ,
    PERMISSIONS.ARTICLE_UPDATE,
    PERMISSIONS.BOX_CREATE,
    PERMISSIONS.BOX_READ,
    PERMISSIONS.BOX_UPDATE,
    PERMISSIONS.BOX_PRINT,
    PERMISSIONS.VENDOR_READ,
    PERMISSIONS.CUSTOMER_READ
  ],
  [ROLES.OPERATOR]: [
    PERMISSIONS.INWARD_CREATE,
    PERMISSIONS.INWARD_READ,
    PERMISSIONS.INWARD_PRINT,
    PERMISSIONS.ARTICLE_READ,
    PERMISSIONS.BOX_CREATE,
    PERMISSIONS.BOX_READ,
    PERMISSIONS.BOX_PRINT,
    PERMISSIONS.VENDOR_READ,
    PERMISSIONS.CUSTOMER_READ
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.INWARD_READ,
    PERMISSIONS.ARTICLE_READ,
    PERMISSIONS.BOX_READ,
    PERMISSIONS.VENDOR_READ,
    PERMISSIONS.CUSTOMER_READ
  ]
}

export class AuthGuard {
  private static instance: AuthGuard
  private authState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  }
  private listeners: Set<(state: AuthState) => void> = new Set()

  private constructor() {
    this.initializeAuth()
  }

  static getInstance(): AuthGuard {
    if (!AuthGuard.instance) {
      AuthGuard.instance = new AuthGuard()
    }
    return AuthGuard.instance
  }

  private async initializeAuth() {
    try {
      // Check for existing session
      const token = this.getStoredToken()
      if (token) {
        await this.validateToken(token)
      }
    } catch (error) {
      console.error('Auth initialization failed:', error)
      this.setAuthState({ user: null, isAuthenticated: false, isLoading: false, error: null })
    }
  }

  getStoredToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('auth_token')
  }

  private setStoredToken(token: string) {
    if (typeof window === 'undefined') return
    localStorage.setItem('auth_token', token)
  }

  private removeStoredToken() {
    if (typeof window === 'undefined') return
    localStorage.removeItem('auth_token')
  }

  private async validateToken(token: string): Promise<void> {
    try {
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Token validation failed')
      }

      const userData = await response.json()
      this.setAuthState({
        user: userData.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      })
    } catch (error) {
      this.removeStoredToken()
      throw error
    }
  }

  private setAuthState(newState: Partial<AuthState>) {
    this.authState = { ...this.authState, ...newState }
    this.notifyListeners()
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.authState))
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getAuthState(): AuthState {
    return { ...this.authState }
  }

  async login(email: string, password: string): Promise<void> {
    this.setAuthState({ isLoading: true, error: null })

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Login failed')
      }

      const { token, user } = await response.json()
      this.setStoredToken(token)
      this.setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      })
    } catch (error) {
      this.setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed'
      })
      throw error
    }
  }

  logout(): void {
    this.removeStoredToken()
    this.setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    })
  }

  async refreshToken(): Promise<void> {
    const token = this.getStoredToken()
    if (!token) {
      throw new Error('No token to refresh')
    }

    try {
      await this.validateToken(token)
    } catch (error) {
      this.logout()
      throw error
    }
  }

  checkPermission(permission: string): boolean {
    if (!this.authState.user) return false
    
    const userPermissions = this.getUserPermissions(this.authState.user)
    return userPermissions.includes(permission)
  }

  hasRole(role: string): boolean {
    if (!this.authState.user) return false
    return this.authState.user.role === role
  }

  hasCompanyAccess(company: Company): boolean {
    if (!this.authState.user) return false
    
    // Super admin has access to all companies
    if (this.hasRole(ROLES.SUPER_ADMIN)) return true
    
    // Check if user belongs to the company
    return this.authState.user.company === company
  }

  private getUserPermissions(user: User): string[] {
    const rolePermissions = ROLE_PERMISSIONS[user.role] || []
    const explicitPermissions = user.permissions || []
    
    // Combine role-based and explicit permissions
    return [...new Set([...rolePermissions, ...explicitPermissions])]
  }

  requirePermission(permission: string): void {
    if (!this.checkPermission(permission)) {
      throw new PermissionError(
        `Permission '${permission}' is required`,
        permission,
        { user: this.authState.user }
      )
    }
  }

  requireRole(role: string): void {
    if (!this.hasRole(role)) {
      throw new PermissionError(
        `Role '${role}' is required`,
        role,
        { user: this.authState.user }
      )
    }
  }

  requireCompanyAccess(company: Company): void {
    if (!this.hasCompanyAccess(company)) {
      throw new PermissionError(
        `Access to company '${company}' is required`,
        company,
        { user: this.authState.user }
      )
    }
  }
}

// Hook for using auth guard
export function useAuthGuard(): AuthContextType {
  const [authState, setAuthState] = React.useState<AuthState>(AuthGuard.getInstance().getAuthState())

  React.useEffect(() => {
    const unsubscribe = AuthGuard.getInstance().subscribe(setAuthState)
    return unsubscribe
  }, [])

  const authGuard = AuthGuard.getInstance()

  return {
    ...authState,
    login: authGuard.login.bind(authGuard),
    logout: authGuard.logout.bind(authGuard),
    refreshToken: authGuard.refreshToken.bind(authGuard),
    checkPermission: authGuard.checkPermission.bind(authGuard),
    hasRole: authGuard.hasRole.bind(authGuard),
    hasCompanyAccess: authGuard.hasCompanyAccess.bind(authGuard)
  }
}

// Higher-order component for permission checking
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: string,
  fallback?: React.ComponentType<P>
) {
  return function PermissionWrappedComponent(props: P) {
    const { checkPermission, isAuthenticated } = useAuthGuard()

    if (!isAuthenticated) {
      return <div>Please log in to access this feature.</div>
    }

    if (!checkPermission(permission)) {
      if (fallback) {
        return React.createElement(fallback, props)
      }
      return (
        <div className="p-4 text-center">
          <h3 className="text-lg font-semibold text-red-600">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to access this feature.</p>
        </div>
      )
    }

    return React.createElement(Component, props)
  }
}

// Component for conditional rendering based on permissions
export function PermissionGuard({ 
  permission, 
  children, 
  fallback 
}: { 
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { checkPermission, isAuthenticated } = useAuthGuard()

  if (!isAuthenticated) {
    return <>{fallback || <div>Please log in to access this feature.</div>}</>
  }

  if (!checkPermission(permission)) {
    return <>{fallback || <div>You don't have permission to access this feature.</div>}</>
  }

  return <>{children}</>
}

// Utility for API calls with auth headers
export function createAuthenticatedFetch() {
  const authGuard = AuthGuard.getInstance()
  
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = authGuard.getStoredToken()
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    // Handle token expiration
    if (response.status === 401) {
      console.warn('[AUTH] Token expired or unauthorized (401), logging out and redirecting to login')
      authGuard.logout()
      
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login?session_expired=true'
      }
      
      throw new Error('Session expired. Please log in again.')
    }

    return response
  }
}

// Export the singleton instance
export const authGuard = AuthGuard.getInstance()
