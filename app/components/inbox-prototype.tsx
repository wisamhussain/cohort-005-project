// PROTOTYPE — throwaway. Answers "What the Inbox looks like" (wayfinder ticket #6).
// Three structurally different Inbox variants on every page of the app layout,
// switchable via `?variant=A|B|C` and the floating bottom bar:
//   A — bell in the sidebar header, dropdown popover; badge counts UNSEEN (clears on open)
//   B — "Inbox" nav item, slide-over panel with Unread/All/Archived tabs; badge counts UNREAD
//   C — "Inbox" nav item, full page with filters + day groups; opening marks everything READ
// All state is in memory (sample data from "Which events notify whom"). Nothing talks to Knock.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  Circle,
  Inbox as InboxIcon,
  MessageSquare,
  MessageSquareReply,
  Receipt,
  Shield,
  UserPlus,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { cn, formatRelativeTime } from "~/lib/utils";
import { UserRole } from "~/db/schema";
import { Button } from "~/components/ui/button";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

type TypeNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type Recipient = "buyer" | "admin" | "instructor" | "asker" | "teamAdmin";

const TYPE_META: Record<
  TypeNo,
  {
    label: string;
    category: string;
    recipient: Recipient;
    icon: React.ComponentType<{ className?: string }>;
    tint: string;
  }
