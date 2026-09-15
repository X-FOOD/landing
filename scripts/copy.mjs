// Копирует src/ → dist/ (всё, кроме input.css). CSS собирает Tailwind отдельно.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('src', 'dist', { recursive: true, filter: (p) => !p.endsWith('input.css') });
console.log('src → dist ok');
