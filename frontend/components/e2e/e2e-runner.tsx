'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { flushTokenWrites, getAccessToken, whenTokenStorageReady } from '@/lib/api/token-storage';
import { useAuthStore } from '@/lib/stores/auth-store';
import { loadPlugin } from '@/lib/platform/native';
import { scanNative, type DeviceLike, type NativeScannerLike } from '@/lib/scan/scan-adapter';
import { haptic } from '@/lib/native/native-haptics';
import { getNativeReminderScheduler } from '@/lib/reminders/native-scheduler';
import { isReminderId } from '@/lib/reminders/plan';
import { E2E_PHASE_KEY, findTokenLeaks, formatE2eLine, nextPhase } from '@/lib/e2e/self-check';

interface StepResult {
  readonly step: string;
  readonly ok: boolean;
}

const INJECTED_RAW = ' 4800016644801 ';
const INJECTED_CODE = '4800016644801';
const DASHBOARD_DELAY_MS = 1500;

function storageEntries(): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key) out.push([key, window.localStorage.getItem(key) ?? '']);
  }
  return out;
}

function localDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function E2eRunner() {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState('starting');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const results: StepResult[] = [];

    const emit = (step: string, ok: boolean, data: Record<string, unknown> = {}) => {
      results.push({ step, ok });
      console.log(formatE2eLine(step, { ok, ...data }));
      setStatus(`${step} ${ok ? 'PASS' : 'FAIL'}`);
    };

    const runLogin = async () => {
      emit('render', window.location.protocol === 'capacitor:', {
        origin: window.location.origin,
      });
      try {
        const res = await authApi.login({
          email: process.env.NEXT_PUBLIC_E2E_EMAIL ?? '',
          password: process.env.NEXT_PUBLIC_E2E_PASSWORD ?? '',
        });
        useAuthStore.getState().setAuth(res.token, res.user, res.refreshToken);
        await flushTokenWrites();
        const secrets = [res.token, res.refreshToken ?? ''];
        const leaks = secrets.flatMap((s) => findTokenLeaks(storageEntries(), s));
        emit('login', leaks.length === 0 && getAccessToken() === res.token, {
          leaks: leaks.length,
        });
      } catch (error) {
        console.error('E2E login failed:', error instanceof Error ? error.message : 'unknown');
        emit('login', false, { leaks: -1 });
      }
      window.localStorage.setItem(E2E_PHASE_KEY, nextPhase('login'));
      await sleep(DASHBOARD_DELAY_MS);
      router.replace('/dashboard/');
    };

    const runRelaunch = async () => {
      await whenTokenStorageReady();
      const access = getAccessToken() ?? '';
      const leaks = findTokenLeaks(storageEntries(), access).length;
      emit('relaunch', Boolean(access) && useAuthStore.getState().isAuthenticated && leaks === 0, {
        leaks,
      });
    };

    const runScan = async () => {
      const [scannerMod, deviceMod] = await Promise.all([
        loadPlugin(() => import('@capacitor/barcode-scanner')),
        loadPlugin(() => import('@capacitor/device')),
      ]);
      const device = (deviceMod?.Device as unknown as DeviceLike) ?? null;
      const real = await scanNative({
        scanner: (scannerMod?.CapacitorBarcodeScanner as unknown as NativeScannerLike) ?? null,
        device,
        options: {},
      });
      const virtualRoutesToManual = real.kind === 'failure' && real.failure === 'unavailable';
      const fakeScanner: NativeScannerLike = {
        scanBarcode: async () => ({ ScanResult: INJECTED_RAW }),
      };
      const injected = await scanNative({
        scanner: fakeScanner,
        device: { getInfo: async () => ({ isVirtual: false }) },
        options: {},
      });
      const injectedOk = injected.kind === 'code' && injected.code === INJECTED_CODE;
      emit('scan', virtualRoutesToManual && injectedOk, {
        virtualRoutesToManual,
        injected: injectedOk,
      });
    };

    const runHaptics = () => {
      try {
        haptic('success');
        emit('haptics', true);
      } catch {
        emit('haptics', false);
      }
    };

    const runNotifications = async () => {
      const scheduler = await getNativeReminderScheduler();
      const mod = await loadPlugin(() => import('@capacitor/local-notifications'));
      if (!scheduler || !mod) {
        emit('notifications', false, { permission: 'unavailable', status: 'error', pending: 0 });
        return;
      }
      let permission = await scheduler.checkPermission();
      if (permission === 'prompt' || permission === 'prompt-with-rationale') {
        await scheduler.requestOptIn();
        permission = await scheduler.checkPermission();
      }
      const sync = await scheduler.sync([{ name: 'E2E Milk', expiryDate: localDatePlusDays(3) }], {
        enabled: true,
        offsets: [1],
        time: '09:00',
      });
      const pending = (await mod.LocalNotifications.getPending()).notifications.filter((n) =>
        isReminderId(n.id)
      ).length;
      const ok =
        sync.status === 'scheduled' ? pending >= 1 : sync.status === 'not-granted' && pending === 0;
      emit('notifications', ok, { permission, status: sync.status, pending });
      await scheduler.clear();
    };

    const runPostLogin = async () => {
      await runRelaunch();
      await runScan();
      runHaptics();
      await runNotifications();
      emit(
        'done',
        results.every((r) => r.ok)
      );
      window.localStorage.setItem(E2E_PHASE_KEY, nextPhase('relaunch'));
      router.replace('/pantry/');
    };

    const run = async () => {
      await whenTokenStorageReady();
      // Stored value is the phase to run on this launch (null means first launch).
      const stored = window.localStorage.getItem(E2E_PHASE_KEY);
      const phase = stored === 'relaunch' || stored === 'done' ? stored : 'login';
      if (phase === 'login') await runLogin();
      else if (phase === 'relaunch') await runPostLogin();
      else {
        setStatus('done');
        router.replace('/pantry/');
      }
    };

    void run().catch((error) => {
      console.error('E2E runner crashed:', error instanceof Error ? error.message : 'unknown');
      emit('done', false);
    });
  }, [router]);

  return (
    <main className="flex h-dvh items-center justify-center bg-white p-6">
      <p data-testid="e2e-status" className="text-3xl font-bold">
        {status}
      </p>
    </main>
  );
}
