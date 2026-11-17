import type { Metadata } from '@cheqd/ts-proto/cheqd/resource/v2'

import { getClosestResourceVersion } from '../src/dids/didCheqdUtil'

const resource = (id: string, created: string) => ({ id, created: new Date(created) }) as unknown as Metadata

describe('getClosestResourceVersion', () => {
  // A revocation status list is valid from the moment it is created until the next one, so a request for a time must
  // never get a version that was created after it
  const resources = [
    resource('v1', '2026-01-01T10:00:00.000Z'),
    resource('v2', '2026-01-01T11:00:00.000Z'),
    resource('v3', '2026-01-01T12:00:00.000Z'),
  ]

  it('returns the latest version created at or before the time', () => {
    expect(getClosestResourceVersion(resources, new Date('2026-01-01T11:30:00.000Z'))?.id).toBe('v2')
    expect(getClosestResourceVersion(resources, new Date('2026-01-01T13:00:00.000Z'))?.id).toBe('v3')
  })

  it('does not return the nearest version when that one is after the time', () => {
    // v2 is only one minute after the time, v1 is 59 minutes before it
    expect(getClosestResourceVersion(resources, new Date('2026-01-01T10:59:00.000Z'))?.id).toBe('v1')
  })

  it('returns the version created exactly at the time', () => {
    expect(getClosestResourceVersion(resources, new Date('2026-01-01T11:00:00.000Z'))?.id).toBe('v2')
  })

  it('ignores the milliseconds of the version, the time passed in is in seconds', () => {
    const withMillis = [resource('v1', '2026-01-01T10:00:00.900Z')]
    expect(getClosestResourceVersion(withMillis, new Date('2026-01-01T10:00:00.000Z'))?.id).toBe('v1')
  })

  it('returns nothing when the time is before the first version', () => {
    expect(getClosestResourceVersion(resources, new Date('2026-01-01T09:59:59.000Z'))).toBeUndefined()
  })
})
