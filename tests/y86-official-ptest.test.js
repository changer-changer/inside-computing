/* Optional differential against a separately obtained and built CS:APP sim directory.
   Generates the official ptest programs in a temporary directory; no handout code is distributed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const {parseYo} = require('../engine/yo-loader');
const {Y86Pipeline} = require('../engine/y86-pipeline');
const {compile,defaultSource} = require('../engine/hcl-control');
const {extended}=require('./fixtures/extended-control');
const sim = process.env.OPEN3D_CSAPP_SIM;
if (!sim) {
  console.log('官方 ptest 对照：未指定 OPEN3D_CSAPP_SIM，跳过');
  process.exit(0);
}
const simdir = path.resolve(sim), yas = path.join(simdir, 'misc/yas'), psim = process.env.OPEN3D_PSIM || path.join(simdir, 'pipe/psim');
const iaddq = process.env.OPEN3D_PTEST_IADDQ === '1';
const control = process.env.OPEN3D_PTEST_HCL === '1' ? compile(iaddq ? extended(defaultSource) : defaultSource) : null;
for (const f of [yas, psim, path.join(simdir, 'ptest/tester.pm')]) fs.accessSync(f, fs.constants.R_OK);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'open3d-ptest-'));
const names = ['rax','rcx','rdx','rbx','rsp','rbp','rsi','rdi','r8','r9','r10','r11','r12','r13','r14'];
let count = 0;
try {
  for (const suite of ['optest','jtest','ctest','htest']) {
    const base = path.join(tmp, suite), ptest = path.join(base, 'ptest');
    fs.mkdirSync(base);
    fs.cpSync(path.join(simdir, 'ptest'), ptest, {recursive:true, filter: src => !src.endsWith('.ys') && !src.endsWith('.yo') && path.basename(src) !== 'corpus'});
    fs.symlinkSync(path.join(simdir, 'misc'), path.join(base, 'misc'), 'dir');
    fs.mkdirSync(path.join(ptest, 'corpus'));
    const tester = path.join(ptest, 'tester.pm');
    let source = fs.readFileSync(tester, 'utf8');
    const begin = source.indexOf('sub run_sim_test\n'), end = source.indexOf('\nsub run_vlog_test', begin);
    if (begin < 0 || end < 0) throw Error('无法识别官方 tester.pm 的结构');
    // Replace only the runner: preserve the official generators, and keep each generated object.
    source = source.slice(0, begin) + `sub run_sim_test\n{\n local ($tname) = @_;\n system "$yas $tname.ys" and die "assembler failed";\n rename "$tname.yo", "corpus/\${tcount}-$tname.yo" or die "move failed";\n unlink "$tname.ys";\n $tcount++;\n}\n` + source.slice(end);
    fs.writeFileSync(tester, source);
    cp.execFileSync('perl', [`${suite}.pl`, ...(iaddq ? ['-i'] : [])], {cwd:ptest, stdio:'pipe'});
    const dir = path.join(ptest, 'corpus');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.yo'));
    assert.ok(files.length > 0, `${suite} 没有生成测试`);
    for (const file of files) {
      const full = path.join(dir, file);
      const parsed = parseYo(fs.readFileSync(full, 'utf8'), 8192);
      const model = new Y86Pipeline(parsed.bytes, 8192, {iaddq,control});
      let remaining = 10000;
      while (model.status === 'AOK' && remaining-- > 0) model.step();
      assert.ok(remaining > 0, `${suite}/${file}: 超出周期限制`);
      const output = cp.execFileSync(psim, ['-v','1','-t',full], {encoding:'utf8', maxBuffer:1024*1024});
      const label = `${suite}/${file}`;
      assert.match(output, /ISA Check Succeeds/, `${label}: 官方模拟器自身检查失败`);
      const status = output.match(/Status = (\w+)/), cc = output.match(/Condition Codes: Z=(\d) S=(\d) O=(\d)/), cycles = output.match(/CPI:\s+(\d+) cycles/);
      assert.ok(status && cc && cycles, `${label}: 官方输出格式不符合预期`);
      assert.equal(model.status, status[1], `${label}: 状态`);
      assert.deepEqual(model.cc, {zf:cc[1]==='1', sf:cc[2]==='1', of:cc[3]==='1'}, `${label}: 条件码`);
      const regs = Array(15).fill(0n);
      for (const m of output.matchAll(/%(\w+):\s+0x[\da-f]+\s+0x([\da-f]+)/gi)) {
        const i = names.indexOf(m[1]); assert.ok(i >= 0, `${label}: 未知寄存器`); regs[i] = BigInt('0x'+m[2]);
      }
      assert.deepEqual(model.reg, regs, `${label}: 寄存器`);
      const expected = new Uint8Array(8192); expected.set(parsed.bytes);
      for (const m of output.matchAll(/^(0x[\da-f]+):\s+0x[\da-f]+\s+0x([\da-f]+)/gim)) {
        const address = Number(BigInt(m[1])), value = BigInt('0x'+m[2]);
        assert.ok(address + 8 <= expected.length, `${label}: 内存地址`);
        for (let i=0; i<8; i++) expected[address+i] = Number((value >> BigInt(i*8)) & 255n);
      }
      assert.deepEqual(model.mem, expected, `${label}: 内存`);
      assert.equal(model.cycles - 3, Number(cycles[1]), `${label}: 官方周期统计`);
      count++;
    }
  }
  console.log(`${control ? '可编辑规则 ' : ''}${iaddq ? '扩展 iaddq 的' : '官方默认'} PIPE ptest 对照：${count} 个生成程序的状态、条件码、寄存器、内存和统计周期一致`);
} finally { fs.rmSync(tmp, {recursive:true, force:true}); }
