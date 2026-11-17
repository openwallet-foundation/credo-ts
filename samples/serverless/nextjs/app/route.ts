import type { DidCommMessageReceivedEvent } from '@credo-ts/didcomm'
import { DidCommEventTypes } from '@credo-ts/didcomm'
import { getAgent, log, requestStorage } from '../agent'

let requestCount = 0

// Receives DIDComm messages
export async function POST(request: Request): Promise<Response> {
  // Processing a message runs in the async context it was received in, so its logs show which request it belongs to
  return requestStorage.run({ id: ++requestCount, receivedAt: Date.now() }, async () => {
    const agent = await getAgent()

    // Not awaited: the agent hands the processing to `after`, so it continues once the response has been sent
    void agent.events.emit<DidCommMessageReceivedEvent>(agent.context, {
      type: DidCommEventTypes.DidCommMessageReceived,
      payload: { message: await request.json() },
    })

    log('POST / responded with 202, the message is processed after the response')
    return new Response(null, { status: 202 })
  })
}
