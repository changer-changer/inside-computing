/* Development launcher for a QEMU shared library supplied by the user. */
#include <dlfcn.h>
#include <stdio.h>
extern char **environ;
int main(int argc, char **argv) {
    if (argc < 2) { fputs("QEMU library path is required\n", stderr); return 2; }
    void *handle = dlopen(argv[1], RTLD_NOW | RTLD_LOCAL);
    if (!handle) { fprintf(stderr, "%s\n", dlerror()); return 1; }
    int (*init)(int, const char **, const char **) = dlsym(handle, "qemu_init");
    void (*loop)(void) = dlsym(handle, "qemu_main_loop");
    void (*cleanup)(void) = dlsym(handle, "qemu_cleanup");
    if (!init || !loop || !cleanup) {
        int (*tool)(int, const char **) = dlsym(handle, "main");
        if (!tool) { fputs("QEMU entry points not found\n", stderr); return 1; }
        argv[1] = argv[0];
        return tool(argc - 1, (const char **)(argv + 1));
    }
    argv[1] = argv[0];
    init(argc - 1, (const char **)(argv + 1), (const char **)environ);
    loop();
    cleanup();
    return 0;
}
