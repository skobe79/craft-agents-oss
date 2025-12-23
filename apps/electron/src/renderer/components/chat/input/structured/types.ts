import type { PermissionRequest } from '../../../../../shared/types'

/**
 * Input mode determines which component is rendered in InputContainer
 */
export type InputMode = 'freeform' | 'structured'

/**
 * Types of structured input UIs
 */
export type StructuredInputType = 'permission'

/**
 * Union type for structured input data
 */
export type StructuredInputData = { type: 'permission'; data: PermissionRequest }

/**
 * State for structured input
 */
export interface StructuredInputState {
  type: StructuredInputType
  data: PermissionRequest
}

/**
 * Response from permission request
 */
export interface PermissionResponse {
  type: 'permission'
  allowed: boolean
  alwaysAllow: boolean
}

/**
 * Union type for all structured responses
 */
export type StructuredResponse = PermissionResponse
