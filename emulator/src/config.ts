import type { EmulatorUserConfig } from './UserEmulator'
import type { EmulatorWitnessConfig } from './WitnessEmulator'

export interface EmulatorConfig {
  host: string
  port: number
  users: EmulatorUserConfig[]
  witnesses: EmulatorWitnessConfig[]
}

export const createConfig: () => Promise<EmulatorConfig> = async () => {
  return {
    host: 'http://localhost',
    port: 8080,
    users: [
      {
        interval: 1000 * 6,
        witnessIndex: 0,
      },
      {
        interval: 1000 * 7,
        witnessIndex: 0,
      },
    ],
    witnesses: [
      {
        tockTime: 1000 * 5,
        label: 'witness-1',
      },
      {
        tockTime: 1000 * 5,
        label: 'witness-2',
      },
      {
        tockTime: 1000 * 5,
        label: 'witness-3',
      },
    ],
  }
}
