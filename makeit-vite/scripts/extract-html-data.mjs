import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourceHtmlPath = path.resolve(projectRoot, '..', 'makeit.html');
const outDir = path.resolve(projectRoot, 'src', 'data');

function extractArrayLiteral(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`未找到数据标记: ${marker}`);
  }

  const arrayStart = source.indexOf('[', markerIndex);
  if (arrayStart === -1) {
    throw new Error(`未找到数组起始位置: ${marker}`);
  }

  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;

  for (let i = arrayStart; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(arrayStart, i + 1);
      }
    }
  }

  throw new Error(`数组未闭合: ${marker}`);
}

function evaluateArrayLiteral(arrayLiteral) {
  return vm.runInNewContext(`(${arrayLiteral})`);
}

function writeJsonFile(filename, data) {
  fs.writeFileSync(
    path.join(outDir, filename),
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8'
  );
}

const html = fs.readFileSync(sourceHtmlPath, 'utf8');
const studyDataLiteral = extractArrayLiteral(
  html,
  'const ORIGINAL_STUDY_DATA = deepFreeze('
);
const processDataLiteral = extractArrayLiteral(
  html,
  'const PROCESS_TRAINING_DATA = deepFreeze('
);

const studyData = evaluateArrayLiteral(studyDataLiteral);
const processTrainingData = evaluateArrayLiteral(processDataLiteral);

fs.mkdirSync(outDir, { recursive: true });

writeJsonFile('studyData.json', studyData);
writeJsonFile('processTrainingData.json', processTrainingData);
writeJsonFile('dataManifest.json', {
  generatedAt: new Date().toISOString(),
  sourceHtmlPath: '../makeit.html',
  studyChapters: studyData.length,
  studyQuestions: studyData.reduce((sum, chapter) => sum + chapter.questions.length, 0),
  processItems: processTrainingData.length
});

console.log(
  `已提取数据: ${studyData.length} 章, ${studyData.reduce((sum, chapter) => sum + chapter.questions.length, 0)} 道理论题, ${processTrainingData.length} 条过程训练数据`
);
