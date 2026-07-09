import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DAY_NAMES: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday",
  4: "Thursday", 5: "Friday", 6: "Saturday",
};

function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function buildEmailHtml(params: {
  staffName: string;
  clientName: string;
  dayLabel: string;
  timeStart: string;
  timeEnd: string;
  shiftLabel: string;
  notes: string;
  acceptUrl: string;
}): string {
  const { staffName, clientName, dayLabel, timeStart, timeEnd, shiftLabel, notes, acceptUrl } = params;
  const timeLabel = `${formatTime12(timeStart)} – ${formatTime12(timeEnd)}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Open Shift Available</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0f172a;padding:24px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:4px;">MOJA Behavioral</div>
      <div style="font-size:20px;font-weight:700;color:#fff;">Open Shift Available</div>
      <div style="font-size:14px;color:#6dccc2;margin-top:4px;">A session is available — let us know if you can cover it.</div>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 20px;color:#475569;font-size:14px;">Hi ${staffName},</p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#16a34a;font-weight:600;margin-bottom:10px;">Shift Details</div>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:80px;">Client</td><td style="padding:4px 0;color:#0f172a;font-weight:600;font-size:13px;">${clientName}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Day</td><td style="padding:4px 0;color:#0f172a;font-weight:600;font-size:13px;">${dayLabel}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Time</td><td style="padding:4px 0;color:#0f172a;font-weight:600;font-size:13px;">${timeLabel}</td></tr>
          ${shiftLabel ? `<tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Shift</td><td style="padding:4px 0;color:#0f172a;font-size:13px;">${shiftLabel}</td></tr>` : ""}
        </table>
      </div>

      ${notes ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#92400e;"><strong>Note:</strong> ${notes}</div>` : ""}

      <p style="margin:0 0 20px;color:#475569;font-size:14px;">If this shift works for your schedule, click the button below to accept it. First to respond gets the shift.</p>

      <div style="text-align:center;margin-bottom:20px;">
        <a href="${acceptUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:0.3px;">
          Accept This Shift
        </a>
      </div>

      <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
        This offer expires once another staff member claims it. Contact your supervisor with questions.
      </p>
    </div>

    <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
      MOJA Behavioral Services — Shift Notification
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured. Add it in Supabase > Edge Functions > Secrets." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json() as {
    assignment_id: string;
    staff_ids: string[];
    notes?: string;
    app_url: string;
  };

  const { assignment_id, staff_ids, notes = "", app_url } = body;

  if (!assignment_id || !staff_ids?.length || !app_url) {
    return new Response(
      JSON.stringify({ error: "assignment_id, staff_ids, and app_url are required." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Load the assignment with client info
  const { data: assignment, error: assignErr } = await supabase
    .from("schedule_assignments")
    .select("*, clients(id, first_name, last_name), schedules(id)")
    .eq("id", assignment_id)
    .single();

  if (assignErr || !assignment) {
    return new Response(
      JSON.stringify({ error: "Assignment not found." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const client = assignment.clients as { id: string; first_name: string; last_name: string };
  const clientName = `${client.first_name} ${client.last_name}`;

  // Create the shift offer record
  const { data: offer, error: offerErr } = await supabase
    .from("shift_offers")
    .insert({
      schedule_id: assignment.schedule_id,
      assignment_id: assignment.id,
      client_id: client.id,
      day_of_week: assignment.day_of_week,
      time_start: (assignment.time_start ?? "").slice(0, 5),
      time_end: (assignment.time_end ?? "").slice(0, 5),
      shift_label: assignment.shift ?? "",
      notes,
      status: "open",
    })
    .select()
    .single();

  if (offerErr || !offer) {
    return new Response(
      JSON.stringify({ error: "Failed to create shift offer." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create per-staff notification records (unique tokens)
  const notifInserts = staff_ids.map((sid) => ({ offer_id: offer.id, staff_id: sid }));
  const { data: notifications, error: notifErr } = await supabase
    .from("shift_offer_notifications")
    .insert(notifInserts)
    .select("id, staff_id, accept_token");

  if (notifErr || !notifications) {
    return new Response(
      JSON.stringify({ error: "Failed to create notifications." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Load staff with emails
  const { data: staffList } = await supabase
    .from("staff")
    .select("id, name, email")
    .in("id", staff_ids);

  const dayLabel = DAY_NAMES[assignment.day_of_week] ?? `Day ${assignment.day_of_week}`;
  const results: { name: string; email: string; status: string }[] = [];

  for (const notif of notifications) {
    const staffMember = (staffList ?? []).find((s: any) => s.id === notif.staff_id);
    if (!staffMember?.email) {
      results.push({ name: staffMember?.name ?? notif.staff_id, email: "", status: "skipped (no email)" });
      continue;
    }

    const acceptUrl = `${app_url}?accept=${notif.accept_token}`;
    const html = buildEmailHtml({
      staffName: staffMember.name,
      clientName,
      dayLabel,
      timeStart: (assignment.time_start ?? "").slice(0, 5),
      timeEnd: (assignment.time_end ?? "").slice(0, 5),
      shiftLabel: assignment.shift ?? "",
      notes,
      acceptUrl,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "MOJA Behavioral <schedule@mojabehavioral.com>",
        to: [staffMember.email],
        subject: `Open shift available — ${dayLabel} ${formatTime12((assignment.time_start ?? "").slice(0, 5))}`,
        html,
      }),
    });

    results.push({
      name: staffMember.name,
      email: staffMember.email,
      status: res.ok ? "sent" : `failed (${res.status})`,
    });
  }

  return new Response(
    JSON.stringify({ offer_id: offer.id, notified: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
