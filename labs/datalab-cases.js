/* Data Lab · 测试生成、规则检查与 C harness 构造
   浏览器与 Node 共用；不包含学生答案。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DataLabCases = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var MASK = 0xFFFFFFFF;
  function u32(v) { return v >>> 0; }
  function s32(v) { return v | 0; }
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s >>> 0; };
  }
  var EDGES = [0x00000000, 0x00000001, 0x00000002, 0x00000003, 0x00000007, 0x0000000F,
    0x000000FF, 0x0000FFFF, 0x7FFFFFFF, 0x80000000, 0x80000001, 0xFFFFFFFF,
    0xFFFFFFFE, 0xFFFFFF00, 0xAAAAAAAA, 0x55555555, 0xDEADBEEF, 0x12345678];

  function howManyBits(x) {
    var s = x >> 31, v = u32((s & ~x) | (~s & x)), bits = 0;
    while (v) { bits++; v >>>= 1; }
    return bits + 1;
  }
  function scale2(uf) {
    uf = u32(uf);
    var e = (uf >>> 23) & 0xFF, s = uf & 0x80000000;
    if (e === 255) return uf;
    if (e === 0) return u32(s | (uf << 1));
    e++;
    if (e === 255) return u32(s | 0x7F800000);
    return u32((uf & 0x807FFFFF) | (e << 23));
  }
  function f2i(uf) {
    uf = u32(uf);
    var s = uf >>> 31, e = ((uf >>> 23) & 0xFF) - 127, m = (uf & 0x7FFFFF) | 0x800000, r;
    if (e < 0) return 0;
    if (e >= 31) return 0x80000000;
    if (e > 23) r = u32(m << (e - 23)); else r = m >>> (23 - e);
    return u32(s ? -r : r);
  }
  function p2(x) {
    if (x < -149) return 0;
    if (x < -126) return u32(1 << (x + 149));
    if (x > 127) return 0x7F800000;
    return u32((x + 127) << 23);
  }

  var TASKS = [
    {
      id: 'bitXor', name: 'bitXor', pts: 4, ops: 14, kind: 'int2', sig: 'int bitXor(int x, int y)',
      desc: '只用 ~ 和 & 实现 x ^ y。',
      hint: '德摩根：x ^ y = ~(~x & ~y) & ~(x & y)，再试着把它压到 8 个运算符以内。',
      starter: 'int bitXor(int x, int y) {\n  /* 只允许 ~ & | ^ + << >> ! */\n  return 2;\n}'
    },
    {
      id: 'tmin', name: 'tmin', pts: 4, ops: 4, kind: 'noarg', sig: 'int tmin(void)',
      desc: '返回最小的 32 位补码整数（0x80000000）。',
      hint: '最小的补码整数只有最高位为 1。用 1 左移 31 位。',
      starter: 'int tmin(void) {\n  return 1;\n}'
    },
    {
      id: 'isTmax', name: 'isTmax', pts: 4, ops: 10, kind: 'int1', sig: 'int isTmax(int x)',
      desc: 'x 是 INT_MAX（0x7FFFFFFF）时返回 1，否则返回 0。',
      hint: 'INT_MAX + 1 会变成 INT_MIN；~(INT_MAX + 1) 是 INT_MAX。注意排除 x = -1 时同样的 bit 模式。',
      starter: 'int isTmax(int x) {\n  return 0;\n}'
    },
    {
      id: 'allOddBits', name: 'allOddBits', pts: 4, ops: 12, kind: 'int1', sig: 'int allOddBits(int x)',
      desc: '当 x 的所有奇数位（bit 1,3,…,31）都为 1 时返回 1。',
      hint: '构造 0xAAAAAAAA：0xAA 左移 8 位再合并，最后扩展到 32 位。',
      starter: 'int allOddBits(int x) {\n  return 0;\n}'
    },
    {
      id: 'negate', name: 'negate', pts: 4, ops: 5, kind: 'int1', sig: 'int negate(int x)',
      desc: '返回 -x，不能使用一元减号。',
      hint: '补码取负：~x + 1。',
      starter: 'int negate(int x) {\n  return 0;\n}'
    },
    {
      id: 'isAsciiDigit', name: 'isAsciiDigit', pts: 6, ops: 15, kind: 'int1', sig: 'int isAsciiDigit(int x)',
      desc: 'x 是 ASCII 数字 0x30–0x39 时返回 1。',
      hint: '先算 x - 0x30，再看符号；再算 0x39 - x，看符号。两个都非负才是数字。',
      starter: 'int isAsciiDigit(int x) {\n  return 0;\n}'
    },
    {
      id: 'conditional', name: 'conditional', pts: 6, ops: 16, kind: 'int3', sig: 'int conditional(int x, int y, int z)',
      desc: '实现 x ? y : z，不能使用条件分支。',
      hint: '先用 !x 和 ~ 构造全 0/全 1 掩码，再用 & 和 | 选择。',
      starter: 'int conditional(int x, int y, int z) {\n  return 0;\n}'
    },
    {
      id: 'isLessOrEqual', name: 'isLessOrEqual', pts: 8, ops: 24, kind: 'int2', sig: 'int isLessOrEqual(int x, int y)',
      desc: '有符号比较 x <= y 时返回 1。',
      hint: '先比较符号位：异号时由 x 的符号决定；同号时看 y - x 的符号。注意相减可能溢出。',
      starter: 'int isLessOrEqual(int x, int y) {\n  return 0;\n}'
    },
    {
      id: 'logicalNeg', name: 'logicalNeg', pts: 8, ops: 12, kind: 'int1', sig: 'int logicalNeg(int x)',
      desc: '不用 ! 实现逻辑非：x 为 0 返回 1，否则返回 0。',
      hint: 'x | (~x + 1) 的符号位：x 非零时为 1，x 为零时为 0。再右移并加一。',
      starter: 'int logicalNeg(int x) {\n  return 0;\n}'
    },
    {
      id: 'howManyBits', name: 'howManyBits', pts: 16, ops: 90, kind: 'int1', sig: 'int howManyBits(int x)',
      desc: '返回表示 x 所需的最少补码位数。',
      hint: '负数先取反，转成“需要多少位无符号表示”的问题；再用二分：16、8、4、2、1。最后别忘了符号位。',
      starter: 'int howManyBits(int x) {\n  return 0;\n}'
    },
    {
      id: 'floatScale2', name: 'floatScale2', pts: 12, ops: 40, kind: 'float1', sig: 'unsigned floatScale2(unsigned uf)',
      desc: '返回 2*f 的位模式，f 是 uf 解释出的 float；处理非规格化数、无穷与 NaN。',
      hint: '指数为 0 时整体左移一位；指数为 255 时原样返回；否则指数加一，溢出成无穷。不要用浮点运算。',
      starter: 'unsigned floatScale2(unsigned uf) {\n  return uf;\n}'
    },
    {
      id: 'floatFloat2Int', name: 'floatFloat2Int', pts: 12, ops: 40, kind: 'float1', sig: 'int floatFloat2Int(unsigned uf)',
      desc: '把 float 位模式转成 int，向零舍入；越界或 NaN 返回 0x80000000。',
      hint: '拆出符号、指数、小数；实际指数小于 0 返回 0；大于等于 31 返回 INT_MIN；否则按 23 位小数点移动。',
      starter: 'int floatFloat2Int(unsigned uf) {\n  return 0;\n}'
    },
    {
      id: 'floatPower2', name: 'floatPower2', pts: 12, ops: 40, kind: 'float2', sig: 'unsigned floatPower2(int x)',
      desc: '返回 2.0^x 的 float 位模式。',
      hint: '分三段：太小返回 0；非规格化范围 1 << (x+149)；规格化范围 (x+127) << 23；太大返回无穷。',
      starter: 'unsigned floatPower2(int x) {\n  return 0;\n}'
    }
  ];

  function cases(id) {
    var rand = rng(0x9E3779B9), out = [], i, x, y, z;
    if (id === 'bitXor' || id === 'isLessOrEqual') {
      for (i = 0; i < EDGES.length; i++) for (var j = 0; j < EDGES.length; j++) {
        x = EDGES[i]; y = EDGES[j];
        out.push([x, y, id === 'bitXor' ? u32(x ^ y) : (s32(x) <= s32(y) ? 1 : 0)]);
      }
      for (i = 0; i < 300; i++) { x = rand(); y = rand(); out.push([x, y, id === 'bitXor' ? u32(x ^ y) : (s32(x) <= s32(y) ? 1 : 0)]); }
      return out;
    }
    if (id === 'tmin') return [[0x80000000]];
    if (id === 'isTmax' || id === 'allOddBits' || id === 'negate' || id === 'logicalNeg' || id === 'howManyBits') {
      for (i = 0; i < EDGES.length; i++) {
        x = EDGES[i];
        out.push([x, id === 'isTmax' ? (x === 0x7FFFFFFF ? 1 : 0) : id === 'allOddBits' ? (u32(x & 0xAAAAAAAA) === 0xAAAAAAAA ? 1 : 0) : id === 'negate' ? u32(-x) : id === 'logicalNeg' ? (x === 0 ? 1 : 0) : howManyBits(s32(x))]);
      }
      for (i = 0; i < 400; i++) { x = rand(); out.push([x, id === 'isTmax' ? (x === 0x7FFFFFFF ? 1 : 0) : id === 'allOddBits' ? (u32(x & 0xAAAAAAAA) === 0xAAAAAAAA ? 1 : 0) : id === 'negate' ? u32(-x) : id === 'logicalNeg' ? (x === 0 ? 1 : 0) : howManyBits(s32(x))]); }
      return out;
    }
    if (id === 'isAsciiDigit') {
      for (i = 0; i < 0x50; i++) { x = i; out.push([x, (x >= 0x30 && x <= 0x39) ? 1 : 0]); }
      for (i = 0; i < 300; i++) { x = rand(); out.push([x, (s32(x) >= 0x30 && s32(x) <= 0x39) ? 1 : 0]); }
      return out;
    }
    if (id === 'conditional') {
      for (i = 0; i < 120; i++) { x = rand(); y = rand(); z = rand(); out.push([x, y, z, x !== 0 ? y : z]); }
      return out;
    }
    if (id === 'floatScale2') {
      var floatEdges = [0x00000000, 0x80000000, 0x00000001, 0x007FFFFF, 0x00800000, 0x3F800000, 0x3DCCCCCD, 0x7F7FFFFF, 0x7F800000, 0xFF800000, 0x7FC00001, 0x7F000000, 0x7EFFFFFF];
      for (i = 0; i < floatEdges.length; i++) out.push([floatEdges[i], scale2(floatEdges[i])]);
      for (i = 0; i < 300; i++) { x = rand(); out.push([x, scale2(x)]); }
      return out;
    }
    if (id === 'floatFloat2Int') {
      var fEdges = [0x00000000, 0x80000000, 0x00000001, 0x007FFFFF, 0x00800000, 0x3F800000, 0x3DCCCCCD, 0x3F000000, 0xBF800000, 0x4B000000, 0x4F000000, 0xCF000000, 0x7F800000, 0xFF800000, 0x7FC00001, 0x4EFFFFFF];
      for (i = 0; i < fEdges.length; i++) out.push([fEdges[i], f2i(fEdges[i])]);
      for (i = 0; i < 300; i++) { x = rand(); out.push([x, f2i(x)]); }
      return out;
    }
    if (id === 'floatPower2') {
      for (x = -160; x <= 140; x++) out.push([u32(x), p2(x)]);
      return out;
    }
    throw new Error('unknown task ' + id);
  }

  function C(v) { return '0x' + u32(v).toString(16).toUpperCase().padStart(8, '0'); }
  function buildSource(id, code) {
    var t = TASKS.find(function (x) { return x.id === id; });
    if (!t) throw new Error('unknown task');
    var cs = cases(id), rows = cs.map(function (c) { return '{' + c.map(C).join(',') + '}'; }).join(',\n');
    var body, cols;
    if (t.kind === 'noarg') {
      body = '  uint32_t got=(uint32_t)tmin();\n  if(got!=0x80000000u){printf("CAFAIL 0 0x%08X\\n",(unsigned)got);printf("CARESULT 0 1\\n");return 1;}\n  printf("CARESULT 1 1\\n");return 0;';
      cols = 1;
    } else if (t.kind === 'int1' || t.kind === 'float1') {
      cols = 2;
      body = '  for(unsigned i=0;i<total;i++){uint32_t got=(uint32_t)(' + t.id + '((int)T[i][0]));uint32_t want=T[i][1];if(got!=want){if(fail<4)printf("CAFAIL %u x=0x%08X got=0x%08X want=0x%08X\\n",i,(unsigned)T[i][0],(unsigned)got,(unsigned)want);fail++;}}\n  printf("CARESULT %u %u\\n",total-fail,total);return fail?1:0;';
      if (t.kind === 'float1' && id !== 'floatFloat2Int') body = '  for(unsigned i=0;i<total;i++){uint32_t got=(uint32_t)(' + t.id + '(T[i][0]));uint32_t want=T[i][1];if(got!=want){if(fail<4)printf("CAFAIL %u x=0x%08X got=0x%08X want=0x%08X\\n",i,(unsigned)T[i][0],(unsigned)got,(unsigned)want);fail++;}}\n  printf("CARESULT %u %u\\n",total-fail,total);return fail?1:0;';
    } else if (t.kind === 'int2' || t.kind === 'float2') {
      cols = 2;
      if (t.kind === 'float2') {
        body = '  for(unsigned i=0;i<total;i++){uint32_t got=(uint32_t)(' + t.id + '((int)T[i][0]));uint32_t want=T[i][1];if(got!=want){if(fail<4)printf("CAFAIL %u x=0x%08X got=0x%08X want=0x%08X\\n",i,(unsigned)T[i][0],(unsigned)got,(unsigned)want);fail++;}}\n  printf("CARESULT %u %u\\n",total-fail,total);return fail?1:0;';
      } else {
        cols = 3;
        body = '  for(unsigned i=0;i<total;i++){uint32_t got=(uint32_t)(' + t.id + '((int)T[i][0],(int)T[i][1]));uint32_t want=T[i][2];if(got!=want){if(fail<4)printf("CAFAIL %u x=0x%08X y=0x%08X got=0x%08X want=0x%08X\\n",i,(unsigned)T[i][0],(unsigned)T[i][1],(unsigned)got,(unsigned)want);fail++;}}\n  printf("CARESULT %u %u\\n",total-fail,total);return fail?1:0;';
      }
    } else if (t.kind === 'int3') {
      cols = 4;
      body = '  for(unsigned i=0;i<total;i++){uint32_t got=(uint32_t)(' + t.id + '((int)T[i][0],(int)T[i][1],(int)T[i][2]));uint32_t want=T[i][3];if(got!=want){if(fail<4)printf("CAFAIL %u x=0x%08X y=0x%08X z=0x%08X got=0x%08X want=0x%08X\\n",i,(unsigned)T[i][0],(unsigned)T[i][1],(unsigned)T[i][2],(unsigned)got,(unsigned)want);fail++;}}\n  printf("CARESULT %u %u\\n",total-fail,total);return fail?1:0;';
    } else throw new Error('unknown kind');
    var decl = 'static const uint32_t T[][COLS] = {\nROW\n};'.replace('COLS', cols).replace('ROW', rows || '{0}');
    var src = '#include <stdio.h>\n#include <stdint.h>\n\n' + code + '\n\n' +
      decl + '\n\nint main(void){\n  static const unsigned total=(unsigned)(sizeof(T)/sizeof(T[0]));\n  unsigned fail=0;\n' + body + '\n}\n';
    return { source: src, cases: cs.length, task: t };
  }

  /* ---------------- rule checker ---------------- */
  function strip(code) {
    return String(code).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ').replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:\\.|[^'\\])*'/g, "''");
  }
  function bodyOf(code, name) {
    var s = strip(code), re = new RegExp('\\b' + name + '\\s*\\([^)]*\\)\\s*\\{');
    var m = re.exec(s); if (!m) return null;
    var start = s.indexOf('{', m.index + m[0].length - 1), depth = 0;
    for (var i = start; i < s.length; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') { depth--; if (!depth) return { body: s.slice(start + 1, i), full: s.slice(m.index, i + 1) }; }
    }
    return null;
  }
  var TOKEN = /(0x[0-9a-fA-F]+|\d+)|(<<|>>|<=|>=|==|!=|&&|\|\||\+=|-=|\*=|\/=|%=|&=|\|=|\^=|\+\+|--|->)|([A-Za-z_]\w*)|([!~&^|+*/%<>=,;(){}[\]])/g;
  function checkRules(code, id) {
    var t = TASKS.find(function (x) { return x.id === id; }); if (!t) throw new Error('unknown task');
    var found = bodyOf(code, t.id);
    if (!found) return { ok: false, ops: 0, errors: ['没有找到函数定义 ' + t.id + '，请保留函数签名。'], warnings: [], constants: [] };
    var body = found.body, errors = [], warnings = [], ops = 0, maxConst = 0, calls = [], forbidden = [], tokens = [], m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(body))) {
      if (m[1]) tokens.push({ k: 'num', v: m[1] });
      else if (m[2]) tokens.push({ k: 'op', v: m[2] });
      else if (m[3]) tokens.push({ k: 'id', v: m[3] });
      else tokens.push({ k: 'op', v: m[4] });
    }
    var isFloat = t.kind.indexOf('float') === 0;
    var allowedInt = ['!', '~', '&', '^', '|', '+', '<<', '>>'];
    var allowedFloat = allowedInt.concat(['-', '*', '/', '%', '<', '>', '<=', '>=', '==', '!=', '&&', '||', '[', ']', '?', ':']);
    var allowed = isFloat ? allowedFloat : allowedInt;
    var controls = ['if', 'for', 'while', 'do', 'switch', 'case', 'default', 'goto', 'break', 'continue'];
    var typeWords = ['int', 'unsigned', 'signed', 'long', 'short', 'char', 'const', 'void'];
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (tk.k === 'num') {
        var n = /^0x/i.test(tk.v) ? parseInt(tk.v, 16) : parseInt(tk.v, 10);
        if (n > maxConst) maxConst = n;
        var limit = isFloat ? 0xFFFFFFFF : 255;
        if (n > limit) forbidden.push('常量 ' + tk.v + ' 超过 ' + (isFloat ? '32 位' : '255'));
      } else if (tk.k === 'op') {
        if (allowed.indexOf(tk.v) >= 0) {
          if (['!', '~', '&', '^', '|', '+', '<<', '>>', '-'].indexOf(tk.v) >= 0) ops++;
        } else if (['=', ';', ',', '(', ')', '{', '}'].indexOf(tk.v) >= 0) { }
        else if (tk.v === '-' && !isFloat) forbidden.push('不允许使用减号 -（可用 ~ 和 + 构造）');
        else if (['*', '/', '%', '<', '>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '++', '--', '[', ']', '?', ':'].indexOf(tk.v) >= 0) forbidden.push('此题不允许运算符 ' + tk.v);
        else forbidden.push('不允许的符号 ' + tk.v);
      } else if (tk.k === 'id') {
        var isControl = controls.indexOf(tk.v) >= 0;
        if (isControl && !isFloat) forbidden.push('不允许控制流：' + tk.v);
        if (tk.v === 'float' || tk.v === 'double') forbidden.push('不允许浮点类型：' + tk.v);
        if (!isControl && typeWords.indexOf(tk.v) < 0 && tk.v !== 'return' && tk.v !== 'sizeof') {
          if (tokens[i + 1] && tokens[i + 1].v === '(') calls.push(tk.v);
        }
      }
    }
    // shift count check
    for (i = 0; i < tokens.length; i++) {
      if ((tokens[i].v === '<<' || tokens[i].v === '>>') && tokens[i + 1] && tokens[i + 1].k === 'num') {
        var sh = /^0x/i.test(tokens[i + 1].v) ? parseInt(tokens[i + 1].v, 16) : parseInt(tokens[i + 1].v, 10);
        if (sh > 31) warnings.push('移位位数 ' + sh + ' 超过 31，结果在 C 中未定义');
      }
    }
    if (ops > t.ops) errors.push('使用了 ' + ops + ' 个运算符，超过上限 ' + t.ops);
    if (calls.length) errors.push('不允许函数调用：' + calls.join('、'));
    if (forbidden.length) errors.push.apply(errors, Array.from(new Set(forbidden)));
    if (maxConst > (isFloat ? 0xFFFFFFFF : 255)) errors.push('常量超出范围：最大 ' + maxConst);
    if (isFloat) warnings.push('浮点题允许条件/比较，但仍禁止浮点运算与库函数；本地检查不替代官方 dlc。');
    return { ok: errors.length === 0, ops: ops, errors: errors, warnings: warnings, maxConst: maxConst, limit: t.ops };
  }

  function parseOutput(text) {
    var res = { pass: 0, total: 0, fails: [] };
    var m = /CARESULT\s+(\d+)\s+(\d+)/.exec(text || '');
    if (m) { res.pass = +m[1]; res.total = +m[2]; }
    var re = /CAFAIL[^\n]*/g, f;
    while ((f = re.exec(text || ''))) res.fails.push(f[0]);
    return res;
  }

  return { tasks: TASKS, cases: cases, buildSource: buildSource, checkRules: checkRules, parseOutput: parseOutput, expected: { scale2: scale2, f2i: f2i, p2: p2, howManyBits: howManyBits } };
});
