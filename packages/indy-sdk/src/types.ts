import type { default as _IndySdk } from 'indy-sdk'

type IndySdk = typeof _IndySdk

export const IndySdkSymbol = Symbol('IndySdk')
export type { IndySdk }
