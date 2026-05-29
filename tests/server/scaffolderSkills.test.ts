import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Scaffolder skills (.claude/skills/*.md) generate new code, so when they drift
// from current conventions every generated file inherits the staleness. A markdown
// skill can't be executed deterministically without an agent, but its CONTENT can
// be pinned: this guard fails the build if a scaffolder reintroduces a retired
// pattern or drops a current one. It is the regression test behind issue #277,
// where all four scaffolders had gone stale (.js + PropTypes + obsolete
// COLLECTION_TO_MODULE / DrawerContext APIs).
//
// Meteor virtualises __dirname inside the test bundle, so resolve from the
// project root (mirrors tests/server/integrityCoverage.test.ts).
const SKILLS_DIR = join(process.env.PWD || process.cwd(), '.claude', 'skills');

function readSkill(name: string): string {
  return readFileSync(join(SKILLS_DIR, `${name}.md`), 'utf8');
}

const SCAFFOLDERS = ['collection', 'component', 'form', 'section'] as const;

// Stale file paths / architecture names that should appear NOWHERE — there is no
// legitimate reason to mention them even in guidance.
const FORBIDDEN_ANYWHERE: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: /\.collection\.js\b/, why: 'collections are .collection.ts, not .js' },
  { pattern: /crud\.lib\.js\b/, why: 'server/crud.lib.ts, not .js' },
  { pattern: /server\/main\.js\b/, why: 'server/main.ts, not .js' },
  { pattern: /\.jsx\b/, why: 'components are .tsx, not .jsx' },
  { pattern: /COLLECTION_TO_MODULE/, why: 'replaced by COLLECTION_REGISTRY' },
];

// Retired APIs that must not appear in GENERATED CODE (fenced blocks). They may
// still be named in prose where a skill warns against them, so these are checked
// only inside code blocks — that is what the scaffolder actually emits.
const FORBIDDEN_IN_CODE: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: /PropTypes|prop-types/, why: 'props are typed with TypeScript interfaces' },
  { pattern: /React\.FC|\.propTypes\b/, why: 'no React.FC / PropTypes in this codebase' },
  { pattern: /\bDrawerContext\b|\bSubdrawerContext\b|\buseSubdrawer\b|\bsetOpen\b/, why: 'replaced by the DrawerStack (useDrawerFrame / useEntityForm)' },
];

// Concatenate the contents of every fenced code block (the generated output).
function codeBlocks(markdown: string): string {
  const matches = markdown.match(/```[\s\S]*?```/g) || [];
  return matches.join('\n');
}

// Current patterns each scaffolder must mention, so a rewrite can't quietly drop
// the load-bearing architecture.
const REQUIRED: Record<(typeof SCAFFOLDERS)[number], readonly string[]> = {
  collection: ['CrudCollectionMap', 'COLLECTION_REGISTRY', '.collection.ts'],
  component: ['interface', '.tsx', 'useMethod'],
  form: ['useEntityForm', 'FormFooter'],
  section: ['ColumnsFactory', 'Section<'],
};

describe('scaffolder skills stay current (#277)', () => {
  for (const name of SCAFFOLDERS) {
    describe(`/${name}`, () => {
      const body = readSkill(name);
      const code = codeBlocks(body);

      for (const { pattern, why } of FORBIDDEN_ANYWHERE) {
        it(`contains no stale reference ${pattern} (${why})`, () => {
          assert.ok(!pattern.test(body), `.claude/skills/${name}.md matches stale reference ${pattern} — ${why}`);
        });
      }

      for (const { pattern, why } of FORBIDDEN_IN_CODE) {
        it(`emits no retired API ${pattern} in code blocks (${why})`, () => {
          assert.ok(!pattern.test(code), `.claude/skills/${name}.md generates code matching retired API ${pattern} — ${why}`);
        });
      }

      for (const token of REQUIRED[name]) {
        it(`mentions current pattern "${token}"`, () => {
          assert.ok(body.includes(token), `.claude/skills/${name}.md is missing required current pattern "${token}"`);
        });
      }
    });
  }
});
