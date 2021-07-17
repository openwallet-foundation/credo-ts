export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>

export const isString = (value: unknown): value is string => typeof value === 'string'
export const isNumber = (value: unknown): value is number => typeof value === 'number'
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
