const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','course','exam.html'),'utf8');
assert.equal((html.match(/\{ch:\d+,q:/g)||[]).length,12,'12 道题');
assert.equal((html.match(/answer:\d/g)||[]).length,12,'每题有答案');
assert.match(html,/displayOptions/);
assert.match(html,/ca\.exam\.v1/);
assert.match(html,/examSubmit/);
console.log('结业检查：12 题、答案解析与本地保存链路存在');
