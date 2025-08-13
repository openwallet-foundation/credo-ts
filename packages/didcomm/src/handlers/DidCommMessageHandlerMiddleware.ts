import type { InboundDidCommMessageContext } from '../models/InboundDidCommMessageContext'

export type DidCommMessageHandlerMiddleware = (
  inboundMessageContext: InboundDidCommMessageContext,
  next: () => Promise<void>
) => Promise<void>

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class DidCommMessageHandlerMiddlewareRunner {
  public static async run(
    middlewares: DidCommMessageHandlerMiddleware[],
    inboundMessageContext: InboundDidCommMessageContext
  ) {
    const compose = (middlewares: DidCommMessageHandlerMiddleware[]) => {
      return async (inboundMessageContext: InboundDidCommMessageContext) => {
        let index = -1
        async function dispatch(i: number): Promise<void> {
          if (i <= index) throw new Error('next() called multiple times')
          index = i
          const fn = middlewares[i]
          if (!fn) return
          await fn(inboundMessageContext, () => dispatch(i + 1))
        }
        await dispatch(0)
      }
    }

    const composed = compose(middlewares)
    await composed(inboundMessageContext)
  }
}
