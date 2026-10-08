import { describe, expect, it, vi } from 'vitest';
import { createWakeLockController } from './wake-lock';

type Listener = () => void;

function fakeSentinel() {
  const listeners: Listener[] = [];
  return {
    addEventListener: vi.fn((_type: string, cb: Listener) => {
      listeners.push(cb);
    }),
    release: vi.fn(async () => {}),
    fireRelease: () => listeners.forEach((cb) => cb()),
  };
}

function setup(opts: { supported?: boolean; visible?: boolean } = {}) {
  const { supported = true, visible = true } = opts;
  const state = { visible };
  const sentinels: ReturnType<typeof fakeSentinel>[] = [];
  const request = vi.fn(async () => {
    const s = fakeSentinel();
    sentinels.push(s);
    return s;
  });
  const onChange = vi.fn();
  const controller = createWakeLockController({
    navigator: supported ? { wakeLock: { request } } : {},
    isVisible: () => state.visible,
    onChange,
  });
  return { controller, request, sentinels, state, onChange };
}

describe('createWakeLockController', () => {
  it('is unsupported without navigator.wakeLock and never requests', async () => {
    const { controller, request } = setup({ supported: false });
    expect(controller.supported).toBe(false);
    await controller.start();
    expect(request).not.toHaveBeenCalled();
    expect(controller.isActive()).toBe(false);
  });

  it('requests a screen lock once and does not double-request while held', async () => {
    const { controller, request, onChange } = setup();
    await controller.start();
    await controller.start();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');
    expect(controller.isActive()).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not request while hidden, then requests when visible again', async () => {
    const { controller, request, state } = setup({ visible: false });
    await controller.start();
    expect(request).not.toHaveBeenCalled();
    state.visible = true;
    await controller.handleVisibilityChange();
    expect(request).toHaveBeenCalledTimes(1);
    expect(controller.isActive()).toBe(true);
  });

  it('goes inactive on release and re-acquires a new sentinel when visible', async () => {
    const { controller, request, sentinels, onChange } = setup();
    await controller.start();
    sentinels[0].fireRelease();
    expect(controller.isActive()).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(false);
    await controller.handleVisibilityChange();
    expect(request).toHaveBeenCalledTimes(2);
    expect(sentinels[1]).not.toBe(sentinels[0]);
    expect(controller.isActive()).toBe(true);
  });

  it('swallows a rejected request and stays inactive', async () => {
    const request = vi.fn(async () => {
      throw new Error('NotAllowedError');
    });
    const controller = createWakeLockController({
      navigator: { wakeLock: { request } },
      isVisible: () => true,
    });
    await expect(controller.start()).resolves.toBeUndefined();
    expect(controller.isActive()).toBe(false);
  });

  it('stop releases the held sentinel and goes inactive', async () => {
    const { controller, sentinels } = setup();
    await controller.start();
    await controller.stop();
    expect(sentinels[0].release).toHaveBeenCalled();
    expect(controller.isActive()).toBe(false);
  });

  it('releases a sentinel that resolves after stop and stays inactive', async () => {
    let resolveRequest: (s: ReturnType<typeof fakeSentinel>) => void = () => {};
    const late = fakeSentinel();
    const request = vi.fn(
      () =>
        new Promise<ReturnType<typeof fakeSentinel>>((resolve) => {
          resolveRequest = resolve;
        })
    );
    const controller = createWakeLockController({
      navigator: { wakeLock: { request } },
      isVisible: () => true,
    });
    const starting = controller.start();
    await controller.stop();
    resolveRequest(late);
    await starting;
    expect(late.release).toHaveBeenCalled();
    expect(controller.isActive()).toBe(false);
  });

  it('ignores visibility changes after stop', async () => {
    const { controller, request } = setup();
    await controller.start();
    await controller.stop();
    await controller.handleVisibilityChange();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
