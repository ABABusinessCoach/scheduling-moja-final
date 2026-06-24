import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

const DAY_NAMES: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
};

function buildEmailHtml(staffName: string, weekLabel: string, days: { day: number; date: string; sessions: { clientName: string; start: string; end: string }[] }[]): string {
  const dayRows = days.map(({ day, date, sessions }) => {
    const sessionRows = sessions.length
      ? sessions.map(s => `<tr><td style="padding:4px 8px;color:#475569;">${formatTime12(s.start)} – ${formatTime12(s.end)}</td><td style="padding:4px 8px;color:#1e293b;font-weight:500;">${s.clientName}</td></tr>`).join("")
      : `<tr><td colspan="2" style="padding:4px 8px;color:#94a3b8;font-style:italic;">No sessions</td></tr>`;
    return `
      <tr style="vertical-align:top;border-top:1px solid #e2e8f0;">
        <td style="padding:10px 12px;font-weight:600;color:#0f172a;white-space:nowrap;min-width:100px;">${DAY_NAMES[day]}<br><span style="font-weight:400;font-size:12px;color:#64748b;">${date}</span></td>
        <td style="padding:6px 0;">
          <table style="border-collapse:collapse;width:100%;">${sessionRows}</table>
        </td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Your Schedule – ${weekLabel}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0f172a;padding:24px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:4px;">MOJA Behavioral</div>
      <div style="font-size:20px;font-weight:700;color:#fff;">Your Schedule</div>
      <div style="font-size:14px;color:#94a3b8;margin-top:4px;">${weekLabel}</div>
    </div>
    <div style="padding:20px 24px;">
      <p style="margin:0 0 16px;color:#475569;font-size:14px;">Hi ${staffName}, here is your schedule for the week.</p>
      <table style="border-collapse:collapse;width:100%;">
        ${dayRows}
      </table>
    </div>
    <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
      This schedule was sent automatically. Contact your supervisor with any questions.
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured. Add it in Supabase > Edge Functions > Secrets." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = await req.json();
  const { week_start, staff_ids } = body as { week_start: string; staff_ids?: string[] };

  if (!week_start) {
    return new Response(JSON.stringify({ error: "week_start is required (YYYY-MM-DD)" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load schedule
  const { data: scheduleRow } = await supabase
    .from("schedules")
    .select("id")
    .eq("week_start_date", week_start)
    .maybeSingle();

  if (!scheduleRow) {
    return new Response(JSON.stringify({ error: "No schedule found for this week." }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load assignments with client info
  const { data: assignments } = await supabase
    .from("schedule_assignments")
    .select("*, clients(first_name, last_name)")
    .eq("schedule_id", scheduleRow.id)
    .not("staff_id", "is", null);

  // Load staff
  let staffQuery = supabase.from("staff").select("id, name, email").eq("is_active", true).not("email", "is", null);
  if (staff_ids?.length) staffQuery = staffQuery.in("id", staff_ids);
  const { data: staffList } = await staffQuery;

  if (!staffList?.length) {
    return new Response(JSON.stringify({ error: "No staff with email addresses found." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build week date map (Mon=1 .. Sat=6)
  const mondayDate = new Date(week_start + "T00:00:00");
  const dayDates: Record<number, string> = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + (i < 5 ? i : 5));
    const dow = i + 1;
    dayDates[dow] = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const weekEnd = new Date(mondayDate);
  weekEnd.setDate(weekEnd.getDate() + 4);
  const weekLabel = `${mondayDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const results: { name: string; email: string; status: string }[] = [];

  for (const s of staffList) {
    if (!s.email) continue;

    const staffAssignments = (assignments ?? []).filter((a: any) => a.staff_id === s.id);
    const days = ([1, 2, 3, 4, 5] as number[]).map((dow) => {
      const dayAssignments = staffAssignments.filter((a: any) => a.day_of_week === dow);
      const sessions = dayAssignments
        .map((a: any) => ({
          clientName: `${a.clients?.first_name ?? ""} ${a.clients?.last_name ?? ""}`.trim(),
          start: (a.time_start ?? "").slice(0, 5),
          end: (a.time_end ?? "").slice(0, 5),
        }))
        .filter((s) => s.start && s.end)
        .sort((a, b) => a.start.localeCompare(b.start));
      return { day: dow, date: dayDates[dow], sessions };
    });

    const html = buildEmailHtml(s.name, weekLabel, days);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "MOJA Behavioral <schedule@mojabehavioral.com>",
        to: [s.email],
        subject: `Your schedule: ${weekLabel}`,
        html,
      }),
    });

    results.push({ name: s.name, email: s.email, status: res.ok ? "sent" : `failed (${res.status})` });
  }

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
