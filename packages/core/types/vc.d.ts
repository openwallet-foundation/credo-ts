declare module '@digitalcredentials/vc' {
  export const issue: (options: any) => Promise<Record<string, unknown>>
}
