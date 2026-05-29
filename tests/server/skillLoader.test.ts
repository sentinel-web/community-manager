import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Structural validator for the project's slash-command skills in .claude/skills/.
// A malformed skill (wrong/missing `# /<name>` heading, no Usage, empty body)
// fails to trigger or misleads the agent, and the failure is silent until someone
// invokes it. This pins the convention every project skill follows so a new or
// edited skill that breaks it fails the build instead.
//
// Meteor virtualises __dirname in the test bundle; resolve from the project root
// (mirrors tests/server/integrityCoverage.test.ts).
const SKILLS_DIR = join(process.env.PWD || process.cwd(), '.claude', 'skills');

// Top-level *.md files are the project (slash-command) skills. Bundled/global
// skills live in subdirectories (SKILL.md + frontmatter) and are out of scope.
function projectSkillFiles(): string[] {
  return readdirSync(SKILLS_DIR)
    .filter(name => name.endsWith('.md'))
    .filter(name => statSync(join(SKILLS_DIR, name)).isFile());
}

describe('project skill loader — .claude/skills/*.md stay well-formed (#290)', () => {
  const files = projectSkillFiles();

  it('finds the project skills (glob is not silently empty)', () => {
    assert.ok(files.length >= 10, `expected >= 10 project skills, found ${files.length}`);
  });

  for (const file of files) {
    const name = file.replace(/\.md$/, '');
    describe(`/${name}`, () => {
      const body = readFileSync(join(SKILLS_DIR, file), 'utf8');
      const lines = body.split('\n');
      const firstHeading = lines.find(l => l.trim().length > 0) || '';

      it(`opens with "# /${name}" matching its filename`, () => {
        assert.strictEqual(
          firstHeading.trim(),
          `# /${name}`,
          `${file} must open with "# /${name}" (got "${firstHeading.trim()}")`
        );
      });

      it('has a one-line description after the heading', () => {
        const headingIdx = lines.findIndex(l => l.trim() === firstHeading.trim());
        const desc = lines.slice(headingIdx + 1).find(l => l.trim().length > 0) || '';
        assert.ok(!desc.startsWith('#'), `${file} needs a prose description line under its heading`);
      });

      it('documents a "## Usage" section', () => {
        assert.ok(/^## Usage\b/m.test(body), `${file} is missing a "## Usage" section`);
      });
    });
  }
});
