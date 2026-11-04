const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function load(file,register){
  const reg={};
  const CA={registerChapter:(id,data)=>{reg.id=id;reg.data=data;if(register)register(id,data);},quizHTML:()=>'',pad:n=>String(n).padStart(2,'0'),esc:s=>String(s)};
  const sandbox={CA,window:{CA},console,localStorage:{getItem:()=>null,setItem:()=>{}},document:{},navigator:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
  return reg;
}
for(let i=1;i<=12;i++){
  const id='ch'+String(i).padStart(2,'0');
  const reg=load('course/content/'+id+'.js');
  assert.equal(reg.id,id,id+' registration');
  assert.ok(reg.data.sections.length>=4,id+' sections');
  assert.ok(reg.data.objectives.length>=3,id+' objectives');
  assert.ok(reg.data.summary.length>80,id+' summary');
}
const labs=['bomblab','attacklab','bufferlab','archlab','cachelab','perflab','shelllab','malloclab','proxylab'];
for(const id of labs){
  const sandbox={CA:{LAB_CONTENT:{},quizHTML:()=>'',pad:n=>String(n).padStart(2,'0'),esc:s=>String(s)},window:{},console};
  vm.runInNewContext(fs.readFileSync(path.join(root,'labs/content/'+id+'.js'),'utf8'),sandbox,{filename:id});
  const c=sandbox.CA.LAB_CONTENT[id];
  assert.ok(c,id+' registered');
  assert.ok(c.sections.length>=2,id+' sections');
  assert.ok(c.checklist.length>=3,id+' checklist');
  assert.ok(c.summary.length>40,id+' summary');
}
console.log('12 章课程内容与 9 个实验指南的注册、章节数与目标数检查通过');
