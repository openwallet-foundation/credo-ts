import { endpoint, getAgent } from '../../agent'

export async function GET(): Promise<Response> {
  const agent = await getAgent()
  const { outOfBandInvitation } = await agent.didcomm.oob.createInvitation()
  return new Response(outOfBandInvitation.toUrl({ domain: `${endpoint}/invitation` }))
}
