# Browser C compiler dependency

`browsercc` 0.1.1 was obtained from the npm registry. Its wrapper is MIT licensed (see `LICENSE`). This copy excludes the optional C++ precompiled header and adapts the JavaScript wrapper to use the C driver name `clang` instead of `clang++`. The project's public build recipe references LLVM `llvmorg-20.1.2` and WASI SDK 25; the corresponding LLVM and wasi-libc notices are included here. The exact correspondence between the published package and the public build recipe has not been independently reproduced; audit all transitive components and build provenance before release.

- upstream: https://github.com/BertalanD/browsercc
- package: https://www.npmjs.com/package/browsercc/v/0.1.1
- clang.wasm SHA-256: d574339640a9764544f405d4b5ae79ef7d05e49725b416fba74f5b15c00f8ee5
- lld.wasm SHA-256: 810bb3be4eec8ad6bae60ceb7355c07bf7de8a54b5c8acb4d7a80613bd43c4bf
- sysroot.tar SHA-256: dbed83f93f0fa695f36041b82a95a8cd78f106a3f49d9cd860e57ae1ac823318

`../wasi` contains @bjorn3/browser_wasi_shim 0.4.2; its Apache-2.0 and MIT license texts are included there. The compiler targets wasm32-wasi, not x86-64 Linux; the compatibility boundaries are significant for CS:APP labs.
