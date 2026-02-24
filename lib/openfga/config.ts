// File: lib/openfga/config.ts
// Location: frontend/src/lib/openfga/config.ts
// Status: NEW FILE

export interface OpenFGAConfig {
    apiUrl: string
    storeId: string
    authorizationModelId?: string
  }
  
  export const openFGAConfig: OpenFGAConfig = {
    apiUrl: process.env.NEXT_PUBLIC_OPENFGA_API_URL || 'http://localhost:8080',
    storeId: process.env.NEXT_PUBLIC_OPENFGA_STORE_ID || 'default-store',
    authorizationModelId: process.env.NEXT_PUBLIC_OPENFGA_MODEL_ID,
  }
  
  export const OPENFGA_RELATIONS = {
    MEMBER: 'member',
    ADMIN: 'admin',
    MANAGER: 'manager',
    OPERATOR: 'operator',
    VIEWER: 'viewer',
    DEVELOPER: 'developer',
  } as const
  
  export const OPENFGA_OBJECT_TYPES = {
    USER: 'user',
    COMPANY: 'company',
    MODULE: 'module',
    ACTION: 'action',
    PERMISSION: 'permission',
  } as const
  
  // OpenFGA Authorization Model
  export const AUTHORIZATION_MODEL = {
    schema_version: "1.1",
    type_definitions: [
      {
        type: "user",
        relations: {},
        metadata: {
          relations: {}
        }
      },
      {
        type: "company",
        relations: {
          member: {
            this: {}
          },
          admin: {
            this: {}
          },
          manager: {
            this: {}
          },
          operator: {
            this: {}
          },
          viewer: {
            this: {}
          },
          developer: {
            this: {}
          }
        },
        metadata: {
          relations: {
            member: { directly_related_user_types: [{ type: "user" }] },
            admin: { directly_related_user_types: [{ type: "user" }] },
            manager: { directly_related_user_types: [{ type: "user" }] },
            operator: { directly_related_user_types: [{ type: "user" }] },
            viewer: { directly_related_user_types: [{ type: "user" }] },
            developer: { directly_related_user_types: [{ type: "user" }] }
          }
        }
      },
      {
        type: "module",
        relations: {
          can_access: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: "can_view" } },
                { tupleToUserset: { tupleset: { relation: "member" }, computedUserset: { object: "", relation: "can_access" } } }
              ]
            }
          },
          can_view: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: "can_edit" } }
              ]
            }
          },
          can_create: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: "can_edit" } }
              ]
            }
          },
          can_edit: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: "can_delete" } }
              ]
            }
          },
          can_delete: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: "can_approve" } }
              ]
            }
          },
          can_approve: {
            this: {}
          }
        },
        metadata: {
          relations: {
            can_access: { directly_related_user_types: [{ type: "user" }] },
            can_view: { directly_related_user_types: [{ type: "user" }] },
            can_create: { directly_related_user_types: [{ type: "user" }] },
            can_edit: { directly_related_user_types: [{ type: "user" }] },
            can_delete: { directly_related_user_types: [{ type: "user" }] },
            can_approve: { directly_related_user_types: [{ type: "user" }] }
          }
        }
      }
    ]
  }