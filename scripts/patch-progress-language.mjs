import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function patch(relativePath, transform) {
  const file = path.join(root, relativePath);
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  fs.writeFileSync(file, next);
}

patch('src/main.tsx', (source) => {
  source = source.replaceAll('<span>{percent}% complete</span>', '<span>{percent}% of lessons</span>');
  if (!source.includes('<span>{percent}% of lessons</span>')) {
    throw new Error('Dashboard lesson progress language was not updated.');
  }
  if (source.includes('<span>{percent}% complete</span>')) {
    throw new Error('Dashboard still mislabels lesson progress as course completion.');
  }
  return source;
});

patch('src/routes/landing.ts', (source) => {
  source = source.replaceAll('<span>course complete</span>', '<span>route progress</span>');
  if (!source.includes('<span>route progress</span>')) {
    throw new Error('Landing preview route progress language was not updated.');
  }
  return source;
});

console.log('FINISH progress language now distinguishes lessons, route progress, assessments, and projects.');
