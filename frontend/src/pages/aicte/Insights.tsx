import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Lightbulb, ListOrdered, Network } from 'lucide-react';
import { useProcessMap } from '../../lib/live-data';
import { regionName } from '../../data/institutions';
import { Badge, Callout, Card, PageHeader, Tabs } from '../../components/ui';
import { Tour } from '../../components/live';
import { INSIGHTS_TOUR } from '../../data/tours';
import { cn, formatNumber } from '../../lib/utils';
import type { ProcessMap } from '../../services/api';
import { ReturnReasons } from '../../components/return-reasons';

/* ---------------- Simple view: the journey of a file, one step per row ---------------- */

// Target days per step from APH Table 2.3 (the same targets the fair clock uses).
const TARGET: Record<string, number> = { scrutiny: 15, rescrutiny: 10, evc: 30, shc: 15, ec: 10, appeal: 7 };
const ORDER = ['submitted', 'scrutiny', 'rescrutiny', 'evc', 'shc', 'ec', 'decision', 'appeal'];
const PLAIN: Record<string, { name: string; what: string }> = {
  submitted: { name: 'Application received', what: 'The institution submits; the file is registered and its clock starts.' },
  scrutiny: { name: 'Scrutiny', what: 'An officer checks the documents and data against the handbook.' },
  rescrutiny: { name: 'Re-scrutiny', what: 'Something was missing: the institution fixes it and the officer checks again.' },
  evc: { name: 'Expert visit (EVC)', what: 'A panel of experts visits the campus, in person or online.' },
  shc: { name: 'Hearing (SHC)', what: 'The institution explains its shortfalls to the hearing committee.' },
  ec: { name: 'Executive Committee', what: 'The committee reviews the whole file and takes the decision.' },
  decision: { name: 'Decision issued', what: 'The letter is signed and published; anyone can verify it.' },
  appeal: { name: 'Appeal (SAC)', what: 'If the institution disagrees, the appellate committee decides.' },
};
const NEXT: Record<string, { label: string; color: string }> = {
  scrutiny: { label: 'Scrutiny', color: '#3B6FD4' },
  rescrutiny: { label: 'Sent back for fixes', color: '#D9700C' },
  evc: { label: 'Expert visit', color: '#7C5CD6' },
  shc: { label: 'Hearing', color: '#C2410C' },
  ec: { label: 'Committee decision', color: '#1E8C4E' },
  decision: { label: 'Decision', color: '#0E7490' },
  appeal: { label: 'Appealed', color: '#B42318' },
};

function verdict(wait: number, target?: number): { tone: 'green' | 'amber' | 'red' | 'brand'; words: string } {
  if (!target) return { tone: 'brand', words: wait < 1 ? 'Handled within a day' : `About ${wait.toFixed(1)} days` };
  if (wait > target) return { tone: 'red', words: `${(wait - target).toFixed(1)} days over the ${target}-day target` };
  if (wait > target * 0.6) return { tone: 'amber', words: `Close to the ${target}-day target` };
  return { tone: 'green', words: `Well within the ${target}-day target` };
}
const TONE = {
  green: { bar: 'bg-indgreen-500', text: 'text-indgreen-700', dot: 'bg-indgreen-500 ring-indgreen-100' },
  amber: { bar: 'bg-amber-500', text: 'text-amber-700', dot: 'bg-amber-500 ring-amber-100' },
  red: { bar: 'bg-red-500', text: 'text-red-700', dot: 'bg-red-500 ring-red-100' },
  brand: { bar: 'bg-brand-500', text: 'text-brand-700', dot: 'bg-brand-500 ring-brand-100' },
};

