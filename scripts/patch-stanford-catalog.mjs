import { readFile, writeFile } from 'node:fs/promises';

const mainFile = new URL('../src/main.tsx', import.meta.url);
const catalogFile = new URL('../src/routes/catalog.ts', import.meta.url);
const sitemapFile = new URL('../public/sitemap.xml', import.meta.url);
const companyFile = new URL('../public/company-shell.js', import.meta.url);
const verifyFile = new URL('./verify-launch.mjs', import.meta.url);

let main = await readFile(mainFile, 'utf8');
let catalog = await readFile(catalogFile, 'utf8');
let sitemap = await readFile(sitemapFile, 'utf8');
let company = await readFile(companyFile, 'utf8');
let verify = await readFile(verifyFile, 'utf8');

function replaceKnown(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) throw new Error(`Stanford catalog patch could not find ${label}.`);
  return source.replace(oldValue, newValue);
}

const oldAiAlias = "'AI & Machine Learning': 'ai ml llm machine learning deep learning neural networks transformers nlp computer vision reinforcement learning generative models data science'";
const newAiAlias = "'AI & Machine Learning': 'ai ml llm machine learning deep learning neural networks transformers nlp computer vision reinforcement learning generative models diffusion vision models robotics autonomy sensing sensor fusion data science'";
const oldProgrammingAlias = "'Programming & Web': 'programming coding software development python javascript web django html css git developer tools computer science foundations'";
const newProgrammingAlias = "'Programming & Web': 'programming coding software development python javascript swift swiftui ios mobile web django html css git developer tools computer science foundations'";
const oldSystemsAlias = "'Systems & Architecture': 'operating systems distributed systems architecture hardware cpu memory networks performance graphics nand2tetris systems engineering'";
const newSystemsAlias = "'Systems & Architecture': 'operating systems distributed systems architecture hardware cpu memory networks performance graphics nand2tetris systems engineering parallel computing frontier systems data compression low level c assembly concurrency'";
const oldAlgorithmsAlias = "'Algorithms & Data Structures': 'algorithms data structures complexity graphs trees hashing dynamic programming problem solving'";
const newAlgorithmsAlias = "'Algorithms & Data Structures': 'algorithms data structures complexity graphs trees hashing dynamic programming greedy shortest paths network flow approximation randomized online optimization problem solving'";
const oldMathAlias = "'Mathematics & Statistics': 'mathematics maths probability statistics linear algebra matrices signals inference stochastic'";
const newMathAlias = "'Mathematics & Statistics': 'mathematics maths probability statistics linear algebra matrices signals fourier transforms convex optimization dynamical systems control least squares inference stochastic'";

for (const pair of [
  [oldAiAlias, newAiAlias, 'AI search aliases'],
  [oldProgrammingAlias, newProgrammingAlias, 'programming search aliases'],
  [oldSystemsAlias, newSystemsAlias, 'systems search aliases'],
  [oldAlgorithmsAlias, newAlgorithmsAlias, 'algorithm search aliases'],
  [oldMathAlias, newMathAlias, 'mathematics search aliases'],
]) {
  main = replaceKnown(main, pair[0], pair[1], pair[2]);
  catalog = replaceKnown(catalog, pair[0], pair[1], pair[2]);
}

const oldAiRegex = '/(artificial intelligence|machine learning|deep learning|computer vision|reinforcement learning|natural language|language model|large language|neural network|transformer|generative|meta learning|tensorflow|fast ai|karpathy)/';
const newAiRegex = '/(artificial intelligence|machine learning|deep learning|computer vision|reinforcement learning|natural language|language model|large language|neural network|transformer|generative|meta learning|tensorflow|fast ai|karpathy|diffusion|vision model|robotics|autonomy|sensor fusion|sensing for autonomy)/';
const oldMathRegex = '/(linear algebra|probability|statistics|mathematics|matrix methods|signals and systems|probabilistic systems)/';
const newMathRegex = '/(linear algebra|probability|statistics|mathematics|matrix methods|signals and systems|probabilistic systems|fourier|linear dynamical|convex optimization|least squares|laplace transform)/';
const oldMainSystemsRegex = '/(operating system|distributed system|computation structures|computer architecture|system engineering|performance engineering|computer graphics|nand2tetris)/';
const oldRouteSystemsRegex = '/(operating system|distributed system|computation structures|computer architecture|system engineering|performance engineering|computer graphics|nand2tetris|network)/';
const newSystemsRegex = '/(operating system|distributed system|computation structures|computer architecture|system engineering|performance engineering|computer graphics|nand2tetris|network|parallel computing|frontier systems|data compression|programming paradigms|low level|assembly language)/';

