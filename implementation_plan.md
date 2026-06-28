# Replace Polling with Supabase Realtime Subscriptions

## Background

The codebase currently has several pages that fetch Supabase data on mount but lack realtime subscriptions, meaning they won't reflect changes until the user manually navigates away and back. Other pages already use realtime subscriptions correctly. This plan adds realtime subscriptions to the pages that are missing them, and addresses one `setInterval` usage.

## Current State Assessment

### ✅ Already Using Realtime Correctly (No Changes Needed)
| File | Tables Subscribed | Cleanup |
|------|-------------------|---------|
| [useQueue.ts](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/hooks/useQueue.ts) | `queue_entries`, `sessions` | ✅ `removeChannel` on unmount |
| [TV.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/TV.tsx) | `queue_entries`, `sessions` | ✅ `removeChannel` on unmount |
| [Rendezvous.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Rendezvous.tsx) | `appointments` | ✅ `removeChannel` on unmount |
| [Client.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Client.tsx) | `queue_entries` | ✅ `removeChannel` on unmount |
| [Appointment.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Appointment.tsx) | `website` | ✅ `removeChannel` on unmount |

### ❌ Missing Realtime — Needs Subscriptions
| File | Tables Fetched | Current Pattern |
|------|---------------|-----------------|
| [Manager.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Manager.tsx) | `completed_clients`, `expenses` | Fetch on mount + date change only |
| [MedecinDashboard.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/MedecinDashboard.tsx) | `prescriptions`, `appointments`, `completed_clients` | Fetch on mount only |
| [Depenses.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Depenses.tsx) | `expenses` | Fetch on mount + date change only |
| [Factures.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Factures.tsx) | `invoices` | Fetch on mount + date change only |
| [Rendezvous.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Rendezvous.tsx) | `completed_clients` | Fetched via `fetchClients()` on mount + search change, but **not** subscribed to realtime |

### ⏰ `setInterval` (Not a Polling Issue)
| File | Usage | Verdict |
|------|-------|---------|
| [TV.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/TV.tsx) L27 | `setInterval(() => setTime(new Date()), 1000)` for a live clock | **Keep as-is** — this is a UI clock, not a data fetch. Already has `clearInterval` cleanup. |

---

## Proposed Changes

### 1. Manager Dashboard
#### [MODIFY] [Manager.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Manager.tsx)

Add a realtime subscription in the existing `useEffect` to listen for changes to `completed_clients` and `expenses` tables. When changes occur, call the existing `fetchData()` function. Properly clean up with `removeChannel` on unmount.

```typescript
useEffect(() => {
  fetchData();

  const channel = supabase
    .channel('manager-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'completed_clients' }, () => fetchData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchData())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [dateFrom, dateTo]);
```

---

### 2. Medecin Dashboard
#### [MODIFY] [MedecinDashboard.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/MedecinDashboard.tsx)

Add a realtime subscription for `prescriptions`, `appointments`, and `completed_clients` tables. On any change, call `fetchDashboardData()`.

```typescript
useEffect(() => {
  if (doctorInfo) {
    fetchDashboardData();

    const channel = supabase
      .channel('medecin-dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completed_clients' }, () => fetchDashboardData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }
}, [doctorInfo]);
```

---

### 3. Dépenses
#### [MODIFY] [Depenses.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Depenses.tsx)

Add realtime subscription for the `expenses` table.

```typescript
useEffect(() => {
  fetchExpenses();

  const channel = supabase
    .channel('expenses-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchExpenses())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [dateFrom, dateTo]);
```

---

### 4. Factures
#### [MODIFY] [Factures.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Factures.tsx)

Add realtime subscription for the `invoices` table.

```typescript
useEffect(() => {
  fetchInvoices();

  const channel = supabase
    .channel('invoices-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchInvoices())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [dateFrom, dateTo]);
```

---

### 5. Rendezvous — Add Missing `completed_clients` Subscription
#### [MODIFY] [Rendezvous.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Rendezvous.tsx)

The existing realtime subscription at L382-398 only watches `appointments`. Add `completed_clients` to the same channel so the patient list auto-updates when treatments are added/edited/deleted.

```typescript
const channel = supabase
  .channel('appointments-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchInitialData())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'completed_clients' }, () => {
    fetchInitialData();
    fetchClients();
  })
  .subscribe();
```

---

## Summary of Changes

| File | What Changes | Tables Subscribed |
|------|-------------|-------------------|
| Manager.tsx | Add realtime channel in existing useEffect | `completed_clients`, `expenses` |
| MedecinDashboard.tsx | Add realtime channel in existing useEffect | `prescriptions`, `appointments`, `completed_clients` |
| Depenses.tsx | Add realtime channel in existing useEffect | `expenses` |
| Factures.tsx | Add realtime channel in existing useEffect | `invoices` |
| Rendezvous.tsx | Extend existing channel with `completed_clients` | `completed_clients` (added) |

> [!NOTE]
> The `setInterval` in TV.tsx's `LiveClock` component is **not** a data-fetching poll — it's a 1-second UI clock tick. It already has proper `clearInterval` cleanup. No change needed.

> [!IMPORTANT]
> All subscriptions reuse the existing `fetch*` functions, keeping the logic simple and consistent. Each subscription properly cleans up via `removeChannel` on unmount to prevent memory leaks.

## Verification Plan

### Manual Verification
- Open each page, then use the Supabase dashboard or another browser tab to insert/update/delete records in the relevant tables and confirm the page updates in real-time without a manual refresh.
- Navigate away from each page and back to ensure no "channel already subscribed" errors in console (verifying cleanup).