function Journey({ map }: { map: ProcessMap }) {
  const byId = Object.fromEntries(map.nodes.map((n) => [n.id, n]));
  const total = byId.submitted?.cases ?? Math.max(...map.nodes.map((n) => n.cases));
  const steps = ORDER.filter((id) => byId[id]);
  // One scale for every row, so a longer bar always means a longer wait.
  const scale = Math.max(...steps.map((id) => Math.max(byId[id].wait, TARGET[id] ?? 0))) * 1.05;
  return (
    <ol className="relative space-y-3 p-4 sm:p-6">
      <span aria-hidden className="absolute bottom-10 left-[2.1rem] top-10 w-0.5 bg-gradient-to-b from-brand-200 via-slate-200 to-indgreen-200 sm:left-[2.6rem]" />
      {steps.map((id, i) => {
        const n = byId[id];
        const target = TARGET[id];
        const v = verdict(n.wait, target);
        const out = map.edges.filter((e) => e.from === id);
        const outTotal = out.reduce((s, e) => s + e.cases, 0);
        const some = n.cases < total * 0.9 && id !== 'ec' && id !== 'decision';
        const now = map.live?.[id]?.files;
        return (
          <motion.li key={id} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: i * 0.05 }} className="relative flex gap-3 sm:gap-4">
            <span className={cn('relative z-[1] mt-4 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white ring-4', TONE[v.tone].dot)}>{i + 1}</span>
            <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {PLAIN[id].name}
                    {some && <Badge tone="slate">Only some files</Badge>}
                    {now !== undefined && now > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indgreen-50 px-2 py-0.5 text-[11px] font-semibold text-indgreen-700">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indgreen-500" aria-hidden /> {now} here now
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-mute">{PLAIN[id].what}</p>
                </div>
                <p className="text-right">
                  <span className="font-display text-2xl font-extrabold tabular-nums text-ink">{n.wait.toFixed(1)}</span>
                  <span className="ml-1 text-xs text-ink-mute">days average wait</span>
                </p>
              </div>
              {/* Wait against the target: the line marks the target, the bar how long files actually waited. */}
              <div className="mt-3">
                <div className="relative h-2.5 rounded-full bg-slate-100">
                  <motion.div className={cn('h-full rounded-full', TONE[v.tone].bar)} initial={{ width: 0 }} whileInView={{ width: `${(n.wait / scale) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 + i * 0.05 }} />
                  {target && <span className="absolute -top-1 h-[18px] w-0.5 rounded bg-ink/70" style={{ left: `${(target / scale) * 100}%` }} title={`Target: ${target} days`} />}
                </div>
                <p className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs">
                  <span className={cn('font-semibold', TONE[v.tone].text)}>{v.words}</span>
                  <span className="text-ink-mute">
                    {formatNumber(n.cases)} of {formatNumber(total)} files last cycle ({Math.round((n.cases / total) * 100)}%)
                  </span>
                </p>
              </div>
              {out.length > 1 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-ink-soft">Where files go next</p>
                  <div className="mt-1.5 flex h-2 overflow-hidden rounded-full">
                    {out.map((e) => (
                      <motion.span key={e.to} style={{ backgroundColor: NEXT[e.to]?.color ?? '#94A3B8' }} initial={{ width: 0 }} whileInView={{ width: `${(e.cases / outTotal) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.6 }} />
                    ))}
                  </div>
                  <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                    {out.map((e) => (
                      <li key={e.to} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NEXT[e.to]?.color ?? '#94A3B8' }} />
                        <b className="tabular-nums">{Math.round((e.cases / outTotal) * 100)}%</b> {NEXT[e.to]?.label ?? e.to}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

function LinearSteps({ nodes }: { nodes: readonly { id: string; label: string; cases: number; wait: number }[] }) {
  const sum = nodes.reduce((s, n) => s + n.wait, 0);
  const max = Math.max(...nodes.map((n) => n.wait));
  return (
    <div className="p-4 sm:p-6">
      <p className="text-sm text-ink-soft">
        From start to finish this takes about <b>{sum.toFixed(1)} days</b>. The longest bar is where the time goes.
      </p>
      <ol className="mt-4 space-y-3">
        {nodes.map((n, i) => {
          const slow = n.wait === max;
          return (
            <motion.li key={n.id} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="grid grid-cols-[1.75rem_minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm">
              <span className={cn('grid h-7 w-7 place-items-center rounded-full text-xs font-bold', slow ? 'bg-red-500 text-white' : 'bg-brand-50 text-brand-700')}>{i + 1}</span>
              <span className="truncate font-medium text-ink">{n.label}</span>
              <span className="h-2.5 rounded-full bg-slate-100">
                <motion.span className={cn('block h-full rounded-full', slow ? 'bg-red-500' : 'bg-brand-500')} initial={{ width: 0 }} whileInView={{ width: `${Math.max(2, (n.wait / max) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.6 }} />
              </span>
              <span className={cn('w-20 text-right tabular-nums', slow ? 'font-semibold text-red-700' : 'text-ink-soft')}>{n.wait.toFixed(1)} days</span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

type FlowData = { label: string; cases: number; wait: number; max: number; now?: number };

function StageNode({ data }: NodeProps<Node<FlowData>>) {
  const r = data.wait / data.max;
  const tone = r > 0.75 ? 'border-red-400 bg-red-50' : r > 0.4 ? 'border-amber-300 bg-amber-50' : 'border-brand-200 bg-white';
  return (
    <div className={cn('w-[170px] rounded-xl border-2 px-3 py-2.5 shadow-card', tone)}>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-400" />
      <p className="text-sm font-semibold text-ink">{data.label}</p>
      <p className="mt-0.5 text-[11px] text-ink-mute">
        {formatNumber(data.cases)} cases
        {data.now !== undefined && (
          <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-indgreen-50 px-1.5 font-semibold text-indgreen-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indgreen-500" aria-hidden /> {data.now} now
          </span>
        )}
      </p>
      <p className={cn('mt-1 text-xs font-semibold', r > 0.75 ? 'text-red-700' : r > 0.4 ? 'text-amber-700' : 'text-brand-700')}>avg wait {data.wait.toFixed(1)} days</p>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-slate-400" />
    </div>
  );
}

const nodeTypes = { stage: StageNode };

const POS: Record<string, { x: number; y: number }> = {
  submitted: { x: 0, y: 150 },
  scrutiny: { x: 240, y: 60 },
  rescrutiny: { x: 480, y: -60 },
  evc: { x: 480, y: 170 },
  shc: { x: 720, y: 260 },
  ec: { x: 960, y: 90 },
  decision: { x: 1200, y: 90 },
  appeal: { x: 1200, y: 250 },
};

const OBJECT_VIEWS = {
  application: null,
  visit: {
    nodes: [
      { id: 'q', label: 'Queued for EVC', cases: 371, wait: 3.2 },
      { id: 'p', label: 'Panel proposed', cases: 371, wait: 1.1 },
      { id: 'd', label: 'Draw revealed', cases: 371, wait: 0.2 },
      { id: 's', label: 'Visit scheduled', cases: 365, wait: 12.9 },
      { id: 'v', label: 'Visit done', cases: 352, wait: 2.4 },
      { id: 'r', label: 'Report uploaded', cases: 349, wait: 4.6 },
    ],
  },
  document: {
    nodes: [
      { id: 'u', label: 'Uploaded', cases: 9840, wait: 0.1 },
      { id: 'g', label: 'Signature checked', cases: 9840, wait: 0.1 },
      { id: 'sv', label: 'Source verified', cases: 6120, wait: 1.8 },
      { id: 'df', label: 'Deficiency raised', cases: 412, wait: 6.4 },
      { id: 'ru', label: 'Re-uploaded', cases: 388, wait: 9.7 },
      { id: 'a', label: 'Accepted', cases: 9790, wait: 0.5 },
    ],
  },
} as const;

type View = keyof typeof OBJECT_VIEWS;

export default function Insights() {
  const [view, setView] = useState<View>('application');
  const [mode, setMode] = useState<'steps' | 'map'>('steps');
  // Last cycle's mined process map from the server, with today's live occupancy laid over it.
  const { data: MINING } = useProcessMap();

  // The headline is worked out from the data: the slowest step, the step furthest over its target, and the region gap.
  const headline = useMemo(() => {
    const timed = MINING.nodes.filter((n) => TARGET[n.id]);
    const slowest = [...timed].sort((a, b) => b.wait - a.wait)[0];
    const over = [...timed].filter((n) => n.wait > TARGET[n.id]).sort((a, b) => b.wait / TARGET[b.id] - a.wait / TARGET[a.id])[0];
    const rs = [...MINING.regionStageDays].sort((a, b) => b.rescrutiny - a.rescrutiny);
    return { slowest, over, worst: rs[0], best: rs[rs.length - 1] };
  }, [MINING]);

  const { nodes, edges } = useMemo(() => {
    if (view === 'application') {
      const max = Math.max(...MINING.nodes.map((n) => n.wait));
      const maxCases = Math.max(...MINING.edges.map((e) => e.cases));
      const nodes: Node<FlowData>[] = MINING.nodes.map((n) => ({ id: n.id, type: 'stage', position: POS[n.id], data: { label: n.label, cases: n.cases, wait: n.wait, max, now: MINING.live?.[n.id]?.files } }));
      const edges: Edge[] = MINING.edges.map((e) => {
        const slow = e.days >= 14;
        return {
          id: `${e.from}-${e.to}`,
          source: e.from,
          target: e.to,
          animated: slow,
          label: `${e.days.toFixed(1)}d · ${e.cases}`,
          labelStyle: { fontSize: 11, fill: slow ? '#B42318' : '#475569', fontWeight: 600 },
          labelBgStyle: { fill: '#ffffff' },
          style: { stroke: slow ? '#D9700C' : '#94A3B8', strokeWidth: 1 + (e.cases / maxCases) * 5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: slow ? '#D9700C' : '#94A3B8' },
        };
      });
      return { nodes, edges };
    }
    const v = OBJECT_VIEWS[view]!;
    const max = Math.max(...v.nodes.map((n) => n.wait));
    const nodes: Node<FlowData>[] = v.nodes.map((n, i) => ({ id: n.id, type: 'stage', position: { x: i * 230, y: i % 2 ? 90 : 0 }, data: { label: n.label, cases: n.cases, wait: n.wait, max } }));
    const edges: Edge[] = v.nodes.slice(1).map((n, i) => ({
      id: `${v.nodes[i].id}-${n.id}`,
      source: v.nodes[i].id,
      target: n.id,
      animated: n.wait / max > 0.75,
      style: { stroke: n.wait / max > 0.75 ? '#D9700C' : '#94A3B8', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' },
    }));
    return { nodes, edges };
  }, [view, MINING]);

  const maxDays = Math.max(...MINING.regionStageDays.flatMap((r) => [r.scrutiny, r.rescrutiny, r.evc, r.shc]));

  return (
    <>
      <PageHeader
        eyebrow="Module B · where files wait, mined from the evidence log"
        title="Bottleneck insights"
        description="Every file’s journey through AICTE, step by step: how long it waited at each step against the handbook target, and where it went next. Built from what actually happened last cycle, not from opinions."
        tourId="insights"
      />
      <Tour id="insights" steps={INSIGHTS_TOUR} />

      <Callout tone="amber" icon={<Lightbulb size={18} />} title={headline.slowest ? `Slowest step: ${PLAIN[headline.slowest.id].name}, ${headline.slowest.wait.toFixed(1)} days on average` : 'Where files wait'}>
        {headline.over && `${PLAIN[headline.over.id].name} is furthest over its target: ${headline.over.wait.toFixed(1)} days against ${TARGET[headline.over.id]}. `}
        {headline.worst && headline.best && `Re-scrutiny takes ${headline.worst.rescrutiny.toFixed(1)} days in ${regionName(headline.worst.region)} but ${headline.best.rescrutiny.toFixed(1)} in ${regionName(headline.best.region)}. `}
        Try adding officers in the What-if simulator.
      </Callout>

      <Card className="mt-6" pad={false}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-2">
          <Tabs
            value={view}
            onChange={setView}
            tabs={[
              { value: 'application', label: 'Applications' },
              { value: 'visit', label: 'Expert visits' },
              { value: 'document', label: 'Documents' },
            ]}
          />
          <div role="radiogroup" aria-label="How to show it" className="mb-2 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
            {(
              [
                ['steps', 'Simple steps', ListOrdered],
                ['map', 'Detailed map', Network],
              ] as const
            ).map(([value, label, Icon]) => (
              <button key={value} role="radio" aria-checked={mode === value} onClick={() => setMode(value)} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors', mode === value ? 'bg-white text-brand-700 shadow-card' : 'text-ink-mute hover:text-ink')}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
        {mode === 'steps' ? (
          <motion.div key={`steps-${view}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {view === 'application' ? (
              <>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-b border-slate-100 bg-slate-50/60 px-6 py-2.5 text-xs text-ink-soft">
                  <span className="font-semibold text-ink">How to read this:</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-5 rounded-full bg-indgreen-500" /> well within target
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-5 rounded-full bg-amber-500" /> close to target
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-5 rounded-full bg-red-500" /> over target
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-0.5 rounded bg-ink/70" /> the target
                  </span>
                </div>
                <Journey map={MINING} />
              </>
            ) : (
              <LinearSteps nodes={OBJECT_VIEWS[view]!.nodes} />
            )}
          </motion.div>
        ) : (
          <>
            <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[460px] w-full">
              <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }} nodesDraggable proOptions={{ hideAttribution: false }} minZoom={0.3}>
                <Background gap={22} color="#E2E8F0" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </motion.div>
            <div className="space-y-1.5 border-t border-slate-100 px-6 py-3 text-xs text-ink-mute">
              <p className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border-2 border-red-400 bg-red-50" /> Slowest steps
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border-2 border-amber-300 bg-amber-50" /> Slow
                </span>
                <span>Drag to move around; use + and − to zoom.</span>
              </p>
              <p>
                Each box is a step, with its average wait. Each line is a route files took: a label such as <b>“9.0d · 25”</b> means 25 files took that route and spent 9 days on average. Thicker lines carry more files; moving orange lines took 14 days or more.
              </p>
            </div>
          </>
        )}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Average days by region and stage" pad={false}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Region</th>
                  <th className="text-right">Scrutiny</th>
                  <th className="text-right">Re-scrutiny</th>
                  <th className="text-right">EVC</th>
                  <th className="text-right">SHC</th>
                </tr>
              </thead>
              <tbody>
                {MINING.regionStageDays.map((r) => (
                  <tr key={r.region}>
                    <td className="whitespace-nowrap font-medium text-ink">{regionName(r.region)}</td>
                    {(['scrutiny', 'rescrutiny', 'evc', 'shc'] as const).map((k) => (
                      <td key={k} className="text-right">
                        <span className="inline-block min-w-[3.2rem] rounded-md px-2 py-1 text-xs font-semibold tabular-nums" style={{ backgroundColor: `rgba(217,112,12,${(r[k] / maxDays) * 0.55})`, color: r[k] / maxDays > 0.65 ? '#fff' : '#0F172A' }}>
                          {r[k].toFixed(1)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Most common paths" subtitle="Share of decided cases and average total days">
            <ul className="space-y-3">
              {MINING.variants.map((v, i) => (
                <li key={v.path}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-ink-soft" title={v.path}>
                      {v.path}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">
                      {Math.round(v.share * 100)}% · {v.days}d
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                    <motion.div className="h-full rounded-full bg-brand-500" initial={{ width: 0 }} animate={{ width: `${v.share * 100 * 2.4}%` }} transition={{ delay: i * 0.08, duration: 0.6 }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Departures from the handbook" subtitle="Conformance check of real flows against the APH model" pad={false}>
            <ul className="divide-y divide-slate-100">
              {MINING.deviations.map((d) => (
                <li key={d.rule} className="flex items-center gap-3 px-6 py-3 text-sm">
                  <Badge tone={d.severity === 'High' ? 'red' : 'amber'}>{d.severity}</Badge>
                  <span className="min-w-0 flex-1">{d.rule}</span>
                  <span className="font-semibold tabular-nums">{d.cases}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <div data-tour="return-reasons"><ReturnReasons /></div>
    </>
  );
}
