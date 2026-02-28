// File: lib/openfga/client.ts
// Location: frontend/src/lib/openfga/client.ts
// Status: NEW FILE

import { OpenFgaApi, Configuration, TupleKey } from '@openfga/sdk'
import { openFGAConfig, OPENFGA_RELATIONS, OPENFGA_OBJECT_TYPES } from './config'

class OpenFGAService {
  private client: OpenFgaApi
  private storeId: string

  constructor() {
    this.client = new OpenFgaApi(new Configuration({
      apiUrl: openFGAConfig.apiUrl, // Changed from basePath
    }))
    this.storeId = openFGAConfig.storeId
  }

  // Check if user has permission
  async check(userId: string, relation: string, object: string): Promise<boolean> {
    try {
      const request = {
        tuple_key: {
          user: `${OPENFGA_OBJECT_TYPES.USER}:${userId}`,
          relation,
          object
        }
      }

      const response = await this.client.check(
        this.storeId, // Store ID as first parameter
        request       // Request body as second parameter
      )

      return response.allowed || false
    } catch (error) {
      console.error('OpenFGA check error:', error)
      return false
    }
  }

  // Write relationship tuples
  async write(writes: TupleKey[], deletes: TupleKey[] = []): Promise<boolean> {
    try {
      const request = {
        writes: { tuple_keys: writes },
        deletes: { tuple_keys: deletes }
      }

      await this.client.write(
        this.storeId, // Store ID as first parameter
        request       // Request body as second parameter
      )

      return true
    } catch (error) {
      console.error('OpenFGA write error:', error)
      return false
    }
  }

  // Grant company access to user
  async grantCompanyAccess(userId: string, companyCode: string, role: string): Promise<boolean> {
    const tuple: TupleKey = { // Changed from ClientTupleKey to TupleKey
      user: `${OPENFGA_OBJECT_TYPES.USER}:${userId}`,
      relation: role,
      object: `${OPENFGA_OBJECT_TYPES.COMPANY}:${companyCode}`
    }

    return this.write([tuple])
  }

  // Revoke company access from user
  async revokeCompanyAccess(userId: string, companyCode: string, role: string): Promise<boolean> {
    const tuple: TupleKey = { // Changed from ClientTupleKey to TupleKey
      user: `${OPENFGA_OBJECT_TYPES.USER}:${userId}`,
      relation: role,
      object: `${OPENFGA_OBJECT_TYPES.COMPANY}:${companyCode}`
    }

    return this.write([], [tuple])
  }

  // Grant module permission to user
  async grantModulePermission(
    userId: string,
    companyCode: string,
    moduleCode: string,
    action: string
  ): Promise<boolean> {
    const tuple: TupleKey = { // Changed from ClientTupleKey to TupleKey
      user: `${OPENFGA_OBJECT_TYPES.USER}:${userId}`,
      relation: `can_${action}`,
      object: `${OPENFGA_OBJECT_TYPES.MODULE}:${companyCode}:${moduleCode}`
    }

    return this.write([tuple])
  }

  // Revoke module permission from user
  async revokeModulePermission(
    userId: string,
    companyCode: string,
    moduleCode: string,
    action: string
  ): Promise<boolean> {
    const tuple: TupleKey = { // Changed from ClientTupleKey to TupleKey
      user: `${OPENFGA_OBJECT_TYPES.USER}:${userId}`,
      relation: `can_${action}`,
      object: `${OPENFGA_OBJECT_TYPES.MODULE}:${companyCode}:${moduleCode}`
    }

    return this.write([], [tuple])
  }

  // Check company access
  async hasCompanyAccess(userId: string, companyCode: string, role: string): Promise<boolean> {
    return this.check(
      userId,
      role,
      `${OPENFGA_OBJECT_TYPES.COMPANY}:${companyCode}`
    )
  }

  // Check module permission
  async hasModulePermission(
    userId: string,
    companyCode: string,
    moduleCode: string,
    action: string
  ): Promise<boolean> {
    return this.check(
      userId,
      `can_${action}`,
      `${OPENFGA_OBJECT_TYPES.MODULE}:${companyCode}:${moduleCode}`
    )
  }

  // Batch check permissions
  async batchCheck(checks: Array<{
    userId: string,
    relation: string,
    object: string
  }>): Promise<boolean[]> {
    const results = await Promise.all(
      checks.map(check => this.check(check.userId, check.relation, check.object))
    )
    return results
  }

  // Get user's company roles
  async getUserCompanyRoles(userId: string, companyCode: string): Promise<string[]> {
    const roles = Object.values(OPENFGA_RELATIONS)
    const results = await Promise.all(
      roles.map(role => this.hasCompanyAccess(userId, companyCode, role))
    )
    
    return roles.filter((_, index) => results[index])
  }
}

export const openFGAService = new OpenFGAService()
export default openFGAService