// Exports the frontend's sample data (frontend/src/data/*.ts) to backend/app/seed/seed.json,
// so the backend starts with exactly the records the interface already shows.
// Run from the project root: node backend/scripts/export_seed.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const web = path.join(root, 'frontend');
// esbuild is a dependency of the website, so it is loaded from frontend/node_modules.
const { build } = createRequire(path.join(web, 'package.json'))('esbuild');
const tmp = path.join(root, 'backend', 'scripts', '.seed-bundle.mjs');
const out = path.join(root, 'backend', 'app', 'seed', 'seed.json');

await build({
  stdin: {
    contents: `
      export { APPLICATIONS, STAGE_LABEL } from './src/data/applications';
      export { REGIONS, INSTITUTIONS, UNAPPROVED } from './src/data/institutions';
      export { APPLICATION_TYPES, STAGE_TARGET_DAYS, ESCALATION_LADDER, STEP_LABEL, buildGoldenCases } from './src/data/rules';
      export { EXPERTS, OBLIGATIONS, NOTICES, CALENDAR, MINING } from './src/data/misc';
      export { FACULTY } from './src/data/faculty';
      export { GLOSSARY } from './src/data/glossary';
    `,
    resolveDir: web,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: tmp,
  logLevel: 'warning',
});

const m = await import(pathToFileURL(tmp).href);
const data = {
  regions: m.REGIONS,
  institutions: m.INSTITUTIONS,
  unapproved: m.UNAPPROVED,
  applicationTypes: m.APPLICATION_TYPES,
  stageTargetDays: m.STAGE_TARGET_DAYS,
  escalationLadder: m.ESCALATION_LADDER,
  stepLabel: m.STEP_LABEL,
  stageLabel: m.STAGE_LABEL,
  goldenCases: m.buildGoldenCases(),
  applications: m.APPLICATIONS,
  experts: m.EXPERTS,
  obligations: m.OBLIGATIONS,
  notices: m.NOTICES,
  calendar: m.CALENDAR,
  mining: m.MINING,
  faculty: m.FACULTY,
  glossary: m.GLOSSARY,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 1));
fs.rmSync(tmp);
console.log('seed written:', Object.entries(data).map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : Object.keys(v).length}`).join(' '));
