import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Company = "CDPL" | "CFPL" | "JTC" | "HOH"
export type Role = "admin" | "ops" | "approver" | "viewer" | "developer"
export type Module = "dashboard" | "inward" | "inventory-ledger" | "transfer" | "consumption" | "reordering" | "outward" | "reports" | "settings" | "developer"
export type Action = "access" | "view" | "create" | "edit" | "delete" | "approve"

export interface User {
  id: string
  email: string
  name: string
  isDeveloper: boolean
  companies: Array<{
    code: Company
    role: Role
    name: string
    modules: ModulePermission[]
  }>
}

export interface ModulePermission {
  moduleCode: Module
  moduleName: string
  permissions: {
    access: boolean
    view: boolean
    create: boolean
    edit: boolean
    delete: boolean
    approve: boolean
  }
}

export interface CompanyAccess {
  code: Company
  name: string
  role: Role
  modules: ModulePermission[]
}

interface AuthState {
  user: User | null
  currentCompany: Company | null
  currentCompanyAccess: CompanyAccess | null
  isAuthenticated: boolean
  isLoading: boolean
  accessToken: string | null
  
  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  setCurrentCompany: (company: Company) => Promise<void>
  refreshPermissions: () => Promise<void>
  hasPermission: (module: Module, action: Action) => boolean
  hasCompanyAccess: (company: Company) => boolean
  isDeveloperUser: () => boolean
  
  // Static company list for dropdown
  getAvailableCompanies: () => Array<{code: Company, name: string}>
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Static company list for dropdown
const STATIC_COMPANIES: Array<{code: Company, name: string}> = [
  { code: "CFPL", name: "CFPL Operations" },
  { code: "CDPL", name: "Candor Dates Pvt Ltd" }
]

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      currentCompany: null,
      currentCompanyAccess: null,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,

      login: async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        set({ isLoading: true })
        
