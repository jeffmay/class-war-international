import { pluralize } from "./text";

describe('text', () => {
  describe('pluralize', () => {
    test('returns singular form when count is 1', () => {
      expect(pluralize(1, 'turn')).toBe('1 turn');
    });

    test('returns plural form when count is not 1', () => {
      expect(pluralize(0, 'turn')).toBe('0 turns');
      expect(pluralize(2, 'turn')).toBe('2 turns');
    });

    test('uses provided plural form if given', () => {
      expect(pluralize(2, 'child', 'children')).toBe('2 children');
    });
  });
});