import type { InboundMessageContext } from '../models/InboundMessageContext'

export type MessageHandlerMiddleware = (
  inboundMessageContext: InboundMessageContext,
  next: () => Promise<void>
) => Promise<void>

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class MessageHandlerMiddlewareRunner {
  public static async run(middlewares: MessageHandlerMiddleware[], inboundMessageContext: InboundMessageContext) {
    const compose = (middlewares: MessageHandlerMiddleware[]) => {
      return async (inboundMessageContext: InboundMessageContext) => {
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
