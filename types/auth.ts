// types/auth.ts
import type { Company } from '@/lib/api'

export type { Company }

export type Module = 
  | "dashboard"
  | "inward"
  | "inventory-ledger"
  | "transfer"
  | "consumption"
  | "reordering"
  | "outward"
  | "reports"
  | "settings"
  | "developer"

export interface User {
  id: string
  email: string
  name: string
  company: Company
  permissions: string[]
  role: string
  isActive: boolean
  lastLogin?: Date
  createdAt: Date
  updatedAt: Date
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  token?: string
  refreshTokenToken?: string
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterData {
  email: string
  password: string
  name: string
  company: Company
  role?: string
}

export interface AuthResponse {
  success: boolean
  user?: User
  token?: string
  refreshTokenToken?: string
  message?: string
  error?: string
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  register: (data: RegisterData) => Promise<void>
  refreshToken: () => Promise<void>
  checkPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
  hasCompanyAccess: (company: Company) => boolean
  updateProfile: (data: Partial<User>) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

export interface Permission {
  id: string
  name: string
  description: string
  category: string
  isSystemPermission: boolean
}

export interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  isSystemRole: boolean
  company?: Company
}

export interface AuthError {
  code: string
  message: string
  field?: string
  details?: any
}

export interface AuthValidationResult {
  isValid: boolean
  errors: AuthError[]
  warnings: AuthError[]
}

export interface PasswordPolicy {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
  maxAge: number // days
  preventReuse: number // number of previous passwords to check
}

export interface SessionInfo {
  id: string
  userId: string
  token: string
  refreshToken: string
  expiresAt: Date
  createdAt: Date
  lastUsed: Date
  ipAddress: string
  userAgent: string
  isActive: boolean
}

export interface AuthConfig {
  tokenExpiry: number // minutes
  refreshTokenExpiry: number // days
  maxSessions: number
  passwordPolicy: PasswordPolicy
  enableTwoFactor: boolean
  enableRememberMe: boolean
  sessionTimeout: number // minutes
}

export interface TwoFactorAuth {
  isEnabled: boolean
  secret?: string
  backupCodes?: string[]
  lastUsed?: Date
}

export interface AuthHookReturn {
  // State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  register: (data: RegisterData) => Promise<void>
  refreshToken: () => Promise<void>
  
  // Permissions
  checkPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
  hasCompanyAccess: (company: Company) => boolean
  
  // Profile
  updateProfile: (data: Partial<User>) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  
  // Two-factor auth
  enableTwoFactor: () => Promise<{ secret: string; qrCode: string }>
  disableTwoFactor: (code: string) => Promise<void>
  verifyTwoFactor: (code: string) => Promise<boolean>
  
  // Sessions
  getSessions: () => Promise<SessionInfo[]>
  revokeSession: (sessionId: string) => Promise<void>
  revokeAllSessions: () => Promise<void>
}

export interface AuthProviderProps {
  children: React.ReactNode
  config?: Partial<AuthConfig>
}

export interface AuthGuardProps {
  children: React.ReactNode
  requiredPermission?: string
  requiredRole?: string
  requiredCompany?: Company
  fallback?: React.ReactNode
  redirectTo?: string
}

export interface PermissionGuardProps {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
  requireAll?: boolean // if multiple permissions
}

export interface RoleGuardProps {
  role: string
  children: React.ReactNode
  fallback?: React.ReactNode
  requireAll?: boolean // if multiple roles
}

export interface CompanyGuardProps {
  company: Company
  children: React.ReactNode
  fallback?: React.ReactNode
}

export interface AuthMiddleware {
  (req: any, res: any, next: any): void
}

export interface AuthService {
  // Authentication
  login: (credentials: LoginCredentials) => Promise<AuthResponse>
  logout: (token: string) => Promise<{ success: boolean }>
  register: (data: RegisterData) => Promise<AuthResponse>
  refreshToken: (refreshToken: string) => Promise<AuthResponse>
  
  // User management
  getUser: (id: string) => Promise<User>
  updateUser: (id: string, data: Partial<User>) => Promise<User>
  deleteUser: (id: string) => Promise<{ success: boolean }>
  changePassword: (id: string, currentPassword: string, newPassword: string) => Promise<{ success: boolean }>
  
