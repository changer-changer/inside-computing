# x86-64 execution dependency

The Emscripten loader and prebuilt WebAssembly binary are copied from the ISC-licensed [x86-64 playground](https://github.com/robalb/x86-64-playground), commit `d617f6a19879157c1debbe0454b6c4cff2ebe094`. The playground identifies its Blink fork at commit `71487ee40869b3ccac6cac9bb7a45d71484978d6`; the checked-out fork source is retained under `source/`. The exact relationship between that commit and upstream's checked-in prebuilt binary has not been independently reproduced.

`blink.js` is a transpiled adaptation of the upstream TypeScript wrapper. The unused assembler import and preload of upstream third-party assembler binaries were removed; this project provides its own small assembler and constructs ELF files. `source/wrapper-original.ts` and `source/wrapper-adapted.ts` preserve both versions. The upstream playground and Blink notices are included alongside this file. Other source files preserve their original notices. No GNU binutils, NASM or FASM binaries are included here.

SHA-256 of the unchanged upstream WASM: `dd409970974929ab04d6b45978df01140d63ad2054ba7a550b6259e0a07f476a`. Before public release, audit transitive notices, reproduce the binary and assess sandboxing and resource limits.
