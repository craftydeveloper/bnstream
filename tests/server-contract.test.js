const test=require('node:test');
const assert=require('node:assert/strict');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('health and stream endpoints remain documented in the server',async()=>{const source=await readFile(path.join(root,'server.js'),'utf8');assert.ok(source.includes('/health'));assert.ok(source.includes('/api/streams/live'));assert.ok(source.includes('/api/streams/create'));});
test('administrative routes retain a guard function',async()=>{const source=await readFile(path.join(root,'server.js'),'utf8');assert.ok(source.includes('requireAdmin'));assert.ok(source.includes('/api/admin/analytics'));});
test('chain RPC configuration is read from the environment',async()=>{const source=await readFile(path.join(root,'fourmeme-integration.js'),'utf8');assert.ok(source.includes('BSC_MAINNET_RPC'));});
