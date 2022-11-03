/* eslint-disable @typescript-eslint/no-explicit-any */

// No type definitions available for this package
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import vc from '@digitalcredentials/vc'

export interface VC {
  issue(options: any): Promise<Record<string, unknown>>
  verifyCredential(options: any): Promise<Record<string, unknown>>
  createPresentation(options: any): Promise<Record<string, unknown>>
  signPresentation(options: any): Promise<Record<string, unknown>>
  verify(options: any): Promise<Record<string, unknown>>
}

export default vc as unknown as VC
