/* Malloc Lab 浏览器 harness：真实 C、真实 wasm32 编译，检查正确性/利用率/realloc。
   不是官方 mdriver；官方评分仍在实验机中。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MallocHarness = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var starter = `#include <stddef.h>
#include <stdint.h>
#include <string.h>

extern void *mem_sbrk(int incr);
extern size_t mem_heapsize(void);

/* 256 KB 堆。实现 mm_init / mm_malloc / mm_free / mm_realloc。
 * 提示：块头至少 8 字节；载荷 8 字节对齐；释放后合并相邻空闲块。 */
static char *heap_start = NULL;

int mm_init(void) {
    heap_start = (char *)mem_sbrk(0);
    return heap_start == (char *)-1 ? -1 : 0;
}

void *mm_malloc(size_t size) {
    /* 这是一个只会向前 bump 的起点：能分配，但不会复用/合并。 */
    size = (size + 7u) & ~7u;
    char *p = (char *)mem_sbrk((int)(size + 8));
    if (p == (char *)-1) return NULL;
    *(size_t *)p = size;
    return p + 8;
}

void mm_free(void *ptr) {
    (void)ptr;
}

void *mm_realloc(void *ptr, size_t size) {
    if (ptr == NULL) return mm_malloc(size);
    size_t old = *(size_t *)((char *)ptr - 8);
    void *q = mm_malloc(size);
    if (q == NULL) return NULL;
    memcpy(q, ptr, old < size ? old : size);
    mm_free(ptr);
    return q;
}
`;

  var prelude = `#include <stdio.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>

#define MM_HEAP_BYTES 262144
_Alignas(16) static unsigned char mm_heap[MM_HEAP_BYTES];
static size_t mm_heap_used = 0;
void *mem_sbrk(int incr) {
    if (incr < 0 || mm_heap_used + (size_t)incr > MM_HEAP_BYTES) return (void *)-1;
    void *p = mm_heap + mm_heap_used;
    mm_heap_used += (size_t)incr;
    return p;
}
size_t mem_heapsize(void) { return mm_heap_used; }
static void mm_heap_reset(void) { mm_heap_used = 0; memset(mm_heap, 0, MM_HEAP_BYTES); }
void *mm_malloc(size_t size);
void mm_free(void *ptr);
void *mm_realloc(void *ptr, size_t size);
int mm_init(void);
`;

  var harness = `
#define MM_MAX_BLOCKS 512
typedef struct { unsigned char *p; size_t n; unsigned char tag; } mm_rec_t;
static mm_rec_t mm_recs[MM_MAX_BLOCKS];
static int mm_nrec = 0;
static size_t mm_peak_payload = 0, mm_peak_heap = 0;
static int mm_realloc_seen = 0, mm_fail = 0;