> = {
  1: { label: "Refund approved", category: "Refunds", recipient: "buyer", icon: CheckCircle2, tint: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  2: { label: "Refund declined", category: "Refunds", recipient: "buyer", icon: XCircle, tint: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  3: { label: "Refund requested", category: "Refunds", recipient: "admin", icon: Receipt, tint: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  4: { label: "New Question", category: "Questions", recipient: "instructor", icon: MessageSquare, tint: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  5: { label: "New Enrollment", category: "Enrollments", recipient: "instructor", icon: UserPlus, tint: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  6: { label: "Course status changed", category: "Course status", recipient: "instructor", icon: Shield, tint: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300" },
  7: { label: "Question answered", category: "Questions", recipient: "asker", icon: MessageSquareReply, tint: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  8: { label: "Seat claimed", category: "Team", recipient: "teamAdmin", icon: UsersRound, tint: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
};

interface SampleNotification {
  id: number;
  type: TypeNo;
  text: string; // **bold** segments
  href: string;
  createdAt: string;
  read: boolean;
  seen: boolean;
  archived: boolean;
}

const MIN = 60_000;
function ago(minutes: number) {
  return new Date(Date.now() - minutes * MIN).toISOString();
}

const SEED: Array<Omit<SampleNotification, "id" | "createdAt"> & { minutesAgo: number }> = [
  { type: 1, text: "Your refund for **Intro to TypeScript** was approved.", href: "/courses/intro-to-typescript", minutesAgo: 12, read: false, seen: false, archived: false },
  { type: 7, text: "**Dana Ruiz** answered your question on **Generics in practice**.", href: "/courses/intro-to-typescript", minutesAgo: 45, read: false, seen: true, archived: false },
  { type: 7, text: "**Sam Okafor** answered your question on **Generics in practice**.", href: "/courses/intro-to-typescript", minutesAgo: 60 * 5, read: true, seen: true, archived: false },
  { type: 2, text: "Your refund request for **Advanced React Patterns** was declined.", href: "/courses/advanced-react-patterns", minutesAgo: 60 * 30, read: true, seen: true, archived: false },
  { type: 8, text: "**Priya Shah** claimed a seat on your **Intro to TypeScript** Team Licence.", href: "/team", minutesAgo: 8, read: false, seen: false, archived: false },
  { type: 8, text: "**Leo Martin** claimed a seat on your **Intro to TypeScript** Team Licence.", href: "/team", minutesAgo: 60 * 26, read: true, seen: true, archived: false },
  { type: 3, text: "**Jordan Lee** requested a refund for **Advanced React Patterns**.", href: "/admin/refunds", minutesAgo: 3, read: false, seen: false, archived: false },
  { type: 3, text: "**Mia Chen** requested a refund for **Intro to TypeScript**.", href: "/admin/refunds", minutesAgo: 60 * 50, read: true, seen: true, archived: false },
  { type: 4, text: "**Alex Kim** asked a question on **useEffect pitfalls** in **Advanced React Patterns**.", href: "/instructor/questions", minutesAgo: 5, read: false, seen: false, archived: false },
  { type: 5, text: "**Priya Shah** enrolled in **Intro to TypeScript**.", href: "/instructor", minutesAgo: 9, read: false, seen: false, archived: false },
  { type: 5, text: "**Leo Martin** enrolled in **Intro to TypeScript**.", href: "/instructor", minutesAgo: 60 * 3, read: false, seen: true, archived: false },
  { type: 6, text: "**Advanced React Patterns** was changed to **Archived** by a Platform Admin.", href: "/instructor", minutesAgo: 60 * 20, read: true, seen: true, archived: false },
  { type: 4, text: "**Noor Haddad** asked a question on **Narrowing** in **Intro to TypeScript**.", href: "/instructor/questions", minutesAgo: 60 * 72, read: true, seen: true, archived: false },
];

const NEW_TEXT: Record<TypeNo, string[]> = {
  1: ["Your refund for **CSS Grid Deep Dive** was approved."],
  2: ["Your refund request for **CSS Grid Deep Dive** was declined."],
  3: ["**Ravi Patel** requested a refund for **CSS Grid Deep Dive**."],
  4: ["**Ella Novak** asked a question on **Utility types** in **Intro to TypeScript**."],
  5: ["**Ella Novak** enrolled in **Advanced React Patterns**."],
  6: ["**Intro to TypeScript** was changed to **Published** by a Platform Admin."],
  7: ["**Dana Ruiz** answered your question on **Utility types**."],
  8: ["**Ella Novak** claimed a seat on your **Intro to TypeScript** Team Licence."],
};

function recipientsFor(role: UserRole | null, isTeamAdmin: boolean): Recipient[] {
  if (role === UserRole.Admin) return ["admin"];
  if (role === UserRole.Instructor) return ["instructor"];
  const r: Recipient[] = ["buyer", "asker"];
  if (isTeamAdmin) r.push("teamAdmin");
  return r;
}

export type DataMode = "role" | "all" | "empty";

// ---------------------------------------------------------------------------
// State hook (shared by all variants + the switcher's readout)
// ---------------------------------------------------------------------------

export function useInboxPrototype(role: UserRole | null, isTeamAdmin: boolean) {
  const [items, setItems] = useState<SampleNotification[]>(() =>
    SEED.map(({ minutesAgo, ...n }, i) => ({ ...n, id: i + 1, createdAt: ago(minutesAgo) }))
  );
  const [mode, setMode] = useState<DataMode>("role");
  const [toastOnNew, setToastOnNew] = useState(true);
  const nextId = useRef(1000);

  const allowed = recipientsFor(role, isTeamAdmin);
  const inScope = useMemo(
    () =>
      mode === "empty"
        ? []
        : items
            .filter((n) => mode === "all" || allowed.includes(TYPE_META[n.type].recipient))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, mode, allowed.join()]
  );
  const active = inScope.filter((n) => !n.archived);

  function patch(ids: number[] | "all-in-scope", change: Partial<SampleNotification>) {
    const set = new Set(ids === "all-in-scope" ? inScope.map((n) => n.id) : ids);
    setItems((prev) => prev.map((n) => (set.has(n.id) ? { ...n, ...change } : n)));
  }

  function simulateNew() {
    const types = (Object.keys(TYPE_META).map(Number) as TypeNo[]).filter(
      (t) => mode === "all" || allowed.includes(TYPE_META[t].recipient)
    );
    const type = types[Math.floor(Math.random() * types.length)];
    const n: SampleNotification = {
      id: nextId.current++,
      type,
      text: NEW_TEXT[type][0],
      href: SEED.find((s) => s.type === type)?.href ?? "/",
      createdAt: new Date().toISOString(),
      read: false,
      seen: false,
      archived: false,
    };
    if (mode === "empty") setMode("role");
    setItems((prev) => [n, ...prev]);
    if (toastOnNew) toast(TYPE_META[type].label, { description: stripBold(n.text) });
  }

  return {
    items: active,
    archived: inScope.filter((n) => n.archived),
    unreadCount: active.filter((n) => !n.read).length,
    unseenCount: active.filter((n) => !n.seen).length,
    markRead: (id: number) => patch([id], { read: true, seen: true }),
    markUnread: (id: number) => patch([id], { read: false }),
    markAllRead: () => patch("all-in-scope", { read: true, seen: true }),
    markAllSeen: () => patch("all-in-scope", { seen: true }),
    archive: (id: number) => patch([id], { archived: true, read: true, seen: true }),
    unarchive: (id: number) => patch([id], { archived: false }),
    simulateNew,
    mode,
    cycleMode: () => setMode((m) => (m === "role" ? "all" : m === "all" ? "empty" : "role")),
    toastOnNew,
    toggleToast: () => setToastOnNew((t) => !t),
  };
}

export type InboxState = ReturnType<typeof useInboxPrototype>;

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function stripBold(s: string) {
  return s.replaceAll("**", "");
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function Time({ iso }: { iso: string }) {
  return <span suppressHydrationWarning>{formatRelativeTime(iso)}</span>;
}

function TypeIcon({ type, size = "md" }: { type: TypeNo; size?: "sm" | "md" }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        meta.tint,
        size === "sm" ? "size-7" : "size-9"
      )}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-none text-white",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function useOpen(onClose?: () => void) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        onClose?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return [open, setOpen] as const;
}

// ---------------------------------------------------------------------------
// Variant A — bell in the sidebar header, dropdown popover
//   badge = UNSEEN, cleared when the dropdown opens
//   read = on click; "Mark all as read"; no archive
// ---------------------------------------------------------------------------

export function VariantA_Header({ inbox }: { inbox: InboxState }) {
  const [open, setOpen] = useOpen();
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    inbox.markAllSeen();
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          open && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
        title="Notifications"
      >
        <Bell className="size-5" />
        <CountBadge count={inbox.unseenCount} className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]" />
      </button>

      {open && (
        <div className="absolute left-full top-0 z-50 ml-3 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold">Notifications</span>
            {inbox.unreadCount > 0 && (
              <button
                onClick={inbox.markAllRead}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {inbox.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-muted-foreground">
                <BellOff className="size-8 opacity-50" />
                <div className="text-sm font-medium text-foreground">You're all caught up</div>
                <div className="text-xs">New Notifications will show up here.</div>
              </div>
            ) : (
              inbox.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    inbox.markRead(n.id);
                    setOpen(false);
                    navigate(n.href);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 border-b px-4 py-3 text-left text-sm last:border-b-0 hover:bg-accent",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <span className="mt-1.5 flex w-2 shrink-0 justify-center">
                    {!n.read && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  <span className="flex-1">
                    <span className={cn("block", n.read ? "text-muted-foreground" : "text-foreground")}>
                      <RichText text={n.text} />
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      <Time iso={n.createdAt} />
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant B — "Inbox" nav item, slide-over panel from the right
//   badge = UNREAD
//   read = on click; per-row read/unread toggle + archive; tabs Unread / All / Archived
// ---------------------------------------------------------------------------

export function VariantB_NavItem({ inbox }: { inbox: InboxState }) {
  const [open, setOpen] = useOpen();
  const [tab, setTab] = useState<"unread" | "all" | "archived">("all");
  const navigate = useNavigate();

  const rows =
    tab === "unread"
      ? inbox.items.filter((n) => !n.read)
      : tab === "archived"
        ? inbox.archived
        : inbox.items;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          open
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <InboxIcon className="size-4" />
        Inbox
        <CountBadge count={inbox.unreadCount} className="ml-auto" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[440px] flex-col border-l bg-background shadow-2xl">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <InboxIcon className="size-5" />
              <h2 className="text-lg font-semibold">Inbox</h2>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={inbox.markAllRead} disabled={inbox.unreadCount === 0}>
                  <CheckCheck /> Mark all as read
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
                  <X />
                </Button>
              </div>
            </div>
            <div className="flex gap-1 border-b px-5">
              {(
                [
                  ["unread", `Unread${inbox.unreadCount ? ` (${inbox.unreadCount})` : ""}`],
                  ["all", "All"],
                  ["archived", "Archived"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                    tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-20 text-center text-muted-foreground">
                  <InboxIcon className="size-10 opacity-40" />
                  <div className="font-medium text-foreground">
                    {tab === "unread" ? "No unread Notifications" : tab === "archived" ? "Nothing archived" : "Your Inbox is empty"}
                  </div>
                  <div className="text-sm">
                    {tab === "archived"
                      ? "Archive a Notification to tidy it away."
                      : "We'll let you know when something needs you."}
                  </div>
                </div>
              ) : (
                rows.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      inbox.markRead(n.id);
                      setOpen(false);
                      navigate(n.href);
                    }}
                    className={cn(
                      "group relative flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/50",
                      !n.read && "border-l-4 border-l-primary bg-primary/5"
                    )}
                  >
                    <TypeIcon type={n.type} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {TYPE_META[n.type].label} · <Time iso={n.createdAt} />
                      </div>
                      <div className={cn("mt-0.5 text-sm", n.read ? "text-muted-foreground" : "text-foreground")}>
                        <RichText text={n.text} />
                      </div>
                    </div>
                    <div className="absolute right-2 top-2 hidden gap-0.5 rounded-md bg-background shadow-sm group-hover:flex">
                      {tab !== "archived" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title={n.read ? "Mark as unread" : "Mark as read"}
                          onClick={(e) => {
                            e.stopPropagation();
                            n.read ? inbox.markUnread(n.id) : inbox.markRead(n.id);
                          }}
                        >
                          {n.read ? <Circle /> : <CheckCheck />}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title={tab === "archived" ? "Unarchive" : "Archive"}
                        onClick={(e) => {
                          e.stopPropagation();
                          tab === "archived" ? inbox.unarchive(n.id) : inbox.archive(n.id);
                        }}
                      >
                        {tab === "archived" ? <ArchiveRestore /> : <Archive />}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Variant C — "Inbox" nav item opens a full page in the main area
//   badge = UNREAD; opening the page marks everything READ (the ones that were
//   unread keep a "New" tag while you're on the page)
//   category filter chips, Today/Yesterday/Earlier groups, archive per row
// ---------------------------------------------------------------------------

export function VariantC_NavItem({
  inbox,
  open,
  onOpen,
}: {
  inbox: InboxState;
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        open
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <InboxIcon className="size-4" />
      Inbox
      <CountBadge count={inbox.unreadCount} className="ml-auto" />
    </button>
  );
}

function dayGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (d.getTime() >= startToday) return "Today";
  if (d.getTime() >= startToday - 86_400_000) return "Yesterday";
  return "Earlier";
}

export function VariantC_Page({ inbox, onClose }: { inbox: InboxState; onClose: () => void }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("All");
  const [showArchived, setShowArchived] = useState(false);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  // Read-on-view: everything unread when the page opens (or arrives while open) becomes read,
  // but stays tagged "New" until you leave the page.
  useEffect(() => {
    const unread = inbox.items.filter((n) => !n.read).map((n) => n.id);
    if (unread.length === 0) return;
    setNewIds((prev) => new Set([...prev, ...unread]));
    inbox.markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox.items.length, inbox.unreadCount]);

  const source = showArchived ? inbox.archived : inbox.items;
  const categories = ["All", ...new Set(source.map((n) => TYPE_META[n.type].category))];
  const rows = source.filter((n) => filter === "All" || TYPE_META[n.type].category === filter);
  const groups = ["Today", "Yesterday", "Earlier"]
    .map((g) => [g, rows.filter((n) => dayGroup(n.createdAt) === g)] as const)
    .filter(([, list]) => list.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything that happened while you were away.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? <InboxIcon /> : <Archive />}
          {showArchived ? "Back to Inbox" : `Archived (${inbox.archived.length})`}
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              filter === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-24 text-center text-muted-foreground">
          <InboxIcon className="size-12 opacity-30" />
          <div className="text-lg font-medium text-foreground">
            {showArchived ? "Nothing archived" : "Inbox zero"}
          </div>
          <div className="max-w-xs text-sm">
            {showArchived
              ? "Archived Notifications land here."
              : "When a Refund Request, Question, Enrollment or Answer needs you, it'll show up here."}
          </div>
        </div>
      ) : (
        groups.map(([group, list]) => (
          <section key={group} className="mb-8">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</h2>
            <div className="divide-y rounded-xl border">
              {list.map((n) => (
                <div
                  key={n.id}
                  className="group flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-accent/50"
                  onClick={() => {
                    onClose();
                    navigate(n.href);
                  }}
                >
                  <TypeIcon type={n.type} size="sm" />
                  <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                    <RichText text={n.text} />
                  </div>
                  {newIds.has(n.id) && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">
                      New
                    </span>
                  )}
                  <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                    <Time iso={n.createdAt} />
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 group-hover:opacity-100"
                    title={showArchived ? "Unarchive" : "Archive"}
                    onClick={(e) => {
                      e.stopPropagation();
                      showArchived ? inbox.unarchive(n.id) : inbox.archive(n.id);
                    }}
                  >
                    {showArchived ? <ArchiveRestore /> : <Archive />}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Switcher extras: state readout + controls
// ---------------------------------------------------------------------------

export const INBOX_VARIANTS = [
  { key: "A", name: "Header bell + dropdown" },
  { key: "B", name: "Nav item + slide-over" },
  { key: "C", name: "Nav item + full page" },
];

export function InboxPrototypeControls({ inbox }: { inbox: InboxState }) {
  return (
    <div className="flex items-center gap-2 border-l border-white/20 pl-2 text-xs">
      <span className="tabular-nums text-white/70">
        unread <b className="text-white">{inbox.unreadCount}</b> · unseen{" "}
        <b className="text-white">{inbox.unseenCount}</b> · archived{" "}
        <b className="text-white">{inbox.archived.length}</b>
      </span>
      <button onClick={inbox.simulateNew} className="rounded-full bg-white/15 px-2 py-1 hover:bg-white/25">
        + New
      </button>
      <button onClick={inbox.toggleToast} className="rounded-full bg-white/15 px-2 py-1 hover:bg-white/25">
        toast: {inbox.toastOnNew ? "on" : "off"}
      </button>
      <button onClick={inbox.cycleMode} className="rounded-full bg-white/15 px-2 py-1 hover:bg-white/25">
        data: {inbox.mode}
      </button>
    </div>
  );
}
