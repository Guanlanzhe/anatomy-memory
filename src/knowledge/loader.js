import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data/processed');

export function loadTerms() {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'terms.json'), 'utf-8');
  return JSON.parse(raw);
}

export function loadMorphemes() {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'morphemes.json'), 'utf-8');
  return JSON.parse(raw);
}

export function getChapters() {
  const terms = loadTerms();
  const set = new Set();
  for (const t of terms) {
    if (t.chapter) set.add(t.chapter);
  }
  return [...set];
}

export function getTermsByChapter(chapter) {
  return loadTerms().filter((t) => t.chapter === chapter);
}

export function getTermsByMorpheme(morphemeId) {
  return loadTerms().filter((t) => t.morphemes.includes(morphemeId));
}