/* Cache Lab Part B 浏览器 harness：把 transpose_submit 的 A/B 二维访问插桩到
   32 组、1 路、32 字节块的缓存模型，检查正确性与 miss 阈值。
   不是官方 test-trans；官方评分仍在实验机中。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TransposeHarness = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var starter = `void transpose_submit(int M, int N, int A[N][M], int B[M][N]) {
    /* 朴素转置：先让它正确，再用分块把 miss 降下来。
       64×64 需要处理 8 路冲突；61×61 注意边界。 */
    for (int i = 0; i < N; i++)
        for (int j = 0; j < M; j++)
            B[j][i] = A[i][j];
}
`;

  function findFunction(source, name) {
    var idx = source.indexOf(name + '(');
    if (idx < 0) throw new Error('没有找到 ' + name + ' 函数');
    var open = source.indexOf('{', idx);
    if (open < 0) throw new Error(name + ' 缺少函数体');
    var depth = 0, end = -1;
    for (var i = open; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') { depth--; if (!depth) { end = i; break; } }
    }
    if (end < 0) throw new Error(name + ' 函数体括号不匹配');
    return { start: idx, open: open, end: end, body: source.slice(open + 1, end) };
  }

  function instrument(body) {
    /* 只处理 A[x][y] / B[x][y] 的二维下标；复杂指针算术不会被计数。 */
    var count = 0;
    var out = body.replace(/([AB])\s*\[([^\[\]]+)\]\s*\[([^\[\]]+)\]/g, function (m, arr, i, j) {
      count++;
      return '(*' + arr + '_AT(' + i + ',' + j + '))';
    });
    return { body: out, count: count };
  }

  function build(source) {
    if (typeof source !== 'string' || source.length > 60000) throw new Error('源码为空或超过 60000 字符');
    var clean = String(source).replace(/^\s*#include\s+"cachelab\.h"\s*$/gm, '');
    var fn = findFunction(clean, 'transpose_submit');
    var inst = instrument(fn.body);
    if (inst.count < 1) throw new Error('函数体里没有找到 A[i][j] / B[j][i] 形式的二维访问；本检查器只支持二维下标形式');
    var transformed = clean.slice(0, fn.open + 1) + inst.body + clean.slice(fn.end);
    var prelude = `#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define CACHE_S 5
#define CACHE_E 1
#define CACHE_B 5
#define CACHE_SETS 32
typedef struct { int valid; unsigned tag; } tline_t;
static tline_t tcache[CACHE_SETS];
static int t_hits, t_misses, t_evictions;
static void *cache_touch_ptr(void *p) {
    unsigned addr = (unsigned)(uintptr_t)p;
    unsigned block = addr >> CACHE_B;
    unsigned set = block & (CACHE_SETS - 1u);
    unsigned tag = block >> CACHE_S;
    tline_t *L = &tcache[set];
    if (L->valid && L->tag == tag) { t_hits++; return p; }
    t_misses++;
    if (L->valid) t_evictions++;
    L->valid = 1; L->tag = tag;
    return p;
}
static void cache_reset(void) {
    memset(tcache, 0, sizeof(tcache));
    t_hits = t_misses = t_evictions = 0;
}
#define A_AT(i,j) ((int *)cache_touch_ptr(&A[i][j]))
#define B_AT(i,j) ((int *)cache_touch_ptr(&B[i][j]))
static int check_transpose(int M, int N, int A[N][M], int B[M][N]) {
    for (int i = 0; i < N; i++) for (int j = 0; j < M; j++) if (A[i][j] != B[j][i]) return 0;
    return 1;
}
static int *aligned_alloc32(size_t bytes) {
    unsigned char *raw = (unsigned char *)malloc(bytes + 32);
    if (!raw) return NULL;
    return (int *)(((uintptr_t)raw + 31u) & ~(uintptr_t)31u);
}
`;
    var harness = `
static void run_one(int N, int threshold, const char *name) {
    int M = N;
    int (*A)[M] = (int (*)[M])aligned_alloc32((size_t)N * (size_t)M * sizeof(int));
    int (*B)[N] = (int (*)[N])aligned_alloc32((size_t)M * (size_t)N * sizeof(int));
    if (!A || !B) { printf("TRESULT %s fail=1 misses=0 reason=alloc\\n", name); return; }
    for (int i = 0; i < N; i++) for (int j = 0; j < M; j++) A[i][j] = i * 1000 + j + 1;
    memset(B, 0, (size_t)N * (size_t)M * sizeof(int));
    cache_reset();
    transpose_submit(M, N, A, B);
    int ok = check_transpose(M, N, A, B);
    printf("TRESULT %s N=%d pass=%d misses=%d hits=%d evictions=%d threshold=%d\\n", name, N, ok ? 1 : 0, t_misses, t_hits, t_evictions, threshold);
}
int main(void) {
    run_one(32, 300, "32x32");
    run_one(64, 1300, "64x64");
    run_one(61, 2000, "61x61");
    printf("TDONE\\n");
    return 0;
}
`;
    return { source: prelude + '\n' + transformed + '\n' + harness, accesses: inst.count };
  }

  function parse(output) {
    var text = String(output || '');
    var r = { ok: false, results: [], failures: [] };
    var re = /TRESULT\s+(\S+)\s+N=(\d+)\s+pass=(\d+)\s+misses=(\d+)\s+hits=(\d+)\s+evictions=(\d+)\s+threshold=(\d+)/g, m;
    while ((m = re.exec(text))) r.results.push({ name: m[1], N: +m[2], pass: m[3] === '1', misses: +m[4], hits: +m[5], evictions: +m[6], threshold: +m[7] });
    var fre = /TRESULT[^\n]*fail=1[^\n]*/g, f;
    while ((f = fre.exec(text))) r.failures.push(f[0]);
    r.ok = r.results.length === 3 && r.results.every(function (x) { return x.pass && x.misses < x.threshold; });
    return r;
  }

  return { starter: starter, build: build, parse: parse };
});
