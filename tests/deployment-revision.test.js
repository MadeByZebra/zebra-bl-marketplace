import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
test('health exposes Render system commit but no credentials or private payload bytes',()=>{
 assert.match(server,/deployed_git_commit:\/\^\[a-f0-9\]\{40\}\$\/.test\(process.env.RENDER_GIT_COMMIT\|\|' '\)/);
 assert.match(server,/app\.get\('\/api\/health'/);
 assert.match(server,/process.env.RENDER_GIT_COMMIT:null/);
});
