'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { apiClient } from '@/lib/api/client';
import { mealPlanApi } from '@/lib/api/mealplans';
import { pantryApi } from '@/lib/api/pantry';
import { recipeApi } from '@/lib/api/recipes';
import { shoppingApi } from '@/lib/api/shopping';
import { flushTokenWrites, whenTokenStorageReady } from '@/lib/api/token-storage';
import { API_ROUTES } from '@/lib/constants/api-routes';
import { queryClient } from '@/lib/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatE2eLine } from '@/lib/e2e/self-check';
import {
  OFFLINE_PHASE_KEY,
  currentOfflinePhase,
  nextOfflinePhase,
} from '@/lib/e2e/offline-phases';
import { setForcedOffline } from '@/lib/offline/connectivity/forced-offline';
import {
  MEAL_PLANS_ALL_KEY,
  PANTRY_ALL_KEY,
  RECIPES_ALL_KEY,
  SHOPPING_ACTIVE_KEY,
} from '@/lib/offline/cache/cache-keys';
import { newId } from '@/lib/offline/ids';
import { buildPantryCreate, buildPantryQuickPatchOps } from '@/lib/offline/ops/pantry-ops';
import { buildShoppingUpdate } from '@/lib/offline/ops/shopping-ops';
import { whenOfflineRuntime, type OfflineRuntime } from '@/lib/offline/runtime';
import { createTransport } from '@/lib/offline/transport';
import type { PantryItem } from '@/types/pantry.types';
import type { ShoppingItem, ShoppingList } from '@/types/shopping.types';

/** Non-secret scenario state carried across the kill (E2E builds only). */
const STATE_KEY = 'kitcha:e2e-offline-state';
const DRAIN_TIMEOUT_MS = 60000;
const POLL_MS = 50;
const POLL_LIMIT_MS = 20000;
const ADJUST_TOTAL = 5;

interface ScenarioState {
  pantryId: string;
  createdId: string;
  shoppingId: string;
  adjustKey: string;
  queuedBefore: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function sizeOf(key: readonly unknown[]): number {
  const data = queryClient.getQueryData<unknown>(key);
  if (Array.isArray(data)) return data.length;
  const items = (data as { items?: unknown[] } | undefined)?.items;
  return Array.isArray(items) ? items.length : 0;
}

function canonicalSizes() {
  return {
    pantry: sizeOf(PANTRY_ALL_KEY),
    recipes: sizeOf(RECIPES_ALL_KEY),
    mealPlans: sizeOf(MEAL_PLANS_ALL_KEY),
    shopping: sizeOf(SHOPPING_ACTIVE_KEY),
  };
}

const allNonEmpty = (s: Record<string, number>): boolean => Object.values(s).every((n) => n > 0);

function loadRuntime(): Promise<OfflineRuntime> {
  return new Promise((resolve) => {
    whenOfflineRuntime(resolve);
  });
}

async function waitFor(cond: () => boolean | Promise<boolean>, limitMs = POLL_LIMIT_MS): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < limitMs) {
    if (await cond()) return true;
    await sleep(POLL_MS);
  }
  return false;
}

function readState(): ScenarioState | null {
  try {
    return JSON.parse(window.localStorage.getItem(STATE_KEY) ?? 'null') as ScenarioState | null;
  } catch {
    return null;
  }
}

async function fetchPantry(id: string): Promise<PantryItem | undefined> {
  const res = await pantryApi.getAll({ limit: 100 });
  return res.items.find((i) => i.id === id);
}

