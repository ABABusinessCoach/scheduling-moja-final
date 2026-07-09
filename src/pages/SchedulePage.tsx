import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSchedule } from '../contexts/ScheduleContext';
import type { DayOfWeek, RatioAlert } from '../lib/types';
import { DAY_NAMES } from '../lib/types';
import { generateWeeklySchedule } from '../lib/scheduler';
import { format, addDays, getMonday } from '../lib/dateUtils';
import { WeeklyGrid } from '../components/schedule/WeeklyGrid';
import { StaffView } from '../components/schedule/StaffView';
import { ClientView } from '../components/schedule/ClientView';
import { TimelineGrid } from '../components/schedule/TimelineGrid';
import { DailyView } from '../components/schedule/DailyView';
import { SupervisionTracker } from '../components/schedule/SupervisionTracker';
import { ShiftManager } from '../components/schedule/ShiftManager';
import { GapFillerModal } from '../components/schedule/GapFillerModal';
import { SendScheduleModal } from '../components/schedule/SendScheduleModal';
import { ManualBuilderView } from '../components/schedule/ManualBuilderView';
import { useToast } from '../lib/toast';
import { ShiftOffersView } from '../components/schedule/ShiftOffersView';
import {
  ChevronLeft,
  ChevronRight,
  Wand2,
  CalendarDays,
  Users,
  UserRound,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  FileText,
  X,
  Settings2,
  Hammer,
  RotateCcw,
  Send,
  Bell,
  Sun,
} from 'lucide-react';

type ViewMode = 'timeline' | 'daily' | 'grid' | 'staff' | 'client' | 'builder' | 'offers';

