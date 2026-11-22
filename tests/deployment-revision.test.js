import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
test('health reports only Render-provided public commit SHA',()=>{
 assert.ok(server.includes('deployed_git_commit:'));
 assert.ok(server.includes("process.env.RENDER_GIT_COMMIT||''"));
 assert.ok(server.includes("process.env.RENDER_GIT_COMMIT:null"));
 assert.match(server,/app\.get\('\/api\/health'/);
 assert.ok(!server.includes('deployed_git_commit:process.env.STRIPE_SECRET_KEY'));
});
