import type { Institution, RegionInfo } from '../types';
import { mulberry32, pick, between } from '../lib/rng';

/** AICTE's ten regional offices (per AICTE's published list). */
export const REGIONS: RegionInfo[] = [
  { id: 'WRO', name: 'Western', office: 'Mumbai', states: ['Maharashtra', 'Goa', 'Gujarat'] },
  { id: 'SRO', name: 'Southern', office: 'Chennai', states: ['Tamil Nadu', 'Puducherry'] },
  { id: 'SWRO', name: 'South-Western', office: 'Bengaluru', states: ['Karnataka'] },
  { id: 'CRO', name: 'Central', office: 'Bhopal', states: ['Madhya Pradesh', 'Chhattisgarh'] },
  { id: 'NWRO', name: 'North-Western', office: 'Chandigarh', states: ['Punjab', 'Haryana', 'Rajasthan', 'Jammu and Kashmir'] },
  { id: 'NRO', name: 'Northern', office: 'Kanpur', states: ['Uttar Pradesh', 'Uttarakhand'] },
  { id: 'ERO', name: 'Eastern', office: 'Kolkata', states: ['West Bengal', 'Odisha', 'Bihar', 'Jharkhand'] },
  { id: 'SCRO', name: 'South-Central', office: 'Hyderabad', states: ['Telangana', 'Andhra Pradesh'] },
  { id: 'NERO', name: 'North-Eastern', office: 'Guwahati', states: ['Assam', 'Meghalaya', 'Tripura'] },
  { id: 'KRO', name: 'Kerala', office: 'Thiruvananthapuram', states: ['Kerala'] },
];

export const regionName = (id: string) => {
  const r = REGIONS.find((x) => x.id === id);
  return r ? `${r.name} (${r.office})` : id;
};

const CITIES: [string, string, string, number, number][] = [
  ['Indore', 'Madhya Pradesh', 'CRO', 22.72, 75.86],
  ['Pune', 'Maharashtra', 'WRO', 18.52, 73.86],
  ['Coimbatore', 'Tamil Nadu', 'SRO', 11.02, 76.96],
  ['Mysuru', 'Karnataka', 'SWRO', 12.3, 76.64],
  ['Ludhiana', 'Punjab', 'NWRO', 30.9, 75.85],
  ['Lucknow', 'Uttar Pradesh', 'NRO', 26.85, 80.95],
  ['Bhubaneswar', 'Odisha', 'ERO', 20.3, 85.82],
  ['Warangal', 'Telangana', 'SCRO', 17.97, 79.59],
  ['Guwahati', 'Assam', 'NERO', 26.14, 91.74],
  ['Kochi', 'Kerala', 'KRO', 9.93, 76.27],
  ['Nagpur', 'Maharashtra', 'WRO', 21.15, 79.09],
  ['Raipur', 'Chhattisgarh', 'CRO', 21.25, 81.63],
  ['Madurai', 'Tamil Nadu', 'SRO', 9.93, 78.12],
  ['Jaipur', 'Rajasthan', 'NWRO', 26.91, 75.79],
  ['Varanasi', 'Uttar Pradesh', 'NRO', 25.32, 82.97],
  ['Ranchi', 'Jharkhand', 'ERO', 23.34, 85.31],
  ['Visakhapatnam', 'Andhra Pradesh', 'SCRO', 17.69, 83.22],
  ['Ahmedabad', 'Gujarat', 'WRO', 23.02, 72.57],
  ['Mangaluru', 'Karnataka', 'SWRO', 12.91, 74.86],
  ['Dehradun', 'Uttarakhand', 'NRO', 30.32, 78.03],
];

const PREFIX = ['Narmada Valley', 'Sahyadri', 'Kaveri', 'Godavari', 'Aravalli', 'Vindhya', 'Brahmaputra', 'Krishna Delta', 'Tapti', 'Mahanadi', 'Satpura', 'Nilgiri', 'Chambal', 'Periyar', 'Tungabhadra', 'Konkan', 'Malwa', 'Deccan Ridge', 'Shivalik', 'Kalinga'];
const KIND: [string, string, string[]][] = [
  ['Institute of Technology', 'Engineering and Technology', ['B.Tech CSE', 'B.Tech ECE', 'B.Tech Mechanical', 'M.Tech CSE']],
  ['College of Engineering', 'Engineering and Technology', ['B.E. Civil', 'B.E. CSE', 'B.E. Electrical']],
  ['School of Management', 'Management', ['MBA', 'PGDM']],
  ['Polytechnic', 'Engineering and Technology (Diploma)', ['Diploma Mechanical', 'Diploma Civil', 'Diploma CSE']],
  ['Institute of Computer Applications', 'Computer Applications', ['BCA', 'MCA']],
  ['Institute of Hotel Management', 'Hotel Management and Catering', ['B.Sc. HMCT']],
];

function build(): Institution[] {
  const rand = mulberry32(2026);
  return PREFIX.map((p, i) => {
    const [city, state, region, lat, lng] = CITIES[i % CITIES.length];
    const [suffix, category, programmes] = i === 0 ? KIND[0] : pick(rand, KIND);
    const leased = i === 0 ? true : rand() < 0.3;
    const longest = category.includes('Diploma') ? 3 : category === 'Management' || category === 'Computer Applications' ? 2 : 4;
    const leaseEnd = leased ? `${i === 0 ? 2031 : between(rand, 2029, 2052)}-06-30` : undefined;
    return {
      id: `INS-${String(i + 1).padStart(3, '0')}`,
      aicteId: `1-${between(rand, 10000000, 99999999)}`,
      name: `${p} ${suffix}, ${city}`,
      city,
      state,
      region,
      category,
      established: between(rand, 1984, 2019),
      land: leased ? 'Leased' : 'Owned',
      leaseEnd,
      longestCourseYears: longest,
      intake: between(rand, 4, 24) * 30,
      programmes,
      status: i === 13 ? 'Closure in progress' : i % 7 === 3 ? 'Under review' : 'Approved',
      trust: `${p} Education Society`,
      lat,
      lng,
    } satisfies Institution;
  });
}

export const INSTITUTIONS: Institution[] = build();

/** The institution used for the institution-portal demo login. */
export const DEMO_INSTITUTION = INSTITUTIONS[0];

export const institutionById = (id: string) => INSTITUTIONS.find((i) => i.id === id);

/** Names from AICTE's public notice of unapproved institutions. Several copy an approved college's name. */
export const UNAPPROVED: { name: string; city: string; notice: string }[] = [
  { name: 'Narmada Valley Institute of Technology and Management, Indore', city: 'Indore', notice: 'AICTE public notice, 14 Aug 2026' },
  { name: 'Kaveri Global Institute of Engineering Sciences, Coimbatore', city: 'Coimbatore', notice: 'AICTE public notice, 14 Aug 2026' },
  { name: 'Sahyadri International College of Technology, Pune', city: 'Pune', notice: 'AICTE public notice, 2 Mar 2026' },
];

const bigrams = (s: string) => {
  const t = s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const out = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) ?? 0) + 1);
  return out;
};

/** Dice similarity of two names (0 to 1), robust to small spelling changes. */
export function nameSimilarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  let size = 0;
  A.forEach((n, k) => {
    overlap += Math.min(n, B.get(k) ?? 0);
    size += n;
  });
  B.forEach((n) => (size += n));
  return size ? (2 * overlap) / size : 0;
}