export function SchedulePage() {
  const {
    currentMonday,
    setCurrentMonday,
    weekLabel,
    staff,
    clients,
    effectiveStaff,
    effectiveClients,
    activeSeason,
    allRestrictions,
    schedule,
    assignments,
    sessionNotes,
    ratioAlerts,
    shifts,
    shiftsForWeek,
    breakTimes,
    timeOffForWeek,
    loading,
    refreshSchedule,
    refreshShiftsAndBreaks,
    handleUpdateAssignment,
    handleInsertAssignment,
    handleMoveAssignment,
    handleDeleteAssignment,
    handleUpdateEndTime,
    handleToggleNote,
  } = useSchedule();

  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(1);
  const [generating, setGenerating] = useState(false);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [gapAlert, setGapAlert] = useState<RatioAlert | null>(null);
  const [showShiftManager, setShowShiftManager] = useState(false);
  const [startingOver, setStartingOver] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const showToast = useToast();

  async function generateSchedule() {
    if (staff.length === 0 || clients.length === 0) {
      showToast('Add staff and clients before generating a schedule.', 'error');
      return;
    }
    if (schedule?.status === 'published') {
      const ok = window.confirm(
        'This schedule is already published. Regenerating will delete all current assignments and create a new draft. Continue?'
      );
      if (!ok) return;
    }
    setGenerating(true);
    const weekStr = format(currentMonday, 'yyyy-MM-dd');
    let scheduleId: string;

    try {
      const { data: existing } = await supabase
        .from('schedules')
        .select('id')
        .eq('week_start_date', weekStr)
        .maybeSingle();

      if (existing) {
        scheduleId = existing.id;
        await supabase.from('schedule_assignments').delete().eq('schedule_id', scheduleId);
        await supabase.from('schedules').update({ status: 'draft' }).eq('id', scheduleId);
      } else {
        const { data: newSched, error } = await supabase
          .from('schedules')
          .insert({ week_start_date: weekStr, status: 'draft' })
          .select()
          .single();
        if (error || !newSched) throw new Error(error?.message ?? 'Failed to create schedule');
        scheduleId = newSched.id;
      }

      const generated = generateWeeklySchedule(
        scheduleId,
        effectiveStaff,
        effectiveClients,
        allRestrictions,
        1,
        weekStr,
        timeOffForWeek,
        shiftsForWeek
      );
      if (generated.length > 0) {
        const { error: insertError } = await supabase.from('schedule_assignments').insert(generated);
        if (insertError) throw new Error(insertError.message);
      }
      await refreshSchedule();
      showToast('Schedule generated.');
    } catch {
      showToast('Failed to generate schedule. Please try again.', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function publishSchedule() {
    if (!schedule) return;
    const { error } = await supabase.from('schedules').update({ status: 'published' }).eq('id', schedule.id);
    if (error) {
      showToast('Failed to publish schedule.', 'error');
    } else {
      showToast('Schedule published.');
      await refreshSchedule();
    }
  }

  async function startOver() {
    if (!schedule) return;
    const ok = window.confirm('This will delete all current assignments and reset the schedule to a blank draft. Continue?');
    if (!ok) return;
    setStartingOver(true);
    try {
      await supabase.from('schedule_assignments').delete().eq('schedule_id', schedule.id);
      await supabase.from('schedules').update({ status: 'draft' }).eq('id', schedule.id);
      await refreshSchedule();
      setViewMode('builder');
      showToast('Schedule cleared. Add assignments manually using the Builder.');
    } catch {
      showToast('Failed to clear schedule.', 'error');
    } finally {
      setStartingOver(false);
    }
  }

  const violationCount = assignments.filter((a) => a.violation_reason).length;
  const unassignedCount = assignments.filter((a) => !a.staff_id).length;
  const missingNotesCount = assignments.filter((a) => {
    const note = sessionNotes.find((n) => n.assignment_id === a.id);
    return !note?.submitted;
  }).length;

  const VIEW_TABS = [
    { id: 'timeline', icon: <Clock size={14} />, label: 'Timeline' },
    { id: 'daily',    icon: <Calendar size={14} />, label: 'Daily' },
    { id: 'grid',     icon: <CalendarDays size={14} />, label: 'Grid' },
    { id: 'staff',    icon: <Users size={14} />, label: 'By Staff' },
    { id: 'client',   icon: <UserRound size={14} />, label: 'By Client' },
    { id: 'builder',  icon: <Hammer size={14} />, label: 'Builder' },
    { id: 'offers',   icon: <Bell size={14} />, label: 'Offers', badge: unassignedCount > 0 ? unassignedCount : undefined },
  ];

  const sharedProps = {
    assignments,
    staff: effectiveStaff,
    clients: effectiveClients,
    sessionNotes,
    onUpdateAssignment: handleUpdateAssignment,
    onMoveAssignment: handleMoveAssignment,
    onDeleteAssignment: handleDeleteAssignment,
    onUpdateEndTime: handleUpdateEndTime,
    onToggleNote: handleToggleNote,
  };

  return (
    <div className="flex gap-5 h-full">
      <div className="flex-1 min-w-0">
        {/* Season banner */}
        {activeSeason && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl text-sm font-medium bg-amber-50 border border-amber-200 text-amber-800">
            <Sun size={14} className="text-amber-500 flex-shrink-0" />
            <span><strong>{activeSeason.name}</strong> is active — seasonal availability overrides are applied.</span>
          </div>
        )}

        {/* Week nav */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonday((p) => addDays(p, -7))}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <div className="font-semibold text-slate-900 text-sm">{weekLabel}</div>
              <button
                onClick={() => setCurrentMonday(getMonday(new Date()))}
                className="text-xs text-aqua-500 hover:text-aqua-600 transition-colors"
              >
                This week
              </button>
            </div>
            <button
              onClick={() => setCurrentMonday((p) => addDays(p, 7))}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {schedule && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                schedule.status === 'published' ? 'bg-aqua-100 text-aqua-600' : 'bg-amber-100 text-amber-700'
              }`}>
                {schedule.status === 'published' ? 'Published' : 'Draft'}
              </span>
            )}
            {violationCount > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <AlertTriangle size={12} /> {violationCount} violation{violationCount !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={() => setShowShiftManager(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition-colors"
            >
              <Settings2 size={15} /> Shifts
            </button>
            {schedule && schedule.status !== 'published' && (
              <button
                onClick={publishSchedule}
                className="flex items-center gap-1.5 px-3 py-2 bg-aqua-50 hover:bg-aqua-100 text-aqua-600 rounded-xl text-sm font-semibold transition-colors"
              >
                <CheckCircle2 size={15} /> Publish
              </button>
            )}
            {schedule && (
              <button
                onClick={() => setShowSendModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition-colors"
              >
                <Send size={15} /> Send
              </button>
            )}
            {schedule && (
              <button
                onClick={startOver}
                disabled={startingOver}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
              >
                <RotateCcw size={15} /> Start Over
              </button>
            )}
            <button
              onClick={generateSchedule}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            >
              <Wand2 size={15} />
              {generating ? 'Generating…' : schedule ? 'Regenerate' : 'Smart Schedule'}
            </button>
          </div>
        </div>

        {/* Ratio alerts */}
        {ratioAlerts.length > 0 && !alertsDismissed && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
                  <span className="text-sm font-semibold text-red-800">Staffing Gap Detected</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ratioAlerts.map((alert, i) => (
                    <button
                      key={i}
                      onClick={() => schedule && setGapAlert(alert)}
                      className={`px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors ${
                        schedule ? 'hover:bg-red-200 cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      {DAY_NAMES[alert.day]} {alert.shift} — {alert.clientCount} clients, {alert.eligibleStaffCount} eligible staff (−{alert.deficit})
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setAlertsDismissed(true)} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0 mt-0.5">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* View tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-4 w-fit">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as ViewMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                viewMode === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon} {tab.label}
              {'badge' in tab && tab.badge ? (
                <span className="ml-0.5 px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded-full font-bold leading-none">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !schedule ? (
          <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center py-20 text-center">
            <CalendarDays size={40} className="text-slate-300 mb-4" />
            <h3 className="font-semibold text-slate-700 mb-1">No schedule for this week</h3>
            <p className="text-slate-400 text-sm mb-5">Click Auto-Generate to build the schedule automatically.</p>
            <button
              onClick={generateSchedule}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60"
            >
              <Wand2 size={16} /> {generating ? 'Generating…' : 'Smart Schedule'}
            </button>
          </div>
        ) : viewMode === 'timeline' ? (
          <TimelineGrid
            {...sharedProps}
            shifts={shiftsForWeek}
            breakTimes={breakTimes}
          />
        ) : viewMode === 'daily' ? (
          <DailyView {...sharedProps} shifts={shiftsForWeek} breakTimes={breakTimes} day={selectedDay} onDayChange={setSelectedDay} />
        ) : viewMode === 'grid' ? (
          <WeeklyGrid
            assignments={assignments}
            staff={staff}
            clients={clients}
            shifts={shiftsForWeek}
            onUpdateAssignment={handleUpdateAssignment}
            onMoveAssignment={handleMoveAssignment}
            onDeleteAssignment={handleDeleteAssignment}
            onUpdateEndTime={handleUpdateEndTime}
            weekLabel={weekLabel}
          />
        ) : viewMode === 'staff' ? (
          <StaffView staff={staff} assignments={assignments} shifts={shiftsForWeek} />
        ) : viewMode === 'builder' ? (
          <ManualBuilderView
            assignments={assignments}
            staff={staff}
            clients={clients}
            shifts={shiftsForWeek}
            breakTimes={breakTimes}
            timeOff={timeOffForWeek}
            currentMonday={currentMonday}
            onInsert={handleInsertAssignment}
            onDelete={handleDeleteAssignment}
            onUpdateStaff={handleUpdateAssignment}
          />
        ) : viewMode === 'offers' ? (
          <ShiftOffersView
            assignments={assignments}
            staff={effectiveStaff}
            clients={effectiveClients}
            scheduleId={schedule.id}
          />
        ) : (
          <ClientView clients={effectiveClients} assignments={assignments} shifts={shiftsForWeek} />
        )}
      </div>

      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 space-y-4">
        <SupervisionTracker staff={staff} />

        {schedule && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Schedule Stats</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total sessions</span>
                <span className="font-semibold text-slate-700">{assignments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Unassigned</span>
                <span className={`font-semibold ${unassignedCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{unassignedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Violations</span>
                <span className={`font-semibold ${violationCount > 0 ? 'text-red-600' : 'text-aqua-500'}`}>{violationCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Manual overrides</span>
                <span className="font-semibold text-blue-600">{assignments.filter((a) => a.is_manual_override).length}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-2">
                <span className="flex items-center gap-1 text-slate-500">
                  <FileText size={11} />Notes missing
                </span>
                <span className={`font-semibold ${missingNotesCount > 0 ? 'text-amber-600' : 'text-aqua-500'}`}>{missingNotesCount}</span>
              </div>
            </div>
          </div>
        )}

        {shiftsForWeek.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Active Shifts</h3>
              <button
                onClick={() => setShowShiftManager(true)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Edit
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {shiftsForWeek.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-slate-600 truncate">{s.label}</span>
                  <span className="text-slate-400 ml-auto whitespace-nowrap">{s.time_start.slice(0, 5)}–{s.time_end.slice(0, 5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showShiftManager && (
        <ShiftManager
          shifts={shifts}
          breakTimes={breakTimes}
          onClose={() => setShowShiftManager(false)}
          onRefresh={refreshShiftsAndBreaks}
        />
      )}

      {gapAlert && schedule && (
        <GapFillerModal
          alert={gapAlert}
          assignments={assignments}
          staff={staff}
          clients={clients}
          allRestrictions={allRestrictions}
          scheduleId={schedule.id}
          onAssign={handleUpdateAssignment}
          onInsert={handleInsertAssignment}
          onClose={() => setGapAlert(null)}
        />
      )}

      {showSendModal && (
        <SendScheduleModal
          weekLabel={weekLabel}
          weekStart={format(currentMonday, 'yyyy-MM-dd')}
          staff={staff}
          onClose={() => setShowSendModal(false)}
        />
      )}
    </div>
  );
}
