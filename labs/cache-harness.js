/* Cache Lab Part A 浏览器 harness：真实 C，检查 cache_init/cache_access 的命中/缺失/替换统计。
   不是官方 csim 的命令行/verbose 复刻；官方 test-csim 仍在实验机中。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CacheHarness = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var starter = `#include <stddef.h>
#include <stdlib.h>

extern int C_S, C_E, C_B;
extern int C_hits, C_misses, C_evictions;

typedef struct { int valid; unsigned tag; unsigned lru; } line_t;

static line_t *cache = NULL;
static unsigned tick = 0;

void cache_init(int s, int E, int b) {
    free(cache);
    cache = (line_t *)calloc((size_t)(1u << s) * (size_t)E, sizeof(line_t));
    tick = 0;
}

void cache_access(unsigned addr, int size, int write) {
    /* 实现：set = (addr >> b) & (2^s - 1); tag = addr >> (s+b);
       在组内找 valid && tag；命中更新 LRU；缺失选空行或最久未用。 */
    (void)size; (void)write; (void)cache; (void)tick;
    C_misses++;
}
`;

  function build(source, cases) {
    if (typeof source !== 'string' || source.length > 60000) throw new Error('源码为空或超过 60000 字符');
    if (!Array.isArray(cases) || !cases.length) throw new Error('缺少测试用例');
    var all = [], offs = [];
    cases.forEach(function (c) { offs.push(all.length); all = all.concat(c.records); });
    function arr(name, fn, type) {
      return 'static const ' + type + ' ' + name + '[] = {\n' + all.map(fn).join(',\n') + '\n};';
    }
    var addr = arr('ca_addr', function (r) { return '0x' + Number(BigInt(r.addr) & 0xFFFFFFFFn).toString(16).toUpperCase() + 'u'; }, 'unsigned');
    var op = arr('ca_op', function (r) { return r.op === 'L' ? '0' : r.op === 'S' ? '1' : '2'; }, 'unsigned char');
    var size = arr('ca_size', function (r) { return String(r.size); }, 'int');
    var caseRows = cases.map(function (c, i) {
      return '{' + c.s + ',' + c.E + ',' + c.b + ',' + c.records.length + ',' + offs[i] + ',' + c.expected.hits + 'u,' + c.expected.misses + 'u,' + c.expected.evictions + 'u}';
    }).join(',\n');
    var harness = `
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
int C_S, C_E, C_B;
int C_hits, C_misses, C_evictions;
void cache_init(int s, int E, int b);
void cache_access(unsigned addr, int size, int write);

${addr}
${op}
${size}

typedef struct { int s, E, b, n, off; unsigned eh, em, ee; } ca_case_t;
static const ca_case_t ca_cases[] = {
${caseRows}
};

int main(void) {
    int total = (int)(sizeof(ca_cases) / sizeof(ca_cases[0]));
    int passed = 0;
    for (int c = 0; c < total; c++) {
        const ca_case_t *k = &ca_cases[c];
        C_S = k->s; C_E = k->E; C_B = k->b;
        cache_init(k->s, k->E, k->b);
        C_hits = 0; C_misses = 0; C_evictions = 0;
        for (int i = 0; i < k->n; i++) {
            int idx = k->off + i;
            unsigned a = ca_addr[idx]; int sz = ca_size[idx]; int op = ca_op[idx];
            if (op == 2) { cache_access(a, sz, 0); cache_access(a, sz, 1); }
            else cache_access(a, sz, op == 1);
        }
        int ok = (C_hits == (int)k->eh && C_misses == (int)k->em && C_evictions == (int)k->ee);
        if (ok) passed++;
        else printf("CFAIL case %d s=%d E=%d b=%d got h=%d m=%d e=%d want h=%u m=%u e=%u\\n",
                    c, k->s, k->E, k->b, C_hits, C_misses, C_evictions, k->eh, k->em, k->ee);
        printf("CASE %d pass=%d hits=%d misses=%d evictions=%d\\n", c, ok ? 1 : 0, C_hits, C_misses, C_evictions);
    }
    printf("CRESULT %d %d\\n", passed, total);
    return passed == total ? 0 : 1;
}
`;
    return { source: harness.replace('${STUDENT}', '') + '\n' + source, cases: cases.length };
  }

  function parse(output) {
    var text = String(output || '');
    var result = { ok: false, passed: 0, total: 0, cases: [], failures: [] };
    var m = /CRESULT\s+(\d+)\s+(\d+)/.exec(text);
    if (m) { result.passed = +m[1]; result.total = +m[2]; result.ok = result.passed === result.total; }
    var re = /CASE\s+(\d+)\s+pass=(\d+)\s+hits=(\d+)\s+misses=(\d+)\s+evictions=(\d+)/g, c;
    while ((c = re.exec(text))) result.cases.push({ index: +c[1], pass: c[2] === '1', hits: +c[3], misses: +c[4], evictions: +c[5] });
    var fre = /CFAIL[^\n]*/g, f;
    while ((f = fre.exec(text))) result.failures.push(f[0]);
    return result;
  }

  /* Build deterministic cases using the project cache model (browser/Node). */
  function makeCases(TraceCache) {
    if (typeof TraceCache !== 'function') throw new Error('CacheLab.TraceCache 未载入');
    function rng(seed) { var s = seed >>> 0; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s >>> 0; }; }
    var configs = [[1, 1, 2], [5, 1, 5], [3, 4, 4], [0, 2, 3]];
    var out = [];
    configs.forEach(function (cfg, ci) {
      var s = cfg[0], E = cfg[1], b = cfg[2], rand = rng(0x1234 + ci * 0x9e37);
      var records = [], base = 0x1000 + ci * 0x4000;
      for (var i = 0; i < 220; i++) {
        var r = rand(), op = (r % 10 === 0) ? 'M' : (r % 3 === 0 ? 'S' : 'L');
        var addr;
        var mode = (i / 20) | 0;
        if (mode % 3 === 0) addr = base + (i % 16) * 4;
        else if (mode % 3 === 1) addr = base + ((i * 37) % 128) * 4;
        else addr = base + (rand() % 256) * 4;
        records.push({ op: op, addr: BigInt(addr), size: 4 });
      }
      var cache = new TraceCache({ s: s, E: E, b: b, semantics: 'cachelab' });
      records.forEach(function (x) { cache.access(x.op, x.addr, x.size); });
      out.push({ s: s, E: E, b: b, records: records, expected: cache.summary() });
    });
    return out;
  }

  return { starter: starter, build: build, parse: parse, makeCases: makeCases };
});
