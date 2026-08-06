import { readFile, writeFile } from 'node:fs/promises';

const companyFile = new URL('../public/company-shell.js', import.meta.url);
let company = await readFile(companyFile, 'utf8');

const original = 'const fallbackStats = { courses: 64, lessons: 1753, quizzes: 128, questions: 2560, projects: 64 };';
const previousGenerated = 'const fallbackStats = { courses: 84, lessons: 2216, quizzes: 168, questions: 3360, projects: 84 };';
const current = 'const fallbackStats = { courses: 104, lessons: 2724, quizzes: 208, questions: 4160, projects: 104 };';

if (company.includes(previousGenerated)) {
  company = company.replace(previousGenerated, original);
  await writeFile(companyFile, company);
} else if (!company.includes(original) && !company.includes(current)) {
  throw new Error('Could not normalize FINISH catalog statistics before the Stanford patch.');
}

console.log('FINISH catalog statistics input normalized.');
