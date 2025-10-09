import type { MockedClass } from 'vitest'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type MockedClassConstructor<T extends { new (...args: any[]): any }> = MockedClass<
  T & { new (): InstanceType<T> }
>
