/* Linker wrappers around the student's unchanged allocator, for one validity pass. */
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <unistd.h>
#include "memlib.h"

int __real_mm_init(void);
void *__real_mm_malloc(size_t);
void __real_mm_free(void *);
void *__real_mm_realloc(void *, size_t);

static FILE *out;
static int init_count;
static long long relative(void *p) {
    if (!p) return -1;
    return (long long)(uintptr_t)p - (long long)(uintptr_t)mem_heap_lo();
}
static void emit(const char *op, size_t size, void *oldp, void *newp, int code) {
    if (!out) return;
    fprintf(out, "{\"op\":\"%s\",\"size\":%zu,\"old\":%lld,\"ptr\":%lld,\"heap\":%zu,\"code\":%d}\n",
            op, size, relative(oldp), relative(newp), mem_heapsize(), code);
    fflush(out);
}
int __wrap_mm_init(void) {
    if (++init_count > 1) { fflush(NULL); _exit(86); } /* validity completed; skip util/timing */
    const char *path = getenv("OPEN3D_MALLOC_EVENTS");
    if (path) out = fopen(path, "w");
    int code = __real_mm_init();
    emit("init", 0, NULL, NULL, code);
    return code;
}
void *__wrap_mm_malloc(size_t size) {
    void *p = __real_mm_malloc(size); emit("alloc", size, NULL, p, 0); return p;
}
void __wrap_mm_free(void *p) {
    long long before = relative(p);
    __real_mm_free(p);
    if (out) { fprintf(out, "{\"op\":\"free\",\"size\":0,\"old\":%lld,\"ptr\":-1,\"heap\":%zu,\"code\":0}\n", before, mem_heapsize()); fflush(out); }
}
void *__wrap_mm_realloc(void *p, size_t size) {
    long long before = relative(p);
    void *q = __real_mm_realloc(p, size);
    if (out) { fprintf(out, "{\"op\":\"realloc\",\"size\":%zu,\"old\":%lld,\"ptr\":%lld,\"heap\":%zu,\"code\":0}\n", size, before, relative(q), mem_heapsize()); fflush(out); }
    return q;
}
