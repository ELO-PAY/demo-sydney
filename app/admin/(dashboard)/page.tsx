import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inquiryLabel,
  statusLabel,
  PIPELINE_STAGES,
} from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { updateContactStatus } from "./actions";

// Always fresh — this is a live operational view.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DAY = 86400000;
const HOUR = 3600000;
const SLA_HOURS = 24; // first-call SLA: call every new enquiry within 24 hours
const OPEN_MIDDLE = ["contacted", "discovery_call", "proposal"];

// A short "how long since it landed" label against the 24h first-call SLA.
function slaLabel(iso: string, now: number): { text: string; overdue: boolean } {
  const ms = now - new Date(iso).getTime();
  const hrs = ms / HOUR;
  if (hrs > SLA_HOURS) {
    const over = Math.floor((ms - SLA_HOURS * HOUR) / HOUR);
    return {
      text: over >= 24 ? `${Math.floor(over / 24)}d overdue` : `${over}h overdue`,
      overdue: true,
    };
  }
  const left = Math.max(0, Math.ceil((SLA_HOURS * HOUR - ms) / HOUR));
  return { text: `${left}h left`, overdue: false };
}

type Contact = {
  id: string;
  person_id: string;
  type: string;
  status: string;
  created_at: string;
  people: { id: string; name: string | null; company: string | null } | null;
};
type Activity = { contact_id: string; to_status: string | null; created_at: string };
type Order = { amount_cents: number; status: string; created_at: string };

function daysAgo(iso: string, now: number): number {
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

// A KPI tile with a week-over-week delta.
function Kpi({
  label,
  value,
  delta,
  goodUp = true,
  hint,
}: {
  label: string;
  value: string;
  delta?: number;
  goodUp?: boolean;
  hint?: string;
}) {
  let cls = "kpi-delta";
  let text = "vs prev 7d";
  if (typeof delta === "number") {
    if (delta > 0) {
      cls += goodUp ? " up" : " down";
      text = `▲ ${delta} vs prev 7d`;
    } else if (delta < 0) {
      cls += goodUp ? " down" : " up";
      text = `▼ ${Math.abs(delta)} vs prev 7d`;
    } else {
      text = "no change vs prev 7d";
    }
  }
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint ? (
        <div className="kpi-delta">{hint}</div>
      ) : (
        <div className={cls}>{text}</div>
      )}
    </div>
  );
}

// A quarter-over-quarter change cell (absolute + percent).
function ChangeCell({
  cur,
  prev,
  money = false,
}: {
  cur: number;
  prev: number;
  money?: boolean;
}) {
  const d = cur - prev;
  const pct = prev > 0 ? Math.round((d / prev) * 100) : null;
  const cls = d > 0 ? "kpi-delta up" : d < 0 ? "kpi-delta down" : "kpi-delta";
  const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "–";
  const mag = money ? formatMoney(Math.abs(d)) : String(Math.abs(d));
  if (d === 0) return <span className="kpi-delta">no change</span>;
  return (
    <span className={cls}>
      {arrow} {mag}
      {pct !== null ? ` (${d > 0 ? "+" : "-"}${Math.abs(pct)}%)` : ""}
    </span>
  );
}

