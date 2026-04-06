import { type List, reduce } from "lodash";

/**
 * Map a function over all of the items in an iterable (skipping undefined return values).
 */
export const filterMap = <T, U>(arr: List<T>, mapper: (item: T) => U | undefined): U[] => {
  const result: U[] = [];
  reduce(arr, (acc, item) => {
    const mapped = mapper(item);
    if (mapped !== undefined) {
      acc.push(mapped);
    }
    return acc;
  }, result);
  return result;
};
