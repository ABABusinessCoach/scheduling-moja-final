import React, { useState, useRef, useEffect } from 'react';
import type { ScheduleAssignment, Staff, Client, DayOfWeek, AssignmentShift } from '../../lib/types';
import { Sparkles, X, Send, ChevronDown, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface Action {
  type: 'reassign' | 'unassign';
  assignmentId: string;
  newStaffId?: string | null;
  description: string;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  actions?: Action[];
  appliedActions?: Set<string>;
}

interface ScheduleAssistantProps {
  assignments: ScheduleAssignment[];
  staff: Staff[];
  clients: Client[];
  weekLabel: string;
  onUpdateAssignment: (id: string, staffId: string | null) => Promise<void>;
}

const QUICK_PROMPTS = [
  'Who is available to cover PM shift on Wednesday?',
  'Show me all unassigned sessions this week.',
  'Who has the most sessions assigned?',
];

function buildQuickPrompt(staff: Staff[], clients: Client[]): string[] {
  const prompts = [...QUICK_PROMPTS];
  if (staff.length > 0) {
    const s = staff[Math.floor(Math.random() * staff.length)];
    prompts.unshift(`${s.name} is out Monday — who can cover?`);
  }
  return prompts.slice(0, 4);
}

export function ScheduleAssistant({
  assignments,
  staff,
  clients,
  weekLabel,
  onUpdateAssignment,
}: ScheduleAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [appliedMap, setAppliedMap] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const quickPrompts = React.useMemo(() => buildQuickPrompt(staff, clients), [staff.length, clients.length]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const res = await fetch(`${supabaseUrl}/functions/v1/schedule-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
          Apikey: supabaseKey,
        },
        body: JSON.stringify({
          message: text.trim(),
          assignments: assignments.map((a) => ({
            id: a.id,
            day_of_week: a.day_of_week,
            shift: a.shift,
            staff_id: a.staff_id,
            client_id: a.client_id,
            violation_reason: a.violation_reason,
          })),
          staff: staff.map((s) => ({
            id: s.id,
            name: s.name,
            priority_tier: s.priority_tier,
            employment_type: s.employment_type,
            gender: s.gender,
            availability: s.availability,
          })),
          clients: clients.map((c) => ({
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            no_male_therapists: c.no_male_therapists,
            shift_type: c.shift_type,
          })),
          weekLabel,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        throw new Error(`Server error (${res.status}) — check that the edge function deployed correctly.`);
      }
      if (!data.message) throw new Error('Invalid response from AI');

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.message, actions: data.actions ?? [] },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Sorry, something went wrong: ${err.message}`, actions: [] },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function applyAction(action: Action, msgIndex: number) {
    const key = `${msgIndex}-${action.assignmentId}`;
    setAppliedMap((prev) => ({ ...prev, [key]: true }));
    await onUpdateAssignment(action.assignmentId, action.newStaffId ?? null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold transition-all duration-200 ${
          open
            ? 'bg-slate-700 text-white'
            : 'bg-brand-700 text-white hover:bg-brand-800 hover:shadow-2xl hover:scale-105'
        }`}
      >
        <Sparkles size={16} className={open ? 'opacity-60' : ''} />
        {open ? 'Close AI' : 'AI Assistant'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[420px] max-w-[calc(100vw-24px)] flex flex-col rounded-2xl shadow-2xl border border-slate-200 bg-white overflow-hidden"
          style={{ height: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-brand-700 text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              <span className="font-semibold text-sm">Schedule AI</span>
              <span className="text-xs text-slate-300 font-normal">{weekLabel}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles size={13} className="text-brand-600" />
                  </div>
                  <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 max-w-[88%]">
                    Hi! I can help you manage this week's schedule. Ask me about coverage, absences, or conflicts — I'll suggest specific changes you can apply with one click.
                  </div>
                </div>

                {/* Quick prompts */}
                <div className="space-y-1.5 pl-9">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Try asking:</p>
                  {quickPrompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-slate-50 hover:bg-aqua-50 hover:text-aqua-700 text-sm text-slate-600 border border-slate-200 hover:border-aqua-300 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles size={13} className="text-brand-600" />
                  </div>
                )}
                <div className={`max-w-[88%] space-y-2 ${msg.role === 'user' ? 'items-end flex flex-col' : ''}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-brand-700 text-white rounded-tr-sm'
                      : 'bg-slate-50 text-slate-700 rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>

                  {/* Action chips */}
                  {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                    <div className="space-y-1.5">
                      {msg.actions.map((action, ai) => {
                        const key = `${i}-${action.assignmentId}`;
                        const applied = appliedMap[key];
                        return (
                          <button
                            key={ai}
                            onClick={() => !applied && applyAction(action, i)}
                            disabled={applied}
                            className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                              applied
                                ? 'bg-aqua-50 border-aqua-200 text-aqua-600 cursor-default'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-accent-50 hover:border-accent-300 hover:text-accent-700 cursor-pointer'
                            }`}
                          >
                            {applied
                              ? <CheckCircle2 size={13} className="text-aqua-500 flex-shrink-0" />
                              : <div className="w-3 h-3 rounded border-2 border-slate-300 flex-shrink-0" />
                            }
                            <span className="flex-1 truncate">{action.description}</span>
                            {!applied && (
                              <span className="text-accent-500 font-semibold flex-shrink-0">Apply</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={13} className="text-brand-600" />
                </div>
                <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <Loader2 size={14} className="text-slate-400 animate-spin" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 px-3 py-3 flex-shrink-0">
            <div className="flex items-end gap-2 bg-slate-50 rounded-xl border border-slate-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Maria is out Thursday, who can cover?"
                rows={1}
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 resize-none outline-none leading-relaxed"
                style={{ maxHeight: '96px' }}
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-700 text-white flex items-center justify-center transition-all hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={13} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      )}
    </>
  );
}
