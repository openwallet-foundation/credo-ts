declare module '@digitalcredentials/vc' {
  export const issue: (options: any) => Promise<Record<string, unknown>>
  export const verifyCredential: (options: any) => Promise<Record<string, unknown>>
  export const createPresentation: (options: any) => Promise<Record<string, unknown>>
  export const signPresentation: (options: any) => Promise<Record<string, unknown>>
  export const verify: (options: any) => Promise<Record<string, unknown>>
}
