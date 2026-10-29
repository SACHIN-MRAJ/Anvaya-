import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { WhyChip } from './ui';
import { cn } from '../lib/utils';
import { apiMode } from '../services/api';
import { getSeatMatrix, seatCheck, type SeatImpact } from '../services/records';

/** Sample register used only when the server is not connected. */
const SAMPLE_IN_POST = { Professor: 9, 'Associate Professor': 20, 'Assistant Professor': 65 };
const yearsFor = (programme: string) => (/m\.?tech|mba|pgdm|mca|m\.?e\b/i.test(programme) ? 2 : /diploma/i.test(programme) ? 3 : 4);

/** The server's seat check for the change being asked for: the course in the matrix if it exists, otherwise extra seats. */
function useLiveImpact(programme: string, current: number, requested: number) {
  const [impact, setImpact] = useState<SeatImpact | null>(null);
  useEffect(() => {
    if (apiMode() !== 'on' || requested <= 0) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const m = await getSeatMatrix();
        if (!m || !live) return;
        const name = programme.trim().toLowerCase();
        const match = m.programmes.find((p) => p.status === 'Approved' && p.name.toLowerCase() === name);
        // Extra seats in a new course go to the department of the closest existing course ("B.Tech CSE (AI & ML)" → CSE).
        const near = m.programmes.find((p) => name.startsWith(p.name.split(' (')[0].toLowerCase()));
        const dept = near?.department ?? m.departments[0]?.department;
        const r = match
          ? requested > match.approvedIntake
            ? await seatCheck({ change: 'increase', programmeId: match.id, newIntake: requested })
            : null
          : requested > current
            ? await seatCheck({ change: 'new', newName: programme || 'Additional seats', department: dept, newIntake: requested - current, level: /m\.?tech|mba|mca/i.test(programme) ? 'PG' : 'UG', durationYears: yearsFor(programme) })
            : null;
        if (live) setImpact(r);
      } catch {
        if (live) setImpact(null);
      }
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [programme, current, requested]);
  return impact;
}

/**
 * Will the norms be met after this change? With the server connected this is the institution's real roster and rooms
 * against APH Annexure-1 (UG 1:20 and PG 1:15 over all years) and Annexure-3; without it, a labelled sample.
 */
export function FacultyNorms({ intake, programme, current = 0 }: { intake: number; programme: string; current?: number }) {
  const impact = useLiveImpact(programme, current, intake);
  if (impact) {
    const ok = impact.faculty.inPost >= impact.faculty.after;
    const pct = Math.min(100, (impact.faculty.inPost / Math.max(1, impact.faculty.after)) * 100);
    const shortRooms = impact.rooms.filter((r) => r.short);
    const fine = ok && !shortRooms.length;
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Will the norms be met after this change?</p>
          <WhyChip rule="UG 1:20 and PG 1:15 over all years; rooms from Annexure-3" clause="APH Annexure-1, Annexure-3" detail={`Faculty needed now ${impact.faculty.before}, after ${impact.faculty.after}. From your faculty roster and room record.`} />
        </div>
        <div className="mt-3 flex justify-between text-xs text-ink-soft">
          <span>Faculty in post / needed after the change</span>
          <span className={cn('font-semibold tabular-nums', ok ? 'text-indgreen-700' : 'text-amber-700')}>
            {impact.faculty.inPost} / {impact.faculty.after}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <motion.div className={cn('h-full rounded-full', ok ? 'bg-indgreen-500' : 'bg-amber-500')} animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
        </div>
        <p className={cn('mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm', fine ? 'bg-indgreen-50 text-indgreen-700' : 'bg-amber-50 text-amber-900')}>
          {fine ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <TriangleAlert size={16} className="mt-0.5 shrink-0" />}
          {fine
            ? 'Your faculty and rooms already meet what this change needs.'
            : `Before the expert visit: ${[!ok && `${impact.faculty.after - impact.faculty.inPost} more faculty`, shortRooms.length && `more rooms (${shortRooms.map((r) => `${r.label.toLowerCase()} +${r.short}`).join(', ')})`].filter(Boolean).join(' and ')}. You can still apply.`}
        </p>
      </div>
    );
  }
  return <SampleFacultyNorms intake={intake} programme={programme} />;
}

function SampleFacultyNorms({ intake, programme }: { intake: number; programme: string }) {
  const years = yearsFor(programme);
  const students = Math.max(0, intake) * years;
  const required = Math.ceil(students / 20);
  const diploma = /diploma/i.test(programme);
  const prof = diploma ? 0 : Math.ceil(required / 9);
  const assoc = diploma ? 0 : Math.ceil((required * 2) / 9);
  const need: Record<keyof typeof SAMPLE_IN_POST, number> = { Professor: prof, 'Associate Professor': assoc, 'Assistant Professor': Math.max(0, required - prof - assoc) };
  const have = Object.values(SAMPLE_IN_POST).reduce((s, n) => s + n, 0);
  const short = (Object.keys(SAMPLE_IN_POST) as (keyof typeof SAMPLE_IN_POST)[]).filter((k) => SAMPLE_IN_POST[k] < need[k]);
  const ok = have >= required && short.length === 0;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Will the faculty norm be met? (sample figures)</p>
        <WhyChip rule="Faculty-student ratio 1:20; cadre ratio 1:2:6 (degree level)" clause="APH Annexure-1" detail={`${intake} seats × ${years} years = ${students} students, so ${required} faculty are needed for this course alone.`} />
      </div>
      <p className="mt-1 text-xs text-ink-mute">
        {intake} seats × {years} years = <b className="text-ink">{students} students</b> → <b className="text-ink">{required} faculty</b> for this course. Connect the server to check against your real roster.
      </p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {(Object.keys(SAMPLE_IN_POST) as (keyof typeof SAMPLE_IN_POST)[]).map((k) => {
          const pct = need[k] ? Math.min(100, (SAMPLE_IN_POST[k] / need[k]) * 100) : 100;
          const bad = SAMPLE_IN_POST[k] < need[k];
          return (
            <li key={k} className="text-xs">
              <div className="flex justify-between text-ink-soft">
                <span>{k}</span>
                <span className={cn('font-semibold tabular-nums', bad ? 'text-red-700' : 'text-indgreen-700')}>
                  {SAMPLE_IN_POST[k]} / {need[k]}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <motion.div className={cn('h-full rounded-full', bad ? 'bg-red-500' : 'bg-indgreen-500')} animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className={cn('mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm', ok ? 'bg-indgreen-50 text-indgreen-700' : 'bg-amber-50 text-amber-900')}>
        {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <TriangleAlert size={16} className="mt-0.5 shrink-0" />}
        {ok ? 'Faculty in post meet the norm for this intake.' : `Short by ${Math.max(0, required - have) || short.map((k) => `${need[k] - SAMPLE_IN_POST[k]} ${k.toLowerCase()}`).join(', ')}${have < required ? ' faculty' : ''}.`}
      </p>
    </div>
  );
}