        try {
          console.log('[AUTH] Attempting login for:', email)
          
          const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          })

          if (!response.ok) {
            let errorMessage = 'Login failed. Please try again.'
            
            try {
              const errorData = await response.json()
              console.error('[AUTH] Login failed:', response.status, errorData)
              
              // Handle specific error cases
              if (response.status === 401) {
                errorMessage = 'Invalid email or password. Please check your credentials and try again.'
              } else if (response.status === 403) {
                errorMessage = errorData.detail || 'No company access. Please contact your administrator.'
              } else if (response.status === 429) {
                errorMessage = 'Too many login attempts. Please try again later.'
              } else if (response.status >= 500) {
                errorMessage = 'Server error. Please try again later.'
              } else if (errorData.detail) {
                errorMessage = typeof errorData.detail === 'string' 
                  ? errorData.detail 
                  : 'Login failed. Please try again.'
              } else if (errorData.message) {
                errorMessage = errorData.message
              }
            } catch (parseError) {
              console.error('[AUTH] Failed to parse error response:', parseError)
            }
            
            set({ 
              user: null,
              currentCompany: null,
              currentCompanyAccess: null,
              isAuthenticated: false,
              accessToken: null,
              isLoading: false 
            })
            
            return { success: false, error: errorMessage }
          }

          const userData = await response.json()
          console.log('[AUTH] Login response received:', userData)
          
          // Validate that we have the expected user data structure
          if (!userData.id || !userData.email) {
            console.error('[AUTH] Invalid user data structure:', userData)
            set({ isLoading: false })
            return { success: false, error: 'Invalid response from server. Please try again.' }
          }
          
          const user: User = {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            isDeveloper: userData.is_developer || false,
            companies: userData.companies ? userData.companies.map((comp: any) => ({
              code: comp.code as Company,
              role: comp.role as Role,
              name: comp.name,
              modules: (comp.modules || []).map((m: any) => ({
                moduleCode: (m.module_code || '').toLowerCase() as Module,
                moduleName: m.module_name || '',
                permissions: m.permissions || { access: false, view: false, create: false, edit: false, delete: false, approve: false },
              })),
            })) : []
          }

          console.log('[AUTH] Processed user data:', {
            id: user.id,
            email: user.email,
            name: user.name,
            isDeveloper: user.isDeveloper,
            companiesCount: user.companies.length,
            companies: user.companies
          })

          set({ 
            user, 
            isAuthenticated: true,
            accessToken: userData.access_token
          })

          // Set default company — prefer CFPL, fall back to user's first company
          const defaultCompany: Company = (
            user.companies.find(c => c.code === "CFPL") || user.companies[0]
          )?.code as Company

          if (defaultCompany) {
            console.log('[AUTH] Setting default company to:', defaultCompany)
            try {
              await get().setCurrentCompany(defaultCompany)
            } catch (error) {
              console.warn('[AUTH] Could not access default company, user will need to select manually')
            }
          } else {
            console.warn('[AUTH] User has no companies')
          }
          
          console.log('[AUTH] Login completed successfully')
          set({ isLoading: false })
          return { success: true }
          
        } catch (error) {
          console.error('[AUTH] Login error:', error)
          set({ 
            user: null,
            currentCompany: null,
            currentCompanyAccess: null,
            isAuthenticated: false,
            accessToken: null,
            isLoading: false 
          })
          
          // Handle network errors
          if (error instanceof TypeError && error.message.includes('fetch')) {
            return { success: false, error: 'Network error. Please check your connection and try again.' }
          }
          
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.' 
          }
        }
      },

      logout: () => {
        const { accessToken } = get()
        
        // Call logout endpoint if we have a token
        if (accessToken && !accessToken.startsWith('dev-token-')) {
          fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }).catch(console.error)
        }

        // Clear state
        set({
          user: null,
          currentCompany: null,
          currentCompanyAccess: null,
          isAuthenticated: false,
          accessToken: null,
          isLoading: false
        })
        
        // Clear persisted storage
        localStorage.removeItem('auth-storage')
        sessionStorage.clear()
      },

      setCurrentCompany: async (company: Company) => {
        console.log('[AUTH] Setting current company to:', company)

        const { user } = get()

        if (!user) {
          throw new Error('Not authenticated')
        }

        const companyData = user.companies.find(c => c.code === company)
        if (!companyData) {
          throw new Error(`No access to company ${company}`)
        }

        const modules = companyData.modules || []

        set({
          currentCompany: company,
          currentCompanyAccess: {
            code: companyData.code,
            name: companyData.name,
            role: companyData.role,
            modules,
          },
          isLoading: false,
        })

        console.log('[AUTH] Company access set from login permissions for:', company, `(${modules.length} modules)`)
      },

      refreshPermissions: async () => {
        const { currentCompany } = get()
        if (currentCompany) {
          console.log('[AUTH] Refreshing permissions for:', currentCompany)
          await get().setCurrentCompany(currentCompany)
        }
      },

      hasPermission: (module: Module, action: Action): boolean => {
        const { user, currentCompanyAccess } = get()

        if (!user || !currentCompanyAccess) {
          return false
        }

        // All modules except settings are open to everyone with a company role
        if (module !== 'settings') {
          return true
        }

        // Settings: only developers and admins
        if (user.isDeveloper) return true
        if (currentCompanyAccess.role === 'developer' || currentCompanyAccess.role === 'admin') {
          return true
        }

        return false
      },

      hasCompanyAccess: (company: Company): boolean => {
        const { user } = get()
        if (!user) return false

        // Developers have access to all companies
        if (user.isDeveloper) return true

        if (!user.companies) return false
        return user.companies.some(c => c.code === company)
      },

      isDeveloperUser: (): boolean => {
        const { user } = get()
        return user?.isDeveloper || false
      },

      // Return user's actual companies, fall back to static list
      getAvailableCompanies: () => {
        const { user } = get()
        if (user?.companies && user.companies.length > 0) {
          return user.companies.map(c => ({ code: c.code, name: c.name }))
        }
        return STATIC_COMPANIES
      }
    }),
    {
      name: 'auth-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Old format didn't include modules in companies — force re-login
          return {
            user: null,
            currentCompany: null,
            currentCompanyAccess: null,
            isAuthenticated: false,
            accessToken: null,
          }
        }
        return persistedState as any
      },
      partialize: (state) => ({
        user: state.user,
        currentCompany: state.currentCompany,
        currentCompanyAccess: state.currentCompanyAccess,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken
      })
    }
  )
)