static int mm_in_heap(void *p, size_t n) {
    uintptr_t a = (uintptr_t)mm_heap, z = a + MM_HEAP_BYTES, v = (uintptr_t)p;
    return p != NULL && v >= a && v <= z && n <= z - v;
}
static int mm_aligned(void *p) { return ((uintptr_t)p & 7u) == 0; }
static size_t mm_live_payload(void) {
    size_t s = 0; for (int i = 0; i < mm_nrec; i++) if (mm_recs[i].p) s += mm_recs[i].n; return s;
}
static int mm_overlap(void *p, size_t n, int ignore) {
    uintptr_t a = (uintptr_t)p, b = a + n;
    for (int i = 0; i < mm_nrec; i++) {
        if (i == ignore || !mm_recs[i].p) continue;
        uintptr_t c = (uintptr_t)mm_recs[i].p, d = c + mm_recs[i].n;
        if (a < d && c < b) return 1;
    }
    return 0;
}
static void mm_fill(void *p, size_t n, unsigned char tag) { memset(p, tag, n); }
static int mm_verify(void *p, size_t n, unsigned char tag) {
    unsigned char *q = (unsigned char *)p;
    for (size_t i = 0; i < n; i++) if (q[i] != tag) return 0;
    return 1;
}
static void mm_note_peak(void) {
    size_t payload = mm_live_payload(), heap = mem_heapsize();
    if (payload > mm_peak_payload) mm_peak_payload = payload;
    if (heap > mm_peak_heap) mm_peak_heap = heap;
}
static int mm_do_alloc(size_t n, unsigned char tag, const char *trace, int step) {
    if (mm_nrec >= MM_MAX_BLOCKS) return 1;
    void *p = mm_malloc(n);
    if (p == NULL) { printf("MFAIL %s step %d alloc %zu returned NULL\\n", trace, step, n); return 0; }
    if (!mm_aligned(p)) { printf("MFAIL %s step %d alloc misaligned %p\\n", trace, step, p); return 0; }
    if (!mm_in_heap(p, n)) { printf("MFAIL %s step %d alloc outside heap\\n", trace, step); return 0; }
    if (mm_overlap(p, n, -1)) { printf("MFAIL %s step %d alloc overlaps live block\\n", trace, step); return 0; }
    mm_fill(p, n, tag);
    mm_recs[mm_nrec].p = (unsigned char *)p; mm_recs[mm_nrec].n = n; mm_recs[mm_nrec].tag = tag; mm_nrec++;
    mm_note_peak();
    return 1;
}
static int mm_do_free(int idx, const char *trace, int step) {
    if (idx < 0 || idx >= mm_nrec || !mm_recs[idx].p) return 1;
    if (!mm_verify(mm_recs[idx].p, mm_recs[idx].n, mm_recs[idx].tag)) { printf("MFAIL %s step %d free corrupted payload\\n", trace, step); return 0; }
    mm_free(mm_recs[idx].p); mm_recs[idx].p = NULL;
    return 1;
}
static int mm_do_realloc(int idx, size_t n, unsigned char tag, const char *trace, int step) {
    if (idx < 0 || idx >= mm_nrec || !mm_recs[idx].p) return 1;
    if (!mm_verify(mm_recs[idx].p, mm_recs[idx].n, mm_recs[idx].tag)) { printf("MFAIL %s step %d realloc corrupted old payload\\n", trace, step); return 0; }
    size_t old = mm_recs[idx].n;
    void *q = mm_realloc(mm_recs[idx].p, n);
    if (q == NULL) { printf("MFAIL %s step %d realloc returned NULL\\n", trace, step); return 0; }
    if (!mm_aligned(q)) { printf("MFAIL %s step %d realloc misaligned\\n", trace, step); return 0; }
    if (!mm_in_heap(q, n)) { printf("MFAIL %s step %d realloc outside heap\\n", trace, step); return 0; }
    if (mm_overlap(q, n, idx)) { printf("MFAIL %s step %d realloc overlaps another block\\n", trace, step); return 0; }
    size_t keep = old < n ? old : n;
    if (!mm_verify(q, keep, mm_recs[idx].tag)) { printf("MFAIL %s step %d realloc lost prefix data\\n", trace, step); return 0; }
    mm_fill(q, n, tag);
    mm_recs[idx].p = (unsigned char *)q; mm_recs[idx].n = n; mm_recs[idx].tag = tag;
    mm_realloc_seen = 1;
    mm_note_peak();
    return 1;
}
static uint32_t mm_rand(uint32_t *s) { uint32_t x = *s; x ^= x << 13; x ^= x >> 17; x ^= x << 5; *s = x; return x; }

static int mm_reuse_test(void) {
    mm_heap_reset(); mm_nrec = 0;
    if (mm_init() != 0) { printf("MFAIL reuse mm_init failed\\n"); return 0; }
    void *a = mm_malloc(64), *b = mm_malloc(64), *c = mm_malloc(64);
    if (!a || !b || !c) { printf("MFAIL reuse initial alloc failed\\n"); return 0; }
    mm_fill(a, 64, 0xA1); mm_fill(b, 64, 0xB2); mm_fill(c, 64, 0xC3);
    mm_free(b);
    size_t before = mem_heapsize();
    void *d = mm_malloc(64);
    if (!d) { printf("MFAIL reuse alloc after free failed\\n"); return 0; }
    if (mem_heapsize() != before) { printf("MFAIL reuse freed block was not reused (heap grew)\\n"); return 0; }
    if (!mm_verify(a, 64, 0xA1) || !mm_verify(c, 64, 0xC3)) { printf("MFAIL reuse corrupted neighboring blocks\\n"); return 0; }
    mm_fill(d, 64, 0xD4);
    mm_free(a); mm_free(c); mm_free(d);
    printf("MREUSE pass=1\\n");
    return 1;
}

