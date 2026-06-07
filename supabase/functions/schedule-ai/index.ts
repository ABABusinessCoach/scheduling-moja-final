import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DAY_NAMES: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { message, assignments = [], staff = [], clients = [], weekLabel = "" } = body;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          message:
            "The ANTHROPIC_API_KEY secret is not configured. Go to your Supabase dashboard → Edge Functions → Secrets and add ANTHROPIC_API_KEY.",
          actions: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build compact context strings
    const staffLines = staff
      .map(
        (s: any) =>
          `[${s.id}] ${s.name} | T${s.priority_tier} | ${s.employment_type} | ${s.gender} | avail:${
            (s.availability ?? [])
              .map(
                (a: any) =>
                  `Day${a.day_of_week}${a.shift ?? (a.time_start ? ` ${a.time_start}-${a.time_end}` : "")}`
              )
              .join(",") || "none"
          }`
      )
      .join("\n");

    const clientLines = clients
      .map(
        (c: any) =>
          `[${c.id}] ${c.first_name} ${c.last_name}${c.no_male_therapists ? " [F-only]" : ""} | shift:${c.shift_type}`
      )
      .join("\n");

    const assignLines = assignments
      .map((a: any) => {
        const sName = staff.find((s: any) => s.id === a.staff_id)?.name ?? "Unassigned";
        const cl = clients.find((c: any) => c.id === a.client_id);
        const cName = cl ? `${cl.first_name} ${cl.last_name}` : "Unknown";
        return `[${a.id}] ${DAY_NAMES[a.day_of_week] ?? `Day${a.day_of_week}`} ${a.shift} | ${sName} → ${cName}${
          a.violation_reason ? ` ⚠ ${a.violation_reason}` : ""
        }`;
      })
      .join("\n");

    const systemPrompt = `You are a scheduling assistant for Moja Behavioral Services, an ABA therapy center.
Week: ${weekLabel}

STAFF (format: [id] name | tier | type | gender | availability):
${staffLines || "(none)"}

CLIENTS (format: [id] name | restrictions | shift):
${clientLines || "(none)"}

CURRENT ASSIGNMENTS (format: [assignment_id] day shift | Staff → Client):
${assignLines || "(none — no assignments this week)"}

Help manage the weekly schedule. When a staff member is reported absent/out, find ALL their assignments for those days and suggest eligible replacements (respect F-only gender restrictions).

You MUST respond with ONLY valid JSON — no markdown, no code fences, no extra text:
{
  "message": "Friendly, concise explanation using real names not IDs.",
  "actions": [
    {
      "type": "reassign",
      "assignmentId": "exact-uuid-from-data",
      "newStaffId": "exact-uuid-from-data",
      "description": "Short label, e.g. Reassign Mon AM: Maria covers Jordan's slot"
    }
  ]
}

Rules:
- actions can be empty [] for info-only questions.
- Only use IDs that appear verbatim in the data above — never invent them.
- type "reassign" changes staff_id; type "unassign" removes coverage (newStaffId = null).
- If no one can cover a slot, say so in the message but omit that slot from actions.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      return new Response(
        JSON.stringify({
          message: `Anthropic API error (${anthropicRes.status}): ${errBody.slice(0, 200)}`,
          actions: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicData = await anthropicRes.json();
    const rawText =
      anthropicData?.content?.[0]?.type === "text" ? anthropicData.content[0].text : "";

    let parsed: { message: string; actions: any[] };
    try {
      // Strip markdown code fences if Claude wrapped the JSON
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { message: rawText, actions: [] };
    } catch {
      parsed = { message: rawText, actions: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    // Always return 200 so the frontend can display the error gracefully
    return new Response(
      JSON.stringify({
        message: `Something went wrong: ${err?.message ?? "unknown error"}`,
        actions: [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
