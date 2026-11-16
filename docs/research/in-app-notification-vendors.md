# In-app notification vendors for the Cadence Inbox

Research for issue #3 (parent map #2). Researched 2026-11-16 from vendor pricing pages, docs and npm. Pricing pages change often, so re-check before signing up.

**Question:** which third-party vendors can deliver an in-app **Inbox** (bell, unread count, feed) for Cadence on a free tier, with real-time delivery (no refresh), and how do they compare?

## TL;DR

| Rank | Vendor | Free tier | Real-time on free | Prebuilt React Inbox | Tailwind fit |
| ---- | ------ | --------- | ----------------- | -------------------- | ------------ |
| 1 | **Knock** | 10,000 messages/mo, no hard cap, unlimited envs | Yes (managed websocket) | `@knocklabs/react` (`NotificationIconButton` + `NotificationFeedPopover`) + hooks | CSS variables (`--rnf-*`) or replace CSS; headless hooks |
| 2 | **Novu** | 10,000 workflow runs/mo, 5 workflows, 2 envs, Novu branding | Yes (websocket, `wss://socket.novu.co`) | `@novu/react` `<Inbox />` + hooks | **Best:** `appearance.elements` accepts Tailwind class strings |
| 3 | **Courier** | 10,000 sends/mo, Inbox included | Yes (real-time socket) | `@trycourier/courier-react` v9 | `CourierInboxTheme` object |
| 4 | **SuprSend** | 10,000 notifications/mo, SuprSend branding, many workflow features gated | Yes (feed socket) | `@suprsend/react` `<Inbox />` + headless hooks | `theme` object, overridable sub-components |
| 5 | **MagicBell** | **1,000 deliveries/mo**, 1 project | Yes (WebSockets via Ably) | `@magicbell/react` `FloatingInbox` | CSS variables (`--magicbell-*`) |
| — | Engagespot, Pingram (ex-NotificationAPI) | Not ranked; see [Other options](#other-options-considered) | | | |

**Recommendation: Knock**, with Novu a close second.

- **Why Knock:** the free tier is generous and has no hard cap. It gives unlimited isolated environments and retention, a mature React feed (bell, badge with `badgeCountType="unread"`, popover), headless hooks, and a first-party Node SDK (`@knocklabs/node`) with a `signUserToken` helper. Its React provider has an `enabled` prop that keeps the client idle (no websocket), which helps with SSR and DevUI user switching.
- **Pick Novu instead** if Tailwind-native styling matters more than environment flexibility. It is the only vendor whose Inbox takes Tailwind class strings directly. Its free tier keeps Novu branding, limits you to 5 workflows, and keeps the activity feed for only 24h.

No candidate failed the real-time hard requirement: each one documents live delivery through its standard SDK, and none gates it behind a paid plan. MagicBell's free cap of 1,000 deliveries is the main limit worth flagging.

---

## Knock

**Free-tier limits** ([pricing](https://knock.app/pricing))
- $0, no card. "Up to 10,000" messages/month (one message = one delivery to one user on one channel).
- "We don't hard cap your messages." Knock contacts you about billing instead.
- Unlimited: workflows, feeds per recipient, feed retention, and isolated environments.
- Pre-built or bring-your-own components are included.
- Knock branding stays on Free; removing it needs Starter ($250/mo).

**Real-time**
- Managed real-time service: "receives notifications over a websocket when new messages are sent to an in-app feed channel" ([feeds overview](https://docs.knock.app/in-app-ui/feeds/overview)).
- The JS client's `feedClient.listenForUpdates()` connects to the socket and emits `items.received.realtime` ([FeedClient reference](https://docs.knock.app/in-app-ui/javascript/sdk/feed-client)).
- The pricing page does not gate real-time.

**React components** ([React feed docs](https://docs.knock.app/in-app-ui/react/feed))
- Package: `@knocklabs/react` (v0.15.1 on npm).
- Components: `KnockProvider`, `KnockFeedProvider`, `NotificationIconButton` and `NotificationFeedPopover`; also `NotificationFeed` and `NotificationCell` with `renderItem` for custom rendering.
- The badge counts *seen* by default. `badgeCountType="unread"` switches it to unread.
- Theming: CSS variables prefixed `--rnf-`, or drop Knock's CSS entirely (classes are prefixed `rnf-`). `colorMode="dark"` is available.
- Headless: `useNotifications` / `useNotificationStore`, or the vanilla `@knocklabs/client` SDK.
- Multi-tab: `auto_manage_socket_connection` drops the socket in inactive tabs. An experimental BroadcastChannel option syncs across tabs.

**Server SDK**
- `@knocklabs/node` (v1.41.1): `workflows.trigger` from route actions.

**Users and auth**
- Users must be identified in Knock before they can be notified, but this can happen **inline in the trigger call**. The `id` is immutable, so use the DB primary key ([users](https://docs.knock.app/concepts/users)).
- Auth: "Without enhanced security mode, a request with your public key can act as any user." Enable enhanced security for production. The backend signs an RS256 JWT with `signUserToken(userId, { signingKey })`, and the client gets it through the `userToken` prop. `onUserTokenExpiring` handles refresh ([security](https://docs.knock.app/in-app-ui/security-and-authentication)).

**Read/unread/archive**
- Feed items have seen/read/archived states. `feedClient.markAsRead`, `markAllAsRead` and archive methods exist, plus unread and unseen counts in feed metadata ([FeedClient reference](https://docs.knock.app/in-app-ui/javascript/sdk/feed-client)).

**Testing**
- You can enable development and production environments. Each has its own isolated users and messages and its own API key pair, and changes are promoted dev to prod ([environments](https://docs.knock.app/concepts/environments)).
- Development can keep enhanced security off. For vitest, wrap `@knocklabs/node` behind a small module and fake it; there is no official in-memory fake.

**React Router v7 / SSR**
- `KnockProvider` has an `enabled` prop. When it is `false`, it "render[s] children but keep[s] the Knock client idle: no identify call, no API requests, and no websocket." Verified in the `@knocklabs/react-core` 0.17.1 source, `KnockProvider.tsx`.
- Use `enabled={isHydrated && Boolean(userId && userToken)}` so the socket never opens on the server. Toggling it also handles DevUI user switching, behaving like a logout followed by a login.
- The CSS import `@knocklabs/react/dist/index.css` goes in the root route.

## Novu

**Free-tier limits** ([pricing](https://novu.co/pricing))
- $0, no card. "10,000 workflow runs / month" with no overage option.
- Unlimited subscribers, "Up to 5 workflows", "Up to 3 team members", and "2 environments (Dev + Prod)".
- Retention: Inbox feed 30 days; activity feed 24 hours.
- Novu branding cannot be removed on Free ([prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production)).
- Novu is also open source and self-hostable.

**Real-time**
- `@novu/js` keeps a WebSocket open automatically. Cloud uses PartySocket at `wss://socket.novu.co`; self-hosted uses Socket.IO ([JS SDK](https://docs.novu.co/platform/sdks/javascript)).
- Events include `notifications.notification_received` and `notifications.unread_count_changed`.
- The `<Inbox />` "manages the real-time unread count displayed on the bell icon" ([Inbox overview](https://docs.novu.co/platform/inbox/overview)).

**React components**
- Package: `@novu/react` (v3.20.0; React 18+/19). The drop-in `<Inbox />` is composable from `Bell`, `Notifications`, `InboxContent` and `Preferences`. Hooks and `@novu/js` are available for a headless UI.
- Theming ([styling](https://docs.novu.co/platform/inbox/react/styling)): the `appearance` prop takes `baseTheme`, `variables`, `elements`, `icons` and `animations`. `elements` accepts **Tailwind class strings** (e.g. `bellIcon: 'p-4 bg-white rounded-full'`) or callbacks returning classes. Styles are auto-injected into `<head>`.
- The Inbox has a `navigate` prop for in-app routing.

**Server SDK**
- `@novu/api` (v3.20.0) for triggering workflows.

**Users and auth**
- "New subscribers are created on the first session", and a trigger to an unknown `subscriberId` creates the subscriber too. No pre-creation is needed ([React quickstart](https://docs.novu.co/platform/quickstart/react)).
- Production auth uses HMAC: `subscriberHash = HMAC-SHA256(secretKey, subscriberId)` as lowercase hex, computed server-side. Turn it on per environment. When it is on and the hash is missing, "the Inbox will not load" ([prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production)).
- HMAC is simpler than a JWT, but the hash never expires.

**Read/unread/archive**
- Read, unread, archive and snooze are supported, plus tabs and filters.

**Testing**
- Separate Dev and Prod environments, each with its own keys. For vitest, fake the `@novu/api` wrapper.

**React Router v7 / SSR**
- Novu has official Remix and React (React Router) quickstarts ([Remix quickstart](https://docs.novu.co/platform/quickstart/remix)), but no explicit SSR guidance.
- Render `<Inbox />` client-only (behind a hydration guard), since it opens a socket and injects styles.

## Courier

**Free-tier limits** ([pricing](https://www.courier.com/pricing))
- "10,000 sends a month". One send is one template to one recipient, across all of its channels.
- Test-environment sends count too.
- Courier's own pages describe the free plan as including the Inbox ([Courier vs Knock guide](https://www.courier.com/guides/courier-vs-knock-notification-system)). The pricing page itself doesn't list Inbox per plan.
- Above 10k you must add a card, and then "$0.005 for every send, including the first 10,000".

**Real-time**
- "Messages arrive in real time on web and mobile". Read, opened and archived states sync instantly across devices ([Inbox overview](https://www.courier.com/docs/platform/inbox/inbox-overview)).
- Signing out "disconnects the real-time socket" ([Inbox auth](https://www.courier.com/docs/platform/inbox/authentication)).

**React components**
- Package: `@trycourier/courier-react` (v9.3.5; React 18+). The older `@trycourier/react-inbox` is deprecated.
- Inbox, Toasts and Preferences are built in. Styling goes through a `CourierInboxTheme` object (not class-based). You can supply custom views or build a fully custom UI on the low-level APIs.
- Unread counts/badges and read/archive actions are built in.

**Server SDK**
- `@trycourier/courier` (v10.0.0).

**Users and auth**
- "Nothing has to exist in Courier first, since signing in registers the user."
- The backend calls `POST /auth/issue-token` with scopes `user_id:<id> inbox:read:messages inbox:write:events` and sets `expires_in`; without it, the token "never expires". The client then calls `signIn({ userId, jwt })`.
- The SDKs "do not refresh tokens" ([Inbox auth](https://www.courier.com/docs/platform/inbox/authentication)).
- **Caveat:** minting a token is a network call to Courier on every session. Knock and SuprSend tokens are signed locally.

**Testing**
- Separate test and production environments with their own API keys. Test sends count toward the quota.

**React Router v7 / SSR**
- Courier gives no specific guidance. Call `signIn` client-side after hydration.

## SuprSend

**Free-tier limits** ([pricing](https://www.suprsend.com/pricing))
- $0, no card. "10k Notifications/mo". Each channel and recipient counts separately. Overage is not stopped; sales gets in touch.
- In-app feed is included "with SuprSend branding".
- Per the comparison table, Free gates batching/digest, throttling, user preferences, multi-tenant and i18n.
- New accounts get a 30-day all-features trial, then drop to Free.

**Real-time**
- The Inbox has a feed socket (`socketHost`). Its reachability feature reports `ONLINE`, `CONNECTING`, `DEGRADED` and similar statuses ([React drop-in feed](https://docs.suprsend.com/docs/react-in-app-feed)).

**React components**
- Package: `@suprsend/react` (v1.5.0). The legacy `@suprsend/react-inbox` is end-of-support ([React inbox](https://docs.suprsend.com/docs/inbox-react)).
- The drop-in `<Inbox />` accepts overrides like `bellComponent` and `badgeComponent({count})`, plus a `theme` object and `themeType`.
- Headless hooks: `useFeedData`, `useFeedClient`, `useFeed`; client methods include `markAsRead` and `markAsSeen`, plus archive ([headless feed](https://docs.suprsend.com/docs/react-sdk-headless-feed)).
- Toasts are no longer bundled.

**Server SDK**
- `@suprsend/node-sdk` (v1.15.1).

**Users and auth**
- A public key plus an "enhanced secure mode" that "mandates signed user token".
- The backend signs an ES256 JWT with claims `entity_type: 'subscriber'`, `entity_id`, `exp`, `iat` and optional tenant `scope`. `identify(userId, token, { refreshUserToken })` handles refresh ([client auth](https://docs.suprsend.com/docs/client-authentication)).
- The docs' own Node sample has bugs: it declares `secret` twice and the payload JSON is invalid.

**Testing**
- Separate workspaces (staging/production) exist. Stub the Node SDK in vitest.

**React Router v7 / SSR**
- No guidance found.

**Why ranked 4th:** the real-time Inbox is fine, but Free carries branding, several gated features, and less polished docs.

## MagicBell

**Free-tier limits** ([pricing](https://www.magicbell.com/pricing))
- "Builder" plan, $0: "**1,000 Deliveries/mo**", unlimited users, "1 Project".
- Every channel a user receives counts as a delivery.
- The next tier is Startup at $249/mo (50k deliveries).

**Real-time**
- MagicBell "maintains a persistent connection to deliver notifications in real-time" ([in-app channel](https://www.magicbell.com/docs/channels/in_app)).
- The API v2 reference ties the in-app realtime connection to Ably, which is WebSockets ([API reference](https://www.magicbell.com/docs/api/reference)).

**React components** ([React docs](https://www.magicbell.com/docs/libraries/magicbell-react))
- Package: `@magicbell/react` (v1.14.0, last published 2026-07).
- Components: `ContextProvider token={userJwt}`, `FloatingInbox` (bell + popover), `Inbox` and `InlineNotification`.
- Theming: CSS variables (`--magicbell-bg-default`, …) and `.magicbell--*` classes. No documented hooks on this page.
- Archive and delete are available in the inbox ([in-app channel](https://www.magicbell.com/docs/channels/in_app)).

**Server SDK**
- `magicbell-js` (Browser/Node client).

**Auth**
- A per-user JWT signed on your backend ([auth](https://www.magicbell.com/docs/api/authentication)).

**Why ranked 5th:** 1,000 deliveries/month is ten times smaller than every other candidate, which is tight even for a learning project that seeds test data.

## Other options considered

- **Engagespot.** Advertises a free plan with a real-time inbox and React components ([UI kit](https://engagespot.co/notification-uikit)). However, `engagespot.co/pricing` returned 404 and no free-tier numbers could be verified. Its npm packages are stale: `@engagespot/react-component` was last published 2025-05 and `@engagespot/node` 2024-11. Not recommended.
- **Pingram (formerly NotificationAPI; `notificationapi.com/pricing` now redirects to pingram.io).** The free tier lists only email, SMS and voice allowances ([pricing](https://www.pingram.io/pricing)), and the in-app inbox is not mentioned. `@notificationapi/node` is at `0.0.2-alpha.1`. Not recommended.

## Cross-cutting notes for the integration-design ticket

- **User mapping:** all five accept an arbitrary external user ID, so use the Cadence user primary key. Knock (inline identify), Novu, Courier and SuprSend all create or upsert users lazily, so no backfill is needed.
- **Client auth:** every vendor's client works with only a public key in dev, but production needs a server-issued credential: Knock (RS256 JWT, signed locally), SuprSend (ES256 JWT, local), MagicBell (JWT, local), Novu (HMAC hash, local) and Courier (JWT via API call). In React Router, mint it in the root `loader` and pass it to the client provider.
- **SSR:** all of them open a browser socket, so mount the provider client-only, or with Knock use `enabled={false}` until hydration.
- **DevUI user switching:** the credential must change with the session user, and the provider must reconnect. Knock's `enabled` prop and Courier's `signIn` / `signOut` make this explicit.
- **vitest:** none of the vendors ships an official in-memory fake. Put the vendor's Node SDK behind a thin `notifications` module and fake that module in tests.
