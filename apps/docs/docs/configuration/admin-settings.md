---
sidebar_position: 7
title: Admin settings
description: Runtime settings server owners and admins can manage from the Norish UI.
---

# Admin settings

Most of Norish is configurable at runtime from the UI — no restart or env-var
change required. Server owners and admins manage these under **Settings → Admin**.

You can manage:

- **[Users](./users.md)** — everyone with an account, their roles, and removing accounts.
- **Registration policy** — whether new users may register.
- **Permission policies** for recipe view, edit, and delete scopes.
- **Auth providers** (OIDC, GitHub, Google).
- **OIDC claim mapping** for admin role assignment and household auto-join.
- **Content detection settings** (units, content indicators, recurrence config).
- **AI and video processing settings**.
- **[Job queue](#job-queue)** — every background job, with its steps, attempts and the models it asked.
- **System scheduler** and server restart actions.

:::tip
Settings that can change at runtime live here; settings needed to _boot_ the
instance, the [database](./database.md), the encryption key in
[Server & runtime](./server-runtime.md), and the initial
[auth provider](./authentication.md) — are environment variables.
:::

## Job queue

![Job details with the models a job asked](/img/screenshots/admin-job-details.png)

Every import, enrichment run, CalDAV sync and scheduled task is a job on one of
Norish's queues, and **Settings → Admin → Job Queues** shows them: how many are
waiting, running, finished or failed per queue, and a table of recent jobs you
can filter by queue and state. A failed job can be retried from here, a
finished one removed, and the retention rules say how many completed and failed
jobs are kept and for how long.

Opening a job shows its details: what it was given, every attempt with the
pipeline steps that ran and how long each took, the worker's log lines, and the
error that ended a failed attempt. A job that asked a model also lists the
**Models** it used, the [AI provider](./ai-provider.md) or the
[Decision Model](./ai-provider.md#decision-model), by provider and the model id
that answered, and marks a request that failed, so which model handled a job is
visible without reading the server logs.