static int mm_run_trace(const char *name, int seed, int steps, int maxsize, int realloc_pct) {
    mm_heap_reset(); mm_nrec = 0; mm_peak_payload = 0; mm_peak_heap = 0; mm_realloc_seen = 0;
    if (mm_init() != 0) { printf("MFAIL %s mm_init failed\\n", name); return 0; }
    uint32_t s = (uint32_t)seed;
    for (int step = 0; step < steps; step++) {
        uint32_t r = mm_rand(&s);
        int live = 0; for (int i = 0; i < mm_nrec; i++) if (mm_recs[i].p) live++;
        int op = (int)(r % 100u);
        if (live == 0 || op < 50) {
            size_t n = 8 + (size_t)(mm_rand(&s) % (uint32_t)maxsize);
            if (!mm_do_alloc(n, (unsigned char)(r & 0xffu), name, step)) return 0;
        } else if (op < 100 - realloc_pct) {
            int idx = (int)(mm_rand(&s) % (uint32_t)mm_nrec);
            if (!mm_do_free(idx, name, step)) return 0;
        } else {
            int idx = (int)(mm_rand(&s) % (uint32_t)mm_nrec);
            size_t n = 8 + (size_t)(mm_rand(&s) % (uint32_t)maxsize);
            if (!mm_do_realloc(idx, n, (unsigned char)(r & 0xffu), name, step)) return 0;
        }
    }
    for (int i = 0; i < mm_nrec; i++) if (mm_recs[i].p) if (!mm_do_free(i, name, steps)) return 0;
    double util = mm_peak_heap ? 100.0 * (double)mm_peak_payload / (double)mm_peak_heap : 0.0;
    printf("MTRACE %s pass=1 util=%.2f ops=%d heap=%zu payload=%zu realloc=%d\\n",
           name, util, steps, mm_peak_heap, mm_peak_payload, mm_realloc_seen);
    return 1;
}

int main(void) {
    int reuse = mm_reuse_test();
    int ok = 1;
    ok &= mm_run_trace("short", 0x12345678, 600, 128, 15);
    ok &= mm_run_trace("mixed", 0x9e3779b9, 2500, 512, 15);
    ok &= mm_run_trace("realloc", 0xdeadbeef, 1200, 256, 55);
    ok &= mm_run_trace("small", 0x0badf00d, 1000, 64, 10);
    printf("MRESULT %d %d\\n", (ok && reuse) ? 1 : 0, reuse ? 1 : 0);
    return (ok && reuse) ? 0 : 1;
}
`;

  function clean(source) {
    return String(source)
      .replace(/^\s*#include\s+"memlib\.h"\s*$/gm, '')
      .replace(/^\s*#include\s+"malloclab\.h"\s*$/gm, '');
  }
  function build(source) {
    if (typeof source !== 'string' || source.length > 80000) throw new Error('源码为空或超过 80000 字符');
    var body = clean(source);
    return { source: prelude + '\n' + body + '\n' + harness, code: body };
  }
  function parse(output) {
    var text = String(output || '');
    var result = { ok: false, traces: [], failures: [], maxUtil: 0, minOpsPerSec: null, reallocOk: false };
    var re = /MTRACE\s+(\w+)\s+pass=(\d+)\s+util=([\d.]+)\s+ops=(\d+)\s+heap=(\d+)\s+payload=(\d+)\s+realloc=(\d+)/g, m;
    while ((m = re.exec(text))) {
      var tr = { name: m[1], pass: m[2] === '1', util: parseFloat(m[3]), ops: parseInt(m[4], 10), heap: parseInt(m[5], 10), payload: parseInt(m[6], 10), realloc: m[7] === '1' };
      result.traces.push(tr);
      if (tr.util > result.maxUtil) result.maxUtil = tr.util;
      if (tr.realloc) result.reallocOk = true;
    }
    var fre = /MFAIL[^\n]*/g, f;
    while ((f = fre.exec(text))) result.failures.push(f[0]);
    var mr = /MRESULT\s+([01])\s+([01])/.exec(text);
    result.reuseOk = !!mr && mr[2] === '1';
    result.ok = !!mr && mr[1] === '1' && result.traces.length === 4;
    return result;
  }
  return { starter: starter, build: build, parse: parse };
});
