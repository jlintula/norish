import { useSubscription } from "@trpc/tanstack-react-query";

import type { CaldavSyncStatus, CaldavSyncStatusViewDto } from "@norish/shared/contracts";
import type {
  CaldavSyncEvent,
  CaldavSyncEventData,
} from "@norish/shared/contracts/realtime/caldav";
import { createClientLogger } from "@norish/shared/lib/logger";

import type { CaldavCacheHelpers, CreateCaldavHooksOptions } from "./types";

const log = createClientLogger("CaldavSubscription");

type SyncEventPayload = CaldavSyncEvent;

type CaldavItemStatusUpdatedPayload = {
  itemId: string;
  itemType: "recipe" | "note";
  syncStatus: "pending" | "synced" | "failed" | "removed";
  errorMessage: string | null;
  caldavEventUid: string | null;
  version: number;
};

export function applyCaldavStatusUpdate(
  statuses: CaldavSyncStatusViewDto[],
  payload: CaldavItemStatusUpdatedPayload,
  lastSyncAt: Date
): CaldavSyncStatusViewDto[] {
  const { itemId, itemType, syncStatus, errorMessage, caldavEventUid, version } = payload;

  return statuses.map((status) => {
    if (status.itemId === itemId && status.itemType === itemType) {
      return {
        ...status,
        syncStatus: syncStatus as CaldavSyncStatus,
        errorMessage,
        caldavEventUid,
        version,
        lastSyncAt,
      } satisfies CaldavSyncStatusViewDto;
    }

    return status;
  });
}

export type CaldavSubscriptionToastAdapter = {
  showSyncCompleteToast: (totalSynced: number, totalFailed: number) => void;
};

type CreateUseCaldavSubscriptionOptions = CreateCaldavHooksOptions & {
  useCaldavCacheHelpers: () => CaldavCacheHelpers;
  useToastAdapter: () => CaldavSubscriptionToastAdapter;
};

export function createUseCaldavSubscription({
  useTRPC,
  useCaldavCacheHelpers,
  useToastAdapter,
}: CreateUseCaldavSubscriptionOptions) {
  function useCaldavSubscription() {
    const trpc = useTRPC();
    const { setConfig, setStatuses, invalidateSyncStatus, invalidateSummary } =
      useCaldavCacheHelpers();
    const toastAdapter = useToastAdapter();

    useSubscription(
      trpc.caldavSubscriptions.onSyncEvent.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          const { type, data } = payload as SyncEventPayload;

          if (type === "configSaved") {
            const payload = data as CaldavSyncEventData["configSaved"];

            setConfig(() => payload.config);
          } else if (type === "syncCompleted" || type === "syncFailed") {
            invalidateSyncStatus();
            invalidateSummary();
          } else if (type === "itemStatusUpdated") {
            const payload = data as CaldavItemStatusUpdatedPayload;

            setStatuses((prev) => {
              if (!prev) return prev;

              const updatedStatuses = applyCaldavStatusUpdate(prev.statuses, payload, new Date());

              return { ...prev, statuses: updatedStatuses };
            });
            invalidateSummary();
          } else if (type === "initialSyncComplete") {
            const payload = data as CaldavSyncEventData["initialSyncComplete"];

            toastAdapter.showSyncCompleteToast(payload.totalSynced, payload.totalFailed);
            invalidateSyncStatus();
            invalidateSummary();
          }
        },
        onError: (error) => {
          log.error({ err: error }, "CalDAV subscription error");
        },
      })
    );
  }

  function useCaldavItemStatusSubscription() {
    const trpc = useTRPC();
    const { setStatuses, invalidateSummary } = useCaldavCacheHelpers();

    // The item-status facts of the one sync subscription; ticket 07 folds this hook away.
    useSubscription(
      trpc.caldavSubscriptions.onSyncEvent.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          const event = payload as SyncEventPayload;

          if (event.type !== "itemStatusUpdated") return;

          const data = event.data as CaldavItemStatusUpdatedPayload;

          setStatuses((prev) => {
            if (!prev) return prev;

            const updatedStatuses = applyCaldavStatusUpdate(prev.statuses, data, new Date());

            return { ...prev, statuses: updatedStatuses };
          });

          invalidateSummary();
        },
      })
    );
  }

  function useCaldavSyncCompleteSubscription() {
    const trpc = useTRPC();
    const { invalidateSyncStatus, invalidateSummary } = useCaldavCacheHelpers();
    const toastAdapter = useToastAdapter();

    // The initial-sync-complete fact of the one sync subscription; ticket 07 folds this hook away.
    useSubscription(
      trpc.caldavSubscriptions.onSyncEvent.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          const event = payload as SyncEventPayload;

          if (event.type !== "initialSyncComplete") return;

          const data = event.data;

          toastAdapter.showSyncCompleteToast(data.totalSynced, data.totalFailed);
          invalidateSyncStatus();
          invalidateSummary();
        },
      })
    );
  }

  return {
    useCaldavSubscription,
    useCaldavItemStatusSubscription,
    useCaldavSyncCompleteSubscription,
  };
}