main = replaceKnown(main, oldAiRegex, newAiRegex, 'main AI classifier');
catalog = replaceKnown(catalog, oldAiRegex, newAiRegex, 'catalog AI classifier');
main = replaceKnown(main, oldMathRegex, newMathRegex, 'main mathematics classifier');
catalog = replaceKnown(catalog, oldMathRegex, newMathRegex, 'catalog mathematics classifier');
main = replaceKnown(main, oldMainSystemsRegex, newSystemsRegex, 'main systems classifier');
catalog = replaceKnown(catalog, oldRouteSystemsRegex, newSystemsRegex, 'catalog systems classifier');

main = main.replace("const CATALOG_SESSION_KEY = 'finish:catalog:v3';", "const CATALOG_SESSION_KEY = 'finish:catalog:v4';");

const entries = `  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cs224u-natural-language-understanding</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cs224r-deep-reinforcement-learning</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-ee104-introduction-machine-learning</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cme296-diffusion-large-vision-models</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cs223a-introduction-robotics</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-ee259-principles-sensing-autonomy</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cs106a-programming-methodology</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cs106b-programming-abstractions</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cs107-programming-paradigms</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cs149-parallel-computing</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cs153-frontier-systems</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cs193p-ios-development-swiftui</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-ee102-signals-systems</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-ee261-fourier-transform-applications</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-ee263-linear-dynamical-systems</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-ee274-data-compression</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-ee364a-convex-optimization</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-engr108-applied-linear-algebra</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cs161-design-analysis-algorithms</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://finish-landing-nine.vercel.app/course/stanford-cs261-second-course-algorithms</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>`;
for (const entry of entries.split('\n')) {
  const match = entry.match(/<loc>([^<]+)<\/loc>/);
  if (!match || sitemap.includes(`<loc>${match[1]}</loc>`)) continue;
  sitemap = sitemap.replace('</urlset>', `${entry}\n</urlset>`);
}

company = replaceKnown(
  company,
  'const fallbackStats = { courses: 64, lessons: 1753, quizzes: 128, questions: 2560, projects: 64 };',
  'const fallbackStats = { courses: 104, lessons: 2724, quizzes: 208, questions: 4160, projects: 104 };',
  'company fallback statistics',
);
company = company.replace(
  'Focused routes across programming, systems, algorithms, mathematics, security and AI.',
  'Focused routes across AI, programming, systems, algorithms, mathematics, security and finance.',
);

verify = replaceKnown(
  verify,
  "'courses: 84, lessons: 2216, quizzes: 168, questions: 3360, projects: 84'",
  "'courses: 104, lessons: 2724, quizzes: 208, questions: 4160, projects: 104'",
  'launch statistics verification',
);

for (const marker of [
  'diffusion|vision model|robotics|autonomy',
  'parallel computing|frontier systems|data compression',
  'fourier|linear dynamical|convex optimization',
  'stanford-cs224u-natural-language-understanding',
  'courses: 104, lessons: 2724, quizzes: 208, questions: 4160, projects: 104',
]) {
  const combined = `${main}\n${catalog}\n${sitemap}\n${company}\n${verify}`;
  if (!combined.includes(marker)) throw new Error(`Stanford catalog patch verification failed for ${marker}.`);
}

await Promise.all([
  writeFile(mainFile, main),
  writeFile(catalogFile, catalog),
  writeFile(sitemapFile, sitemap),
  writeFile(companyFile, company),
  writeFile(verifyFile, verify),
]);

console.log('FINISH Stanford catalog categories, sitemap, cache and statistics are current.');
