import { EmulatorUserConfig } from './UserEmulator'
import { EmulatorWitnessConfig } from './WitnessEmulator'

export interface EmulatorConfig {
  host: string
  port: number
  users: EmulatorUserConfig[]
  witnesses: EmulatorWitnessConfig[]
}

export const config: EmulatorConfig = {
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
    },
    {
      tockTime: 1000 * 5,
    },
    {
      tockTime: 1000 * 5,
    },
  ],
}
