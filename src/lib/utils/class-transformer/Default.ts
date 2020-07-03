import { Transform } from 'class-transformer';

export function Default<T>(defaultValue: T) {
  return Transform((value: T | null | undefined) => (value !== null && value !== undefined ? value : defaultValue));
}
