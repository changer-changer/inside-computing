/* Performance Lab 浏览器相对性能检查：wasm32 编译学生的官方 rotate/smooth kernel，
   与官方 naive 起始实现比较运行时间并比对输出 hash。不是官方 fcyc/CPE。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PerfHarness = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var starter = `static int pmin(int a, int b) { return a < b ? a : b; }
static int pmax(int a, int b) { return a > b ? a : b; }

void rotate(int dim, pixel *src, pixel *dst) {
    int i, j;
    for (i = 0; i < dim; i++)
        for (j = 0; j < dim; j++)
            dst[RIDX(dim - 1 - j, i, dim)] = src[RIDX(i, j, dim)];
}

static void init_sum(pixel_sum *s) { s->red = s->green = s->blue = 0; s->num = 0; }
static void acc_sum(pixel_sum *s, pixel p) {
    s->red += (int)p.red; s->green += (int)p.green; s->blue += (int)p.blue; s->num++;
}
static void assign_sum(pixel *out, pixel_sum s) {
    out->red = (unsigned short)(s.red / s.num);
    out->green = (unsigned short)(s.green / s.num);
    out->blue = (unsigned short)(s.blue / s.num);
}
static pixel avg_pixel(int dim, int i, int j, pixel *src) {
    int ii, jj; pixel_sum sum; pixel out;
    init_sum(&sum);
    for (ii = pmax(i - 1, 0); ii <= pmin(i + 1, dim - 1); ii++)
        for (jj = pmax(j - 1, 0); jj <= pmin(j + 1, dim - 1); jj++)
            acc_sum(&sum, src[RIDX(ii, jj, dim)]);
    assign_sum(&out, sum); return out;
}
void smooth(int dim, pixel *src, pixel *dst) {
    int i, j;
    for (i = 0; i < dim; i++)
        for (j = 0; j < dim; j++)
            dst[RIDX(i, j, dim)] = avg_pixel(dim, i, j, src);
}
`;
  var prelude = `#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#define RIDX(i,j,n) ((i)*(n)+(j))
typedef struct { unsigned short red, green, blue; } pixel;
typedef struct { int red, green, blue, num; } pixel_sum;
`;

  function build(code, mode) {
    if (typeof code !== 'string' || code.length > 60000) throw new Error('源码为空或超过 60000 字符');
    if (mode !== 'rotate' && mode !== 'smooth') throw new Error('未知 kernel');
    var main = `
#define DIM 512
static pixel src[DIM * DIM], dst[DIM * DIM];
static unsigned long long hash64(const void *p, size_t n) {
    const unsigned char *b = (const unsigned char *)p;
    unsigned long long h = 1469598103934665603ULL;
    for (size_t i = 0; i < n; i++) { h ^= b[i]; h *= 1099511628211ULL; }
    return h;
}
int main(void) {
    for (int i = 0; i < DIM * DIM; i++) {
        src[i].red = (unsigned short)((i * 7) & 255);
        src[i].green = (unsigned short)((i * 13 + 5) & 255);
        src[i].blue = (unsigned short)((i * 29 + 11) & 255);
    }
    for (int rep = 0; rep < ${mode === 'rotate' ? 8 : 4}; rep++) {
        memset(dst, 0, sizeof(dst));
        ${mode}(DIM, src, dst);
    }
    unsigned long long h = hash64(dst, sizeof(dst));
    printf("${mode.toUpperCase()}_HASH %016llx\\n", h);
    return 0;
}
`;
    return { source: prelude + code + '\n' + main, mode: mode };
  }

  function parse(output, mode) {
    var text = String(output || '');
    var re = mode === 'rotate' ? /ROTATE_HASH\s+([0-9a-fA-F]+)/ : /SMOOTH_HASH\s+([0-9a-fA-F]+)/;
    var m = re.exec(text);
    return { ok: !!m, value: m ? m[1].toLowerCase() : null, raw: text };
  }
  function same(a, b) { return !!a && !!b && a === b; }

  return { starter: starter, build: build, parse: parse, same: same };
});
