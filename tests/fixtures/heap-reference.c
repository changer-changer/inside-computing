#include <stddef.h>
#include <stdint.h>
#include <stdalign.h>
#define ARENA_BYTES 256
_Alignas(8) unsigned char arena[ARENA_BYTES];
typedef struct { uint32_t size; uint32_t free; } Header;
static int initialized;
void *my_malloc(size_t n) {
    if (!initialized) { Header *h=(Header*)arena; h->size=248; h->free=1; initialized=1; }
    if (n==0 || n>248) return NULL;
    n=(n+7u)&~7u;
    for (size_t pos=0; pos<ARENA_BYTES;) {
        Header *h=(Header*)(arena+pos);
        if (h->free && h->size>=n) {
            if (h->size>=n+16) { Header *next=(Header*)(arena+pos+8+n); next->size=h->size-n-8; next->free=1; h->size=n; }
            h->free=0; return arena+pos+8;
        }
        pos+=8+h->size;
    }
    return NULL;
}
void my_free(void *ptr) {
    if (!ptr) return;
    ((Header*)((unsigned char*)ptr-8))->free=1;
    for (size_t pos=0; pos<ARENA_BYTES;) {
        Header *h=(Header*)(arena+pos); size_t next=pos+8+h->size;
        if (next<ARENA_BYTES && h->free && ((Header*)(arena+next))->free) h->size+=8+((Header*)(arena+next))->size;
        else pos=next;
    }
}
