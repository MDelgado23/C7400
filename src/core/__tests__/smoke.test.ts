/**
 * Smoke test — proves the Jest + jest-expo runner is wired correctly.
 * If this passes, Strict TDD is unblocked for Phase 2.
 */
describe('test runner', () => {
  it('executes and evaluates assertions', () => {
    expect(1 + 1).toBe(2);
  });
});
