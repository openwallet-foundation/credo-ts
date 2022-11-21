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
        interval: 6_000,
        witnessIndex: 0,
      },
      // {
      //   interval: 7_000,
      //   witnessIndex: 0,
      // },
    ],
    witnesses: [
      {
        tockTime: 5_000,
        label: 'witness-1',
      },
      {
        tockTime: 5_000,
        label: 'witness-2',
      },
      // {
      //   tockTime: 1000 * 5,
      //   label: 'witness-3',
      // },
    ],
  }
}
