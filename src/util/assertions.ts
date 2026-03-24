
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
