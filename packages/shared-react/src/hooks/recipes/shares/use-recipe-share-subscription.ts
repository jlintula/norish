import { useSubscription } from "@trpc/tanstack-react-query";

import type { RecipeShareLifecycleEventDto } from "@norish/shared/contracts";
import type { RecipeShareEvent } from "@norish/shared/contracts/realtime/recipes";

import type { CreateRecipeHooksOptions } from "../types";
import type { RecipeShareCacheHelpers } from "./use-recipe-share-cache";

export type RecipeShareSubscriptionCallbacks = {
  onEvent?: (payload: RecipeShareLifecycleEventDto) => void;
};

export function createUseRecipeShareSubscription(
  { useTRPC }: CreateRecipeHooksOptions,
  dependencies: {
    useRecipeShareCacheHelpers: () => RecipeShareCacheHelpers;
  }
) {
  return function useRecipeShareSubscription(
    recipeId: string | null,
    callbacks: RecipeShareSubscriptionCallbacks = {}
  ) {
    const trpc = useTRPC();
    const {
      invalidateRecipeShares,
      invalidateMyRecipeShares,
      invalidateAdminRecipeShares,
      invalidateRecipeShare,
      removeRecipeShare,
    } = dependencies.useRecipeShareCacheHelpers();

    const asSubscriptionOptions = (options: unknown): Parameters<typeof useSubscription>[0] => {
      return options as Parameters<typeof useSubscription>[0];
    };

    const handleEvent = (payload: RecipeShareLifecycleEventDto) => {
      // Always invalidate inventory queries so settings pages stay fresh.
      invalidateMyRecipeShares();
      invalidateAdminRecipeShares();

      if (!recipeId || payload.recipeId !== recipeId) {
        return;
      }

      invalidateRecipeShares(payload.recipeId);

      if (payload.type === "deleted") {
        removeRecipeShare(payload.shareId);
      } else {
        invalidateRecipeShare(payload.shareId);
      }

      callbacks.onEvent?.(payload);
    };

    // One subscription for every share lifecycle transition; `share.type` says which.
    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onShareEvent.subscriptionOptions(undefined, {
          enabled: !!recipeId,
          onData: ({ payload }: any) => {
            handleEvent((payload as RecipeShareEvent).share);
          },
        })
      )
    );
  };
}
