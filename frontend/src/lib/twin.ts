/**
 * Process digital twin (simplified fluid queue model for the browser).
 * Production: a SimPy discrete-event simulation calibrated from the mined event log.
 * Two queues: the bottleneck regions (Kanpur + Hyderabad) and all other regions.
 */
export interface Scenario {
  extraOfficersBottleneck: number; // extra dealing officers in Kanpur + Hyderabad
  extraExperts: number; // extra EVC experts empanelled nationally
  volumeChange: number; // -0.2 .. +0.4
  calendarShiftDays: number; // court-directed extension of the decision deadline
}

export const BASELINE: Scenario = { extraOfficersBottleneck: 0, extraExperts: 0, volumeChange: 0, calendarShiftDays: 0 };

export interface TwinResult {
  weeks: { week: string; bottleneck: number; others: number; total: number }[];
  onTime: number;
  avgDays: number;
  peak: number;
  deadlineWeek: number;
}

const START = new Date('2026-10-22');
const label = (w: number) => {
  const d = new Date(START);
  d.setDate(d.getDate() + w * 7);
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
};

export function simulate(s: Scenario): TwinResult {
  const WEEKS = 30;
  const windowWeeks = 6; // applications still arriving until 30 Nov
  const arrivals = 110 * (1 + s.volumeChange);
  const capB = 22 + s.extraOfficersBottleneck * 3.2 + s.extraExperts * 0.5;
  const capO = 70 + s.extraExperts * 0.9;
  let b = 150;
  let o = 260;
  const weeks: TwinResult['weeks'] = [];
  let sumB = 0;
  let sumO = 0;
  for (let w = 0; w < WEEKS; w++) {
    const a = w < windowWeeks ? arrivals : 0;
    b = Math.max(0, b + a * 0.3 - capB);
    o = Math.max(0, o + a * 0.7 - capO);
    sumB += b;
    sumO += o;
    weeks.push({ week: label(w + 1), bottleneck: Math.round(b), others: Math.round(o), total: Math.round(b + o) });
  }
  const wB = Math.max(1, ((sumB / WEEKS) / capB) * 7 + 9); // + processing time
  const wO = Math.max(1, ((sumO / WEEKS) / capO) * 7 + 9);
  const limit = 60 + s.calendarShiftDays;
  const pB = 1 - Math.exp(-limit / wB);
  const pO = 1 - Math.exp(-limit / wO);
  const deadlineWeek = Math.round((Date.parse('2027-04-30') - START.getTime()) / (7 * 86_400_000) + s.calendarShiftDays / 7);
  return {
    weeks,
    onTime: 0.3 * pB + 0.7 * pO,
    avgDays: 0.3 * wB + 0.7 * wO + 12,
    peak: Math.max(...weeks.map((x) => x.total)),
    deadlineWeek,
  };
}