// Compact inline "move stage" control reused in the attention lists.
function MoveControl({
  contactId,
  personId,
  status,
}: {
  contactId: string;
  personId: string;
  status: string;
}) {
  return (
    <form action={updateContactStatus} className="move-inline">
      <input type="hidden" name="contact_id" value={contactId} />
      <input type="hidden" name="person_id" value={personId} />
      <select name="to_status" defaultValue={status} aria-label="Move to stage">
        {PIPELINE_STAGES.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </select>
      <button type="submit" className="btn btn-sm">
        Save
      </button>
    </form>
  );
}

export default async function DashboardPage() {
  const supabase = createAdminClient();
  const [{ data: cData, error: cErr }, { data: aData }, { data: oData }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select(
          "id, person_id, type, status, created_at, people ( id, name, company )"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_log")
        .select("contact_id, to_status, created_at"),
      supabase.from("orders").select("amount_cents, status, created_at"),
    ]);

  if (cErr) {
    return (
      <div className="empty">
        <p>Couldn&apos;t load the dashboard: {cErr.message}</p>
      </div>
    );
  }

  const contacts = (cData ?? []) as unknown as Contact[];
  const activity = (aData ?? []) as Activity[];
  const orders = (oData ?? []) as Order[];
  const now = Date.now();
  const wk = 7 * DAY;

  // Last activity per contact = max(created_at, latest logged change).
  const lastActivity = new Map<string, number>();
  for (const c of contacts) lastActivity.set(c.id, new Date(c.created_at).getTime());
  for (const a of activity) {
    const t = new Date(a.created_at).getTime();
    const prev = lastActivity.get(a.contact_id) ?? 0;
    if (t > prev) lastActivity.set(a.contact_id, t);
  }

  const inWindow = (iso: string, startAgo: number, endAgo: number) => {
    const t = new Date(iso).getTime();
    return t >= now - startAgo && t < now - endAgo;
  };

  // ---- KPIs (last 7d vs previous 7d) ----
  const newThis = contacts.filter((c) => inWindow(c.created_at, wk, 0)).length;
  const newPrev = contacts.filter((c) => inWindow(c.created_at, 2 * wk, wk)).length;

  const wonThis = activity.filter(
    (a) => a.to_status === "won" && inWindow(a.created_at, wk, 0)
  ).length;
  const wonPrev = activity.filter(
    (a) => a.to_status === "won" && inWindow(a.created_at, 2 * wk, wk)
  ).length;

  const movesThis = activity.filter((a) => inWindow(a.created_at, wk, 0)).length;
  const movesPrev = activity.filter((a) => inWindow(a.created_at, 2 * wk, wk)).length;

  const revThis = orders
    .filter((o) => o.status === "paid" && inWindow(o.created_at, wk, 0))
    .reduce((s, o) => s + (o.amount_cents ?? 0), 0);
  const revPrev = orders
    .filter((o) => o.status === "paid" && inWindow(o.created_at, 2 * wk, wk))
    .reduce((s, o) => s + (o.amount_cents ?? 0), 0);

  // ---- Needs attention ----
  const toContact = contacts
    .filter((c) => c.status === "new_lead")
    .sort((a, b) => a.created_at.localeCompare(b.created_at)); // oldest first
  const slaBreached = toContact.filter(
    (c) => now - new Date(c.created_at).getTime() > SLA_HOURS * HOUR
  ).length;

  const goingCold = contacts
    .filter(
      (c) =>
        OPEN_MIDDLE.includes(c.status) &&
        (lastActivity.get(c.id) ?? 0) < now - wk
    )
    .sort(
      (a, b) => (lastActivity.get(a.id) ?? 0) - (lastActivity.get(b.id) ?? 0)
    ); // coldest first

  // ---- Pipeline snapshot ----
  const byStage: Record<string, number> = {};
  for (const s of PIPELINE_STAGES) byStage[s] = 0;
  for (const c of contacts) byStage[c.status] = (byStage[c.status] ?? 0) + 1;
  const maxStage = Math.max(1, ...PIPELINE_STAGES.map((s) => byStage[s]));

  // ---- 8-week trend (7-day buckets, oldest→newest) ----
  const BUCKETS = 8;
  const trend = Array.from({ length: BUCKETS }, () => ({ inq: 0, won: 0 }));
  const bucketOf = (iso: string) => {
    const age = (now - new Date(iso).getTime()) / wk;
    const idx = BUCKETS - 1 - Math.floor(age);
    return idx >= 0 && idx < BUCKETS ? idx : -1;
  };
  for (const c of contacts) {
    const b = bucketOf(c.created_at);
    if (b >= 0) trend[b].inq++;
  }
  for (const a of activity) {
    if (a.to_status !== "won") continue;
    const b = bucketOf(a.created_at);
    if (b >= 0) trend[b].won++;
  }
  const maxTrend = Math.max(1, ...trend.map((t) => t.inq));

  const rangeLabel = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
  });
  const weekText = `${rangeLabel.format(now - wk)} – ${rangeLabel.format(now)}`;

  // ---- Quarter view (this quarter-to-date vs the same point last quarter) ----
  const rangeMetrics = (start: number, end: number) => {
    const within = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= start && t < end;
    };
    return {
      newInq: contacts.filter((c) => within(c.created_at)).length,
      won: activity.filter((a) => a.to_status === "won" && within(a.created_at))
        .length,
      revenue: orders
        .filter((o) => o.status === "paid" && within(o.created_at))
        .reduce((s, o) => s + (o.amount_cents ?? 0), 0),
    };
  };

  // Quarter boundaries from the current month in Sydney time. Boundaries are
  // taken at UTC midnight — within hours of Sydney's, immaterial for monthly counts.
  const sydParts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date(now));
  const yr = Number(sydParts.find((p) => p.type === "year")!.value);
  const mo = Number(sydParts.find((p) => p.type === "month")!.value) - 1; // 0-based
  const qStartMo = Math.floor(mo / 3) * 3;
  const thisQStart = Date.UTC(yr, qStartMo, 1);
  const lastQStart =
    qStartMo === 0 ? Date.UTC(yr - 1, 9, 1) : Date.UTC(yr, qStartMo - 3, 1);
  const elapsed = now - thisQStart;
  const daysElapsed = Math.max(1, Math.round(elapsed / DAY));

  const thisQTD = rangeMetrics(thisQStart, now + 1);
  const lastQSame = rangeMetrics(lastQStart, lastQStart + elapsed);
  const lastQFull = rangeMetrics(lastQStart, thisQStart);

  const qNum = Math.floor(qStartMo / 3) + 1;
  const lastQNum = qNum === 1 ? 4 : qNum - 1;
  const lastQYr = qNum === 1 ? yr - 1 : yr;

  return (
    <>
      <h1>This week</h1>
      <p className="count">
        Your weekly view · last 7 days ({weekText}). Work the{" "}
        <b>Needs your attention</b> list, then check the trend.
      </p>

      {/* ---- KPI row ---- */}
      <div className="kpi-grid">
        <Kpi label="New inquiries" value={String(newThis)} delta={newThis - newPrev} />
        <Kpi label="Deals won" value={String(wonThis)} delta={wonThis - wonPrev} />
        <Kpi
          label="Actions logged"
          value={String(movesThis)}
          delta={movesThis - movesPrev}
        />
        <Kpi
          label="Revenue (paid)"
          value={formatMoney(revThis)}
          delta={
            revThis === revPrev ? 0 : Math.round((revThis - revPrev) / 100)
          }
        />
      </div>

      {/* ---- Needs attention ---- */}
      <div className="dash-cols">
        <section className="panel">
          <h2>
            New leads to call{" "}
            <span className="pill">{toContact.length}</span>
          </h2>
          <p className="muted" style={{ marginTop: -8 }}>
            First-call SLA: within {SLA_HOURS}h of enquiry.
            {slaBreached > 0 && (
              <>
                {" "}
                <b className="age-hot">{slaBreached} over SLA.</b>
              </>
            )}
          </p>
          {toContact.length === 0 ? (
            <p className="muted">Nothing waiting — every new lead has been called. 🎉</p>
          ) : (
            <ul className="attn-list">
              {toContact.slice(0, 8).map((c) => {
                const sla = slaLabel(c.created_at, now);
                return (
                  <li key={c.id} className="attn">
                    <div className="attn-main">
                      <Link href={`/admin/people/${c.person_id}`}>
                        {c.people?.name || "Unknown"}
                      </Link>
                      <span className="attn-sub">
                        {inquiryLabel(c.type)}
                        {c.people?.company ? ` · ${c.people.company}` : ""}
                      </span>
                    </div>
                    <span className={`age ${sla.overdue ? "age-hot" : ""}`}>
                      {sla.text}
                    </span>
                    <MoveControl
                      contactId={c.id}
                      personId={c.person_id}
                      status={c.status}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {toContact.length > 8 && (
            <p className="muted more">
              +{toContact.length - 8} more ·{" "}
              <Link href="/admin/pipeline">see all in Pipeline</Link>
            </p>
          )}
        </section>

        <section className="panel">
          <h2>
            Going cold <span className="pill">{goingCold.length}</span>
          </h2>
          <p className="muted" style={{ marginTop: -8 }}>
            Open deals with no activity in 7+ days.
          </p>
          {goingCold.length === 0 ? (
            <p className="muted">Nothing stalled. Your pipeline is warm. 👍</p>
          ) : (
            <ul className="attn-list">
              {goingCold.slice(0, 8).map((c) => {
                const age = daysAgo(
                  new Date(lastActivity.get(c.id) ?? now).toISOString(),
                  now
                );
                return (
                  <li key={c.id} className="attn">
                    <div className="attn-main">
                      <Link href={`/admin/people/${c.person_id}`}>
                        {c.people?.name || "Unknown"}
                      </Link>
                      <span className="attn-sub">
                        <span className={`badge badge-status status-${c.status}`}>
                          {statusLabel(c.status)}
                        </span>
                        {c.people?.company ? ` ${c.people.company}` : ""}
                      </span>
                    </div>
                    <span className="age age-hot">{age}d quiet</span>
                    <MoveControl
                      contactId={c.id}
                      personId={c.person_id}
                      status={c.status}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {goingCold.length > 8 && (
            <p className="muted more">
              +{goingCold.length - 8} more ·{" "}
              <Link href="/admin/pipeline">see all in Pipeline</Link>
            </p>
          )}
        </section>
      </div>

      {/* ---- Pipeline snapshot ---- */}
      <section className="panel">
        <h2>Pipeline snapshot</h2>
        <div className="funnel">
          {PIPELINE_STAGES.map((s) => (
            <div key={s} className="funnel-row">
              <span className="funnel-label">{statusLabel(s)}</span>
              <div className="funnel-track">
                <div
                  className={`funnel-bar status-${s}`}
                  style={{ width: `${(byStage[s] / maxStage) * 100}%` }}
                />
              </div>
              <span className="funnel-count">{byStage[s]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- 8-week trend ---- */}
      <section className="panel">
        <h2>8-week trend</h2>
        <p className="muted" style={{ marginTop: -8 }}>
          Inquiries per week (bars) with deals won (dot). Newest week on the right.
        </p>
        <div className="trend">
          {trend.map((t, i) => (
            <div key={i} className="trend-col">
              <div className="trend-bar-wrap">
                {t.won > 0 && (
                  <span className="trend-won" title={`${t.won} won`}>
                    {t.won}
                  </span>
                )}
                <div
                  className="trend-bar"
                  style={{ height: `${(t.inq / maxTrend) * 100}%` }}
                  title={`${t.inq} inquiries`}
                />
              </div>
              <span className="trend-num">{t.inq}</span>
              <span className="trend-x">
                {i === BUCKETS - 1 ? "this wk" : `-${BUCKETS - 1 - i}`}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Quarter view ---- */}
      <section className="panel">
        <h2>
          Quarter view{" "}
          <span
            className="muted"
            style={{ fontWeight: 400, fontSize: 14 }}
          >
            · Q{qNum} {yr} so far
          </span>
        </h2>
        <p className="muted" style={{ marginTop: -8 }}>
          First {daysElapsed} days of Q{qNum} {yr} vs the same {daysElapsed}{" "}
          days of Q{lastQNum} {lastQYr}.
        </p>
        <div className="table-wrap">
          <table className="table qtr-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>
                  Q{qNum} to date
                </th>
                <th>
                  Q{lastQNum} same point
                </th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>New inquiries</td>
                <td>{thisQTD.newInq}</td>
                <td>{lastQSame.newInq}</td>
                <td>
                  <ChangeCell cur={thisQTD.newInq} prev={lastQSame.newInq} />
                </td>
              </tr>
              <tr>
                <td>Deals won</td>
                <td>{thisQTD.won}</td>
                <td>{lastQSame.won}</td>
                <td>
                  <ChangeCell cur={thisQTD.won} prev={lastQSame.won} />
                </td>
              </tr>
              <tr>
                <td>Revenue (paid)</td>
                <td>{formatMoney(thisQTD.revenue)}</td>
                <td>{formatMoney(lastQSame.revenue)}</td>
                <td>
                  <ChangeCell
                    cur={thisQTD.revenue}
                    prev={lastQSame.revenue}
                    money
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted more">
          For context — full Q{lastQNum} {lastQYr}: {lastQFull.newInq}{" "}
          inquiries · {lastQFull.won} won · {formatMoney(lastQFull.revenue)}.
        </p>
      </section>
    </>
  );
}
