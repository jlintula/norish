/**
 * A fake Realtime Domain for router tests.
 *
 * Records every publish — `{ event, payload, target, channel }` — with the
 * channel derived through the real codec, so a test can assert the exact
 * channel a mutation announced on without any Redis behind it.
 */
import { vi } from "vitest";

import type { RealtimeDomain, TargetFor } from "@norish/shared-server/realtime/domain";
import type {
  EventName,
  PayloadOf,
  RealtimeCatalogue,
  ScopeOf,
} from "@norish/shared/contracts/realtime/catalogue";
import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";

export interface RecordedPublish<
  C extends RealtimeCatalogue,
  E extends EventName<C> = EventName<C>,
> {
  event: E;
  payload: PayloadOf<C, E>;
  target: TargetFor<ScopeOf<C, E>>;
  channel: string;
}

export interface FakeRealtimeDomain<C extends RealtimeCatalogue> extends RealtimeDomain<C> {
  publish: RealtimeDomain<C>["publish"] & ReturnType<typeof vi.fn>;
  published: RecordedPublish<C>[];
  /** Forget every recorded publish. */
  reset(): void;
}

export function createFakeRealtimeDomain<C extends RealtimeCatalogue>(
  catalogue: C
): FakeRealtimeDomain<C> {
  const real = defineRealtimeDomain(catalogue);
  const published: RecordedPublish<C>[] = [];

  const publish = vi.fn(async (event: EventName<C>, payload: unknown, target: unknown) => {
    published.push({
      event,
      payload: payload as PayloadOf<C, EventName<C>>,
      target: target as TargetFor<ScopeOf<C, EventName<C>>>,
      channel: real.channel(event, target as TargetFor<ScopeOf<C, EventName<C>>>),
    });
  });

  return {
    catalogue,
    channel: real.channel,
    channelsFor: real.channelsFor,
    publish: publish as unknown as FakeRealtimeDomain<C>["publish"],
    published,
    reset() {
      published.length = 0;
      publish.mockClear();
    },
  };
}