  // Permission management
  getPermissions: () => Promise<Permission[]>
  getUserPermissions: (userId: string) => Promise<string[]>
  grantPermission: (userId: string, permission: string) => Promise<{ success: boolean }>
  revokePermission: (userId: string, permission: string) => Promise<{ success: boolean }>
  
  // Role management
  getRoles: () => Promise<Role[]>
  getUserRoles: (userId: string) => Promise<string[]>
  assignRole: (userId: string, role: string) => Promise<{ success: boolean }>
  removeRole: (userId: string, role: string) => Promise<{ success: boolean }>
  
  // Session management
  getSessions: (userId: string) => Promise<SessionInfo[]>
  revokeSession: (sessionId: string) => Promise<{ success: boolean }>
  revokeAllSessions: (userId: string) => Promise<{ success: boolean }>
  
  // Two-factor auth
  enableTwoFactor: (userId: string) => Promise<{ secret: string; qrCode: string }>
  disableTwoFactor: (userId: string, code: string) => Promise<{ success: boolean }>
  verifyTwoFactor: (userId: string, code: string) => Promise<{ success: boolean }>
}

export interface AuthApiClient {
  // Authentication endpoints
  login: (credentials: LoginCredentials) => Promise<AuthResponse>
  logout: () => Promise<{ success: boolean }>
  register: (data: RegisterData) => Promise<AuthResponse>
  refreshToken: () => Promise<AuthResponse>
  
  // User endpoints
  getProfile: () => Promise<User>
  updateProfile: (data: Partial<User>) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean }>
  
  // Permission endpoints
  getPermissions: () => Promise<Permission[]>
  getUserPermissions: () => Promise<string[]>
  
  // Role endpoints
  getRoles: () => Promise<Role[]>
  getUserRoles: () => Promise<string[]>
  
  // Session endpoints
  getSessions: () => Promise<SessionInfo[]>
  revokeSession: (sessionId: string) => Promise<{ success: boolean }>
  revokeAllSessions: () => Promise<{ success: boolean }>
  
  // Two-factor auth endpoints
  enableTwoFactor: () => Promise<{ secret: string; qrCode: string }>
  disableTwoFactor: (code: string) => Promise<{ success: boolean }>
  verifyTwoFactor: (code: string) => Promise<{ success: boolean }>
}

export interface AuthStorage {
  getToken: () => string | null
  setToken: (token: string) => void
  removeToken: () => void
  getRefreshToken: () => string | null
  setRefreshToken: (refreshToken: string) => void
  removeRefreshToken: () => void
  getUser: () => User | null
  setUser: (user: User) => void
  removeUser: () => void
  clear: () => void
}

export interface AuthEvent {
  type: 'LOGIN' | 'LOGOUT' | 'TOKEN_REFRESH' | 'PERMISSION_CHANGE' | 'ROLE_CHANGE'
  user?: User
  timestamp: Date
  data?: any
}

export interface AuthEventListener {
  (event: AuthEvent): void
}

export interface AuthEventEmitter {
  on: (event: string, listener: AuthEventListener) => void
  off: (event: string, listener: AuthEventListener) => void
  emit: (event: string, data: any) => void
}

// Export all types
export type {
  User as UserType,
  AuthState as AuthStateType,
  LoginCredentials as LoginCredentialsType,
  RegisterData as RegisterDataType,
  AuthResponse as AuthResponseType,
  AuthContextType as AuthContextTypeType,
  Permission as PermissionType,
  Role as RoleType,
  AuthError as AuthErrorType,
  AuthValidationResult as AuthValidationResultType,
  PasswordPolicy as PasswordPolicyType,
  SessionInfo as SessionInfoType,
  AuthConfig as AuthConfigType,
  TwoFactorAuth as TwoFactorAuthType,
  AuthHookReturn as AuthHookReturnType,
  AuthProviderProps as AuthProviderPropsType,
  AuthGuardProps as AuthGuardPropsType,
  PermissionGuardProps as PermissionGuardPropsType,
  RoleGuardProps as RoleGuardPropsType,
  CompanyGuardProps as CompanyGuardPropsType,
  AuthMiddleware as AuthMiddlewareType,
  AuthService as AuthServiceType,
  AuthApiClient as AuthApiClientType,
  AuthStorage as AuthStorageType,
  AuthEvent as AuthEventType,
  AuthEventListener as AuthEventListenerType,
  AuthEventEmitter as AuthEventEmitterType
}