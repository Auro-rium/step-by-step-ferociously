import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../src/main.tsx', import.meta.url);
let source = await readFile(file, 'utf8');

const oldAi = "if (/(artificial|machine-learning|deep-learning|computer-vision)/.test(value)) return 'AI & ML';";
const newAi = "if (/(artificial|machine-learning|deep-learning|computer-vision|reinforcement|natural-language|language-model|large-language|generative|transformer|\\bnlp\\b|\\bllm\\b)/.test(value)) return 'AI & ML';";
const oldSystems = "if (/(operating-system|distributed|computation-structures|performance|software-construction|computer-graphics)/.test(value)) return 'Systems';";
const newSystems = "if (/(operating-system|distributed|computation-structures|performance|software-construction|computer-graphics|nand2tetris|computer-architecture|database-systems)/.test(value)) return 'Systems';";

if (source.includes(oldAi)) source = source.replace(oldAi, newAi);
if (source.includes(oldSystems)) source = source.replace(oldSystems, newSystems);
source = source.replaceAll("theme: { color: '#7c5cff' }", "theme: { color: '#c47a45' }");

if (!source.includes(newAi) || !source.includes(newSystems)) {
  throw new Error('Course category patch could not verify the expected classifier.');
}
if (source.includes("theme: { color: '#7c5cff' }")) {
  throw new Error('Legacy purple Razorpay theme is still present.');
}

await writeFile(file, source);
