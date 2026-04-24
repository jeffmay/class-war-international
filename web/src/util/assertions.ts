

export class AssertionError extends Error {
  public constructor(public expectation: string) {
    super(`AssertionError: ${expectation}`)
  }
}

export function assertDefined<V>(val: V | null | undefined, name?: string): asserts val is V {
  if (val == null) {
    throw new AssertionError(`expected ${name ?? 'val'} to be defined, not ${val}!`)
  }
}

export function assertFieldValue<O extends object, F extends keyof O, V extends O[F]>(obj: O, field: F, expectedValue: V, name?: string): asserts obj is O & { [K in F]: V } {
  if (obj[field] !== expectedValue) {
    throw new AssertionError(`expected ${name ?? 'val'} to be ${expectedValue}, not ${obj[field]}!`)
  }
}

export function assertEqual<A, B extends A>(val: A, expected: B, name?: string): asserts val is B {
  if (val !== expected) {
    throw new AssertionError(`expected ${name ?? 'val'} to be ${expected}, not ${val}!`)
  }
}

export function assertNotEqual<A, B extends A>(val: A, notExpected: B, name?: string): asserts val is Exclude<A, B> {
  if (val === notExpected) {
    throw new AssertionError(`expected ${name ?? 'val'} to not be ${notExpected}!`)
  }
}
