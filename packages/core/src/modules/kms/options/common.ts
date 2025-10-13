import { z } from 'zod'

export const zKmsKeyId = z.string().describe('A reference to a key in the KMS')
