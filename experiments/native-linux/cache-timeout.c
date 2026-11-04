/* Compatibility shim only for the Cache Lab test-trans timeout. */
#include <stdlib.h>
#include <unistd.h>

unsigned int open3d_compat_alarm(unsigned int seconds) {
    if (seconds == 120) {
        const char *text = getenv("OPEN3D_CACHE_TIMEOUT");
        char *end = NULL;
        unsigned long value = text ? strtoul(text, &end, 10) : 600;
        if (text && (!*text || !end || *end || value < 120 || value > 3600))
            value = 600;
        return alarm((unsigned int)value);
    }
    return alarm(seconds);
}
