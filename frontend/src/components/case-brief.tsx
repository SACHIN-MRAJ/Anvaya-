import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { Application, Institution } from '../types';
import { typeById } from '../data/rules';
import { STAGE_LABEL } from '../data/applications';
import { daysBetween, formatDate, TODAY } from '../lib/utils';
import { ReadAloud } from './speech';
import { Card } from './ui';
import { WithTerms } from './term';

interface Line {
  text: string;
  source: string;
  tone?: 'warn' | 'ok';
}

/** Builds the brief only from fields in the file, so every sentence can point to its source. */
function brief(app: Application, inst: Institution): { lines: Line[]; next: string } {
  const t = typeById(app.typeId);
  const days = daysBetween(TODAY, app.dueOn);
  const lines: Line[] = [{ text: `${inst.name.split(',')[0]} asks for: ${t.name.toLowerCase()} (${t.clause}).`, source: 'Application' }];
  lines.push({
    text:
      app.stage === 'decision'
        ? `Decided on ${formatDate(app.stageEnteredOn)}: ${app.outcome}.`
        : `Now at ${STAGE_LABEL[app.stage]}. ${app.clock === 'paused' ? 'The clock is paused while the institution replies.' : days >= 0 ? `Due in ${days} days (${formatDate(app.dueOn)}).` : `${-days} days past the deadline; already escalated.`}`,
    source: 'Fair clock',
    tone: app.clock === 'breached' ? 'warn' : undefined,
  });
  lines.push(
    app.deficiencies > 0
      ? { text: `${app.deficiencies} deficiency raised; re-scrutiny may look only at it (APH 1.8(g)).`, source: 'Scrutiny record', tone: 'warn' }
      : { text: 'No deficiency raised so far.', source: 'Scrutiny record', tone: 'ok' },
  );
  const top = [...app.riskReasons].sort((a, b) => b.impact - a.impact)[0];
  if (top) lines.push({ text: `Delay risk ${Math.round(app.risk * 100)}%, mainly: ${top.factor.toLowerCase()}.`, source: 'Risk model (SHAP)', tone: app.risk >= 0.5 ? 'warn' : undefined });
  if (inst.leaseEnd) {
    const runway = (new Date(inst.leaseEnd).getTime() - new Date(TODAY).getTime()) / (365.25 * 86_400_000) - inst.longestCourseYears;
    lines.push({ text: `Leased land with ${runway.toFixed(1)} years of lease runway (APH 2.1(e)).`, source: 'Lease record', tone: runway < 3 ? 'warn' : 'ok' });
  }
  const next =
    app.stage === 'decision'
      ? 'Nothing pending. Watch the 7-day appeal window.'
      : app.clock === 'breached'
        ? 'Act today: forward with your notes, or send back with a reason.'
        : app.clock === 'paused'
          ? 'Nothing to do until the institution replies; a reminder goes automatically.'
          : app.stage === 'evc'
            ? 'Commit and draw the expert panel on the EVC page.'
            : 'Check the AI findings in Documents, then forward or send back.';
  return { lines, next };
}

export function CaseBrief({ app, inst }: { app: Application; inst: Institution }) {
  const { lines, next } = brief(app, inst);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={16} className="text-saffron-500" /> Case brief
        </span>
      }
      subtitle="Written from this file’s own records; each line names its source. Check it before acting."
      action={<ReadAloud text={[...lines.map((l) => l.text), `Suggested next step: ${next}`].join(' ')} />}
    >
      <ul className="space-y-2.5">
        {lines.map((l, i) => (
          <motion.li key={l.text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="flex items-start gap-3 text-sm">
            <span className={l.tone === 'warn' ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500' : l.tone === 'ok' ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indgreen-500' : 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400'} />
            <span className="flex-1 text-ink-soft">
              <WithTerms text={l.text} />
            </span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-ink-mute">{l.source}</span>
          </motion.li>
        ))}
      </ul>
      <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
        <b>Suggested next step:</b> {next}
      </p>
    </Card>
  );
}
