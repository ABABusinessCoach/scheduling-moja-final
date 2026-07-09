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
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(
      JSON.stringify({ error: "token query parameter is required." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Load the notification by token, joined with offer + staff + client info
  const { data: notif, error: notifErr } = await supabase
    .from("shift_offer_notifications")
    .select(`
      id, staff_id, response, responded_at,
      offer:shift_offers (
        id, status, day_of_week, time_start, time_end, shift_label, notes, claimed_by_staff_id,
        client:clients (first_name, last_name)
      ),
      staff (id, name, email)
    `)
    .eq("accept_token", token)
    .maybeSingle();

  if (notifErr || !notif) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired link." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const offer = notif.offer as any;
  const staff = notif.staff as any;
  const client = offer?.client as any;

  // --- GET: return shift details so the frontend can display them before accepting ---
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        offer_id: offer.id,
        offer_status: offer.status,
        already_responded: !!notif.response,
        response: notif.response,
        staff_name: staff?.name,
        client_name: client ? `${client.first_name} ${client.last_name}` : "Unknown",
        day_label: DAY_NAMES[offer.day_of_week] ?? `Day ${offer.day_of_week}`,
        time_start: offer.time_start,
        time_end: offer.time_end,
        time_label: `${formatTime12(offer.time_start)} – ${formatTime12(offer.time_end)}`,
        shift_label: offer.shift_label,
        notes: offer.notes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // --- POST: accept the shift ---
  if (req.method === "POST") {
    // Check if offer is still open
    if (offer.status !== "open") {
      return new Response(
        JSON.stringify({
          error: "This shift has already been claimed or cancelled.",
          offer_status: offer.status,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this staff already responded
    if (notif.response) {
      return new Response(
        JSON.stringify({ error: "You have already responded to this offer.", response: notif.response }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    // Update the schedule assignment to assign this staff member
    if (offer.id) {
      // Get the assignment_id from the offer
      const { data: offerRow } = await supabase
        .from("shift_offers")
        .select("assignment_id")
        .eq("id", offer.id)
        .single();

      if (offerRow?.assignment_id) {
        await supabase
          .from("schedule_assignments")
          .update({ staff_id: notif.staff_id, is_manual_override: true, violation_reason: null })
          .eq("id", offerRow.assignment_id);
      }
    }

    // Mark offer as claimed
    await supabase
      .from("shift_offers")
      .update({
        status: "claimed",
        claimed_by_staff_id: notif.staff_id,
        claimed_at: now,
      })
      .eq("id", offer.id);

    // Mark this notification as accepted
    await supabase
      .from("shift_offer_notifications")
      .update({ response: "accepted", responded_at: now })
      .eq("accept_token", token);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Shift accepted! Your supervisor has been notified.",
        staff_name: staff?.name,
        client_name: client ? `${client.first_name} ${client.last_name}` : "Unknown",
        day_label: DAY_NAMES[offer.day_of_week],
        time_label: `${formatTime12(offer.time_start)} – ${formatTime12(offer.time_end)}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ error: "Method not allowed." }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
