import { describe, expect, it, vi } from 'vitest';

// `echarts`'s ESM namespace export isn't configurable, so `vi.spyOn` can't
// patch `registerTheme` directly - mock the whole module instead.
const { registerThemeMock } = vi.hoisted(() => ({ registerThemeMock: vi.fn() }));

vi.mock('echarts', () => ({
  registerTheme: registerThemeMock,
}));

describe('ensureTheme', () => {
  it('registers the theme only once across repeated calls', async () => {
    const { ensureTheme } = await import('./chart');

    ensureTheme();
    ensureTheme();
    ensureTheme();

    expect(registerThemeMock).toHaveBeenCalledTimes(1);
  });
});
