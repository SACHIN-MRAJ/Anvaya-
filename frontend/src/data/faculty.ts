import type { FacultyRecord } from '../types';
import { mulberry32, pick } from '../lib/rng';
import { INSTITUTIONS } from './institutions';

const FIRST = ['Aarti', 'Rahul', 'Meena', 'Suresh', 'Kavya', 'Imran', 'Priya', 'Anil', 'Deepa', 'Vikram', 'Neha', 'Rohan', 'Lakshmi', 'Arjun', 'Fatima', 'Manoj', 'Sneha', 'Gopal', 'Ritu', 'Karthik'];
const LAST = ['Sharma', 'Iyer', 'Patel', 'Reddy', 'Khan', 'Das', 'Nair', 'Joshi', 'Verma', 'Menon', 'Singh', 'Rao', 'Kulkarni', 'Bose', 'Gupta'];
const ROLES: FacultyRecord['designation'][] = ['Professor', 'Associate Professor', 'Assistant Professor', 'Assistant Professor', 'Assistant Professor'];

const hex = (rand: () => number, n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');

/** Sample faculty register for cycle 2027-28. People are matched across institutions by a salted PAN hash, never the PAN itself. */
function build(): FacultyRecord[] {
  const rand = mulberry32(911);
  const out: FacultyRecord[] = [];
  INSTITUTIONS.forEach((inst, i) => {
    for (let j = 0; j < 7; j++) {
      out.push({
        id: `F-${i}-${j}`,
        name: `${pick(rand, FIRST)} ${pick(rand, LAST)}`,
        panHash: hex(rand, 16),
        institutionId: inst.id,
        designation: pick(rand, ROLES),
        joined: `202${Math.floor(rand() * 6)}-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`,
      });
    }
  });
  // The same people also listed full-time elsewhere: the pattern behind thousands of duplicate records.
  const copies: [number, number][] = [
    [3, 11],
    [17, 2],
    [40, 55],
    [62, 9],
    [88, 120],
    [88, 101],
    [130, 47],
  ];
  copies.forEach(([from, toPos], n) => {
    const src = out[from];
    const target = INSTITUTIONS[Math.floor(toPos / 7)];
    out.push({ ...src, id: `F-dup-${n}`, institutionId: target.id, joined: `2026-0${3 + (n % 6)}-0${1 + n}` });
  });
  return out;
}

export const FACULTY: FacultyRecord[] = build();

export interface DuplicateCluster {
  panHash: string;
  name: string;
  records: FacultyRecord[];
}

/** Groups records by person; a person full-time at two or more institutions is a cluster to explain. */
export function findDuplicates(records: FacultyRecord[] = FACULTY): DuplicateCluster[] {
  const byPerson = new Map<string, FacultyRecord[]>();
  records.forEach((r) => byPerson.set(r.panHash, [...(byPerson.get(r.panHash) ?? []), r]));
  return Array.from(byPerson.entries())
    .filter(([, rs]) => new Set(rs.map((r) => r.institutionId)).size > 1)
    .map(([panHash, rs]) => ({ panHash, name: rs[0].name, records: rs }));
}
