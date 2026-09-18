import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { CalendarRealtime } from "@norish/shared/contracts/realtime/calendar";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { PlannedItemWithRecipePayload } from "@norish/shared/contracts/zod";

import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";
import type { CalendarCacheHelpers, CreateCalendarHooksOptions } from "./types";

type Payload<E extends EventName<CalendarRealtime>> = PayloadOf<CalendarRealtime, E>;

type CreateUseCalendarSubscriptionOptions = CreateCalendarHooksOptions & {
  useCalendarCacheHelpers: (startISO: string, endISO: string) => CalendarCacheHelpers;
};

function isDateInRange(date: string, startISO: string, endISO: string) {
  return date >= startISO && date <= endISO;
}

function sortCalendarItems(items: PlannedItemFromQuery[]) {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.slot !== b.slot) return a.slot.localeCompare(b.slot);

    return a.sortOrder - b.sortOrder;
  });
}

function toPlannedItemFromPayload(
  item: PlannedItemWithRecipePayload,
  existing?: PlannedItemFromQuery
): PlannedItemFromQuery {
  return {
    id: item.id,
    userId: item.userId,
    date: item.date,
    slot: item.slot,
    sortOrder: item.sortOrder,
    itemType: item.itemType,
    recipeId: item.recipeId,
    title: item.title,
    recipeName: item.recipeName,
    recipeImage: item.recipeImage,
    servings: item.servings,
    calories: item.calories,
    version: item.version ?? existing?.version ?? 1,
    createdAt: existing?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };
}

function upsertItemInRange(
  prev: PlannedItemFromQuery[],
  item: PlannedItemWithRecipePayload,
  startISO: string,
  endISO: string
) {
  const existing = prev.find((current) => current.id === item.id);

  if (!isDateInRange(item.date, startISO, endISO)) {
    return prev.filter((current) => current.id !== item.id);
  }

  const nextItem = toPlannedItemFromPayload(item, existing);
  const next = existing
    ? prev.map((current) => (current.id === item.id ? nextItem : current))
    : [...prev, nextItem];

  return sortCalendarItems(next);
}

export function createUseCalendarSubscription({
  useTRPC,
  useCalendarCacheHelpers,
}: CreateUseCalendarSubscriptionOptions) {
  return function useCalendarSubscription(startISO: string, endISO: string) {
    const trpc = useTRPC();
    const { setCalendarData, invalidate } = useCalendarCacheHelpers(startISO, endISO);

    const setItems = (updater: (prev: PlannedItemFromQuery[]) => PlannedItemFromQuery[]) => {
      setCalendarData((prev) => updater(prev ?? []));
    };

    // A lagged subscription refetches the range this screen shows.
    const lag = { onLag: invalidate };

    useRealtimeSubscription<Payload<"itemCreated">>(trpc.calendar.onItemCreated, {
      ...lag,
      onEvent: (payload) => {
        setItems((prev) => upsertItemInRange(prev, payload.item, startISO, endISO));
      },
    });

    useRealtimeSubscription<Payload<"itemDeleted">>(trpc.calendar.onItemDeleted, {
      ...lag,
      onEvent: (payload) => {
        setItems((prev) => prev.filter((item) => item.id !== payload.itemId));
      },
    });

    useRealtimeSubscription<Payload<"itemMoved">>(trpc.calendar.onItemMoved, {
      ...lag,
      onEvent: (payload) => {
        setItems((prev) => {
          const itemIsInRange = isDateInRange(payload.item.date, startISO, endISO);
          const targetSortMap = new Map(
            payload.targetSlotItems.map((item) => [item.id, item.sortOrder])
          );
          const sourceSortMap = payload.sourceSlotItems
            ? new Map(payload.sourceSlotItems.map((item) => [item.id, item.sortOrder]))
            : null;

          const updated = prev
            .filter((item) => item.id !== payload.item.id || itemIsInRange)
            .map((item) => {
              if (item.id === payload.item.id) {
                return toPlannedItemFromPayload(payload.item, item);
              }

              if (targetSortMap.has(item.id)) {
                return {
                  ...item,
                  sortOrder: targetSortMap.get(item.id)!,
                };
              }

              if (sourceSortMap?.has(item.id)) {
                return {
                  ...item,
                  sortOrder: sourceSortMap.get(item.id)!,
                };
              }

              return item;
            });

          if (!itemIsInRange || updated.some((item) => item.id === payload.item.id)) {
            return sortCalendarItems(updated);
          }

          return sortCalendarItems([...updated, toPlannedItemFromPayload(payload.item)]);
        });
      },
    });

    useRealtimeSubscription<Payload<"itemUpdated">>(trpc.calendar.onItemUpdated, {
      ...lag,
      onEvent: (payload) => {
        setItems((prev) => upsertItemInRange(prev, payload.item, startISO, endISO));
      },
    });

    useRealtimeSubscription<Payload<"failed">>(trpc.calendar.onFailed, {
      ...lag,
      onEvent: () => {
        invalidate();
      },
    });
  };
}
