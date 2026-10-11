import { describe, it, expect, vi } from 'vitest';
import { createNavigation } from './navigation';

function setup(native: boolean) {
  const hardNavigate = vi.fn();
  const nav = createNavigation({ isNative: () => native, hardNavigate });
  return { hardNavigate, nav };
}

describe('createNavigation', () => {
  it('hard-navigates on web and ignores the registered fn', () => {
    const { nav, hardNavigate } = setup(false);
    const fn = vi.fn();
    nav.register(fn);
    nav.navigate('/login/');
    expect(hardNavigate).toHaveBeenCalledWith('/login/');
    expect(fn).not.toHaveBeenCalled();
  });

  it('uses the registered fn on native with replace option', () => {
    const { nav, hardNavigate } = setup(true);
    const fn = vi.fn();
    nav.register(fn);
    nav.navigate('/login/', { replace: true });
    expect(fn).toHaveBeenCalledWith('/login/', { replace: true });
    expect(hardNavigate).not.toHaveBeenCalled();
  });

  it('defaults options to an empty object', () => {
    const { nav } = setup(true);
    const fn = vi.fn();
    nav.register(fn);
    nav.navigate('/dashboard/');
    expect(fn).toHaveBeenCalledWith('/dashboard/', {});
  });

  it('falls back to hardNavigate on native when nothing is registered', () => {
    const { nav, hardNavigate } = setup(true);
    nav.navigate('/login/');
    expect(hardNavigate).toHaveBeenCalledWith('/login/');
  });

  it('falls back after unregister', () => {
    const { nav, hardNavigate } = setup(true);
    const fn = vi.fn();
    const off = nav.register(fn);
    off();
    nav.navigate('/login/');
    expect(fn).not.toHaveBeenCalled();
    expect(hardNavigate).toHaveBeenCalledWith('/login/');
  });

  it('keeps only the latest registered fn', () => {
    const { nav } = setup(true);
    const first = vi.fn();
    const second = vi.fn();
    nav.register(first);
    nav.register(second);
    nav.navigate('/x/');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it('a stale unregister does not remove a newer registration', () => {
    const { nav } = setup(true);
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = nav.register(first);
    nav.register(second);
    offFirst();
    nav.navigate('/x/');
    expect(second).toHaveBeenCalled();
  });
});