export function OfflineE2eRunner() {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState('starting');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const emit = (step: string, ok: boolean, data: Record<string, unknown> = {}) => {
      console.log(formatE2eLine(step, { ok, ...data }));
      setStatus(`${step} ${ok ? 'PASS' : 'FAIL'}`);
    };
    let stage = 'start';
    const userId = (): string => useAuthStore.getState().user?.id ?? '';

    const runSeed = async () => {
      stage = 'login';
      const res = await authApi.login({
        email: process.env.NEXT_PUBLIC_E2E_EMAIL ?? '',
        password: process.env.NEXT_PUBLIC_E2E_PASSWORD ?? '',
      });
      useAuthStore.getState().setAuth(res.token, res.user, res.refreshToken);
      await flushTokenWrites();
      stage = 'runtime';
      const runtime = await loadRuntime();
      stage = 'create-data';
      const tag = newId().slice(0, 8);
      const recipe = await recipeApi.create({
        name: `E2E Recipe ${tag}`,
        category: 'dinner',
        difficulty: 'easy',
        prepTimeMinutes: 5,
        cookTimeMinutes: 10,
        servings: 2,
        ingredients: [{ ingredientName: 'E2E Rice', quantity: 1, unit: 'cups' }],
        instructions: ['Cook it'],
      });
      await mealPlanApi.create({
        name: `E2E Plan ${tag}`,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 6 * 86400000).toISOString(),
        meals: [{ recipeId: recipe.id, dayOfWeek: 0, mealType: 'dinner', servings: 2 }],
      });
      const pantry = await pantryApi.create({
        ingredientName: `E2E Pantry ${tag}`,
        category: 'other',
        quantity: 1,
        unit: 'items',
      });
      const shopping = await shoppingApi.addItem({ itemName: `E2E Shop ${tag}`, quantity: 1, unit: 'items' });
      stage = 'refresh';
      const refreshed = await runtime.refreshFromServer('e2e');
      // Server-confirmed data must be on disk before going offline (the persister debounces writes).
      await runtime.persister.flush();
      const sizes = canonicalSizes();
      emit('seed', refreshed === 'ok' && allNonEmpty(sizes), { ...sizes, refreshed });

      // Offline writes: forced-offline stands in for airplane mode (simctl has no switch).
      stage = 'enqueue';
      setForcedOffline(true);
      const offline = await waitFor(() => runtime.connectivity.getState() === 'offline', 5000);
      const list = queryClient.getQueryData<ShoppingList>(SHOPPING_ACTIVE_KEY);
      const shopItem: ShoppingItem | undefined = list?.items.find((i) => i.id === shopping.id);
      const pantryItem = queryClient
        .getQueryData<PantryItem[]>(PANTRY_ALL_KEY)
        ?.find((i) => i.id === pantry.id);
      if (!offline || !pantryItem) {
        emit('offline-write', false, { offline, hasPantryItem: Boolean(pantryItem) });
        return;
      }
      const createdId = newId();
      await runtime.enqueue(buildShoppingUpdate(shopItem, shopping.id, { isChecked: true }));
      for (const op of buildPantryQuickPatchOps(pantryItem, { quantity: pantryItem.quantity + 2 })) {
        await runtime.enqueue(op);
      }
      const afterFirst = { ...pantryItem, quantity: pantryItem.quantity + 2 };
      for (const op of buildPantryQuickPatchOps(afterFirst, { quantity: afterFirst.quantity + 3 })) {
        await runtime.enqueue(op);
      }
      await runtime.enqueue(
        buildPantryCreate(
          { ingredientName: `E2E Created ${tag}`, category: 'other', quantity: 2, unit: 'items' },
          createdId
        )
      );
      await runtime.persister.flush();
      const rows = await runtime.store.list(userId());
      const adjusts = rows.filter((r) => r.kind === 'pantry.adjust');
      const adjustKey = adjusts[0]?.idempotencyKey ?? '';
      const counts = await runtime.store.counts(userId());
      const queuedBefore = rows.length;
      const state: ScenarioState = {
        pantryId: pantry.id,
        createdId,
        shoppingId: shopping.id,
        adjustKey,
        queuedBefore,
      };
      window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
      window.localStorage.setItem(OFFLINE_PHASE_KEY, nextOfflinePhase('seed'));
      emit('offline-write', adjusts.length === 1 && queuedBefore === 3 && Boolean(adjustKey), {
        queued: counts.queued,
        total: queuedBefore,
        adjustOps: adjusts.length,
      });
    };

    const runColdStart = async () => {
      const state = readState();
      const mountedAt = Date.now();
      const runtime = await loadRuntime();
      await whenTokenStorageReady();
      const hydrated = await waitFor(() => (queryClient.getQueryData<PantryItem[]>(PANTRY_ALL_KEY)?.length ?? 0) > 0);
      const hydrateMs = Date.now() - mountedAt;
      const sizes = canonicalSizes();
      const queued = (await runtime.store.list(userId())).length;
      const pantryList = queryClient.getQueryData<PantryItem[]>(PANTRY_ALL_KEY) ?? [];
      const shownQty = Number(pantryList.find((i) => i.id === state?.pantryId)?.quantity ?? -1);
      const createdShown = pantryList.some((i) => i.id === state?.createdId);
      const stillOffline = runtime.connectivity.getState() === 'offline';
      emit(
        'offline-cold-start',
        Boolean(state) && hydrated && allNonEmpty(sizes) && stillOffline && queued === state?.queuedBefore,
        { ...sizes, queued, stillOffline, hydrateMs, optimisticQty: shownQty, createdShown }
      );
      if (!state) return;
      // Let the offline UI be captured before reconnecting.
      await sleep(4000);

      stage = 'reconnect';
      setForcedOffline(false);
      const reachable = await runtime.connectivity.isReachable();
      runtime.drain.kick('e2e');
      const idle = await Promise.race([runtime.drain.whenIdle().then(() => true), sleep(DRAIN_TIMEOUT_MS).then(() => false)]);
      const left = (await runtime.store.list(userId())).length;
      const pantry = await fetchPantry(state.pantryId);
      const all = await pantryApi.getAll({ limit: 100 });
      const createdCount = all.items.filter((i) => i.id === state.createdId).length;
      const shop = await shoppingApi.getActiveList();
      const checked = shop.items.find((i) => i.id === state.shoppingId)?.isChecked === true;
      const delta = Number(pantry?.quantity ?? 0) - 1;
      emit('reconnect', reachable && idle && left === 0 && delta === ADJUST_TOTAL && createdCount === 1 && checked, {
        delta: delta === ADJUST_TOTAL,
        createdOnce: createdCount === 1,
        checked,
        drained: left === 0,
      });

      // Exactly-once: resend the already-applied adjust with the SAME key and body.
      const transport = createTransport({ client: apiClient, isOffline: () => false });
      let replayOk = false;
      try {
        await transport.send({
          method: 'POST',
          url: API_ROUTES.PANTRY.ADJUST(encodeURIComponent(state.pantryId)),
          body: { delta: ADJUST_TOTAL },
          idempotencyKey: state.adjustKey,
        });
        replayOk = true;
      } catch {
        replayOk = false;
      }
      const after = await fetchPantry(state.pantryId);
      const unchanged = Number(after?.quantity ?? -1) === Number(pantry?.quantity ?? -2);
      emit('replay', replayOk && unchanged, { unchanged, accepted: replayOk });
      window.localStorage.setItem(OFFLINE_PHASE_KEY, nextOfflinePhase('offline-cold-start'));
      window.localStorage.removeItem(STATE_KEY);
      emit('done', true);
      router.replace('/pantry/');
    };

    const run = async () => {
      await whenTokenStorageReady();
      const phase = currentOfflinePhase(window.localStorage.getItem(OFFLINE_PHASE_KEY));
      if (phase === 'seed') await runSeed();
      else if (phase === 'offline-cold-start') await runColdStart();
      else {
        setStatus('done');
        router.replace('/pantry/');
      }
    };

    void run().catch((error) => {
      const reason = error instanceof Error ? error.message.slice(0, 80) : 'unknown';
      console.error('E2E offline runner crashed:', reason);
      emit('done', false, { stage, reason });
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
