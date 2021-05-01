import { isNodeJS } from '../../utils/environment'

export interface HttpPostOptions {
  headers?: Record<string, string>
}

export type HttpPostSignature = (url: string, data: string, options?: HttpPostOptions) => Promise<string>

let httpPost: HttpPostSignature

if (isNodeJS()) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  httpPost = require('./node').httpPost
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  httpPost = require('./fetch').httpPost
}

export { httpPost }
