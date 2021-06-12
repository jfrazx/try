export const isFunction = (value: unknown): value is Function =>
  is(value, 'function');

export const isSymbol = (value: unknown): value is symbol => is(value, 'symbol');

const is = (value: unknown, type: string) => typeof value === type;
