// ---------- running code (docs/phase3-spec.md) ----------
// User code runs only in a worker made from page text, one worker per run, stopped with terminate() (feasibility rule 2).
const RUN_LIMIT_MS = 5000, LINE_CAP = 1000, ROW_SHOW = 500;
const MSG = {
  timeout: 'Stopped after 5 s: the code was still running. Look for an endless loop, runaway recursion or a timer that never stops.',
  capped: 'Output stopped at 1,000 lines.',
  stopped: 'Stopped.',
  blocked: 'This browser blocks running code in the page, so Run is off here. The answer and Compare still work.',
  unpack: 'This browser cannot unpack the code runner. Use a current Chrome, Edge, Firefox or Safari.',
};

// The TypeScript/JavaScript worker. It is turned into text with its source and runs after Sucrase in the worker, so it may
// use nothing from the page.
function tsWorkerMain() {
  const realSet = setTimeout, realClear = clearTimeout, realSetI = setInterval, realClearI = clearInterval;
  const post = m => postMessage(m);
  let lines = 0, capped = false;

  // --- values printed the way Node's util.inspect prints them (defaults: depth 2, breakLength 80, compact 3) ---
  const IDENT = /^[a-zA-Z_][a-zA-Z_0-9]*$/;
  function quote(s) {
    let q = "'";
    if (s.includes("'")) { if (!s.includes('"')) q = '"'; else if (!s.includes('`') && !s.includes('${')) q = '`'; }
    const esc = s.replace(/[\\\x00-\x1f\x7f]/g, c => ({ '\\': '\\\\', '\n': '\\n', '\t': '\\t', '\r': '\\r', '\b': '\\b', '\f': '\\f', '\v': '\\v' }[c]
      || '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()));
    return q + (q === "'" ? esc.replace(/'/g, "\\'") : esc) + q;
  }
  function primitive(ctx, v) {
    switch (typeof v) {
      case 'string':
        if (v.length > 16 && v.length > ctx.breakLength - ctx.indentationLvl - 4)
          return v.split(/(?<=\n)/).map(quote).join(` +\n${' '.repeat(ctx.indentationLvl + 2)}`);
        return quote(v);
      case 'number': return Object.is(v, -0) ? '-0' : String(v);
      case 'bigint': return `${v}n`;
      case 'symbol': return v.toString();
      default: return String(v);
    }
  }
  function ctorName(v) {
    let o = v;
    while (o !== null) {
      const d = Object.getOwnPropertyDescriptor(o, 'constructor');
      if (d && typeof d.value === 'function' && d.value.name !== '') return d.value.name;
      o = Object.getPrototypeOf(o);
    }
    return null;
  }
  function prefix(ctor, tag, fallback, size = '') {
    if (ctor === null) return tag !== '' && fallback !== tag ? `[${fallback}${size}: null prototype] [${tag}] ` : `[${fallback}${size}: null prototype] `;
    return tag !== '' && ctor !== tag ? `${ctor}${size} [${tag}] ` : `${ctor}${size} `;
  }
  function key(k) { return typeof k === 'symbol' ? `[${k.toString()}]` : IDENT.test(k) ? k : quote(k); }
  function prop(ctx, obj, k, depth, arrayItem) {
    const d = Object.getOwnPropertyDescriptor(obj, k);
    let str;
    if (d.value !== undefined || !('get' in d || 'set' in d)) { ctx.indentationLvl += 2; str = value(ctx, d.value, depth); ctx.indentationLvl -= 2; }
    else str = d.get ? (d.set ? '[Getter/Setter]' : '[Getter]') : '[Setter]';
    return arrayItem ? str : `${key(k)}: ${str}`;
  }
  function fnBase(v) {
    const src = Function.prototype.toString.call(v);
    if (/^class\b/.test(src)) return `[class ${v.name || '(anonymous)'}${(() => { const p = Object.getPrototypeOf(v); return p && p.name ? ` extends ${p.name}` : ''; })()}]`;
    const kind = Object.prototype.toString.call(v).slice(8, -1);
    const type = kind === 'AsyncFunction' ? 'AsyncFunction' : kind === 'GeneratorFunction' ? 'GeneratorFunction' : kind === 'AsyncGeneratorFunction' ? 'AsyncGeneratorFunction' : 'Function';
    return v.name ? `[${type}: ${v.name}]` : `[${type} (anonymous)]`;
  }
  function errText(e) { const s = e.stack && typeof e.stack === 'string' && e.stack.startsWith(`${e.name}: `) ? e.stack.split('\n')[0] : `${e.name || 'Error'}: ${e.message}`; return e.message === '' ? (e.name || 'Error') : s; }
  function value(ctx, v, depth) {
    if (v === null || (typeof v !== 'object' && typeof v !== 'function')) return primitive(ctx, v);
    if (ctx.seen.includes(v)) return '[Circular *1]';
    return raw(ctx, v, depth);
  }
  function raw(ctx, v, depth) {
    const ctor = ctorName(v);
    let tag = v[Symbol.toStringTag];
    if (typeof tag !== 'string' || tag === ctor) tag = '';
    let keys = Object.keys(v), base = '', braces, format, extras = 'object', noEntries = false;
    const syms = Object.getOwnPropertySymbols(v).filter(s => Object.prototype.propertyIsEnumerable.call(v, s));
    if (Array.isArray(v)) {
      keys = keys.filter(k => !/^(0|[1-9]\d*)$/.test(k) || +k >= v.length);
      const pre = ctor !== 'Array' || tag !== '' ? prefix(ctor, tag, 'Array', `(${v.length})`) : '';
      braces = [`${pre}[`, ']']; extras = 'array';
      if (v.length === 0 && keys.length === 0 && syms.length === 0) return `${braces[0]}]`;
      format = () => {
        const out = []; let holes = 0;
        const shown = Math.min(100, v.length);
        for (let i = 0; i < shown; i++) {
          if (!Object.prototype.hasOwnProperty.call(v, i)) { holes++; continue; }
          if (holes) { out.push(`<${holes} empty item${holes > 1 ? 's' : ''}>`); holes = 0; }
          out.push(prop(ctx, v, String(i), depth, true));
        }
        if (holes) out.push(`<${holes} empty item${holes > 1 ? 's' : ''}>`);
        if (v.length > shown) out.push(`... ${v.length - shown} more item${v.length - shown > 1 ? 's' : ''}`);
        return out;
      };
    } else if (v instanceof Map) {
      braces = [`${prefix(ctor, tag, 'Map', `(${v.size})`)}{`, '}'];
      if (v.size === 0 && keys.length === 0) return `${braces[0]}}`;
      format = () => { const out = []; ctx.indentationLvl += 2; for (const [k, x] of v) out.push(`${value(ctx, k, depth)} => ${value(ctx, x, depth)}`); ctx.indentationLvl -= 2; return out; };
    } else if (v instanceof Set) {
      braces = [`${prefix(ctor, tag, 'Set', `(${v.size})`)}{`, '}'];
      if (v.size === 0 && keys.length === 0) return `${braces[0]}}`;
      format = () => { const out = []; ctx.indentationLvl += 2; for (const x of v) out.push(value(ctx, x, depth)); ctx.indentationLvl -= 2; return out; };
    } else if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
      keys = keys.filter(k => !/^(0|[1-9]\d*)$/.test(k));
      braces = [`${prefix(ctor, tag, 'TypedArray', `(${v.length})`)}[`, ']']; extras = 'array';
      if (v.length === 0 && keys.length === 0) return `${braces[0]}]`;
      format = () => { const out = []; for (let i = 0; i < Math.min(100, v.length); i++) out.push(primitive(ctx, v[i])); if (v.length > 100) out.push(`... ${v.length - 100} more items`); return out; };
    } else {
      noEntries = true;
      if (typeof v === 'function') {
        base = fnBase(v);
        if (keys.length === 0 && syms.length === 0) return base;
      } else if (v instanceof RegExp) {
        base = RegExp.prototype.toString.call(v);
        if (keys.length === 0) return base;
      } else if (v instanceof Date) {
        base = Number.isNaN(v.getTime()) ? 'Invalid Date' : v.toISOString();
        if (keys.length === 0) return base;
      } else if (v instanceof Error) {
        base = errText(v);
        if (keys.length === 0) return depth > 0 ? `[${base}]` : base;
      } else if (v instanceof Promise) {
        braces = [`${prefix(ctor, tag, 'Promise')}{`, '}'];
        format = () => ['<unknown>'];
        noEntries = false;
      } else if (v instanceof WeakMap || v instanceof WeakSet) {
        return `${prefix(ctor, tag, v instanceof WeakMap ? 'WeakMap' : 'WeakSet')}{ <items unknown> }`;
      } else if (['Number', 'String', 'Boolean', 'BigInt', 'Symbol'].some(t => Object.prototype.toString.call(v) === `[object ${t}]`) && typeof v.valueOf === 'function') {
        const t = Object.prototype.toString.call(v).slice(8, -1);
        base = `[${t}: ${primitive({ breakLength: Infinity, indentationLvl: 0 }, v.valueOf())}]`;
        if (t === 'String') keys = keys.filter(k => !/^\d+$/.test(k));
        if (keys.length === 0) return base;
      }
      if (!braces) {
        braces = ['{', '}'];
        if (base === '') {
          if (ctor === 'Object') { if (tag !== '') braces[0] = `${prefix(ctor, tag, 'Object')}{`; }
          else braces[0] = `${prefix(ctor, tag, 'Object')}{`;
          if (keys.length === 0 && syms.length === 0) return `${braces[0]}}`;
        }
      }
    }
    if (depth > ctx.depth) return `[${(ctor || tag || 'Object').replace(/^Array$/, 'Array')}]`;
    depth += 1;
    ctx.seen.push(v); ctx.currentDepth = depth;
    let out = format && !noEntries ? format() : [];
    for (const k of keys) out.push(prop(ctx, v, k, depth, false));
    for (const s of syms) out.push(prop(ctx, v, s, depth, false));
    ctx.seen.pop();
    return reduce(ctx, out, base, braces, extras, depth, v);
  }
  function group(ctx, output, v) {
    let total = 0, maxLen = 0, outLen = output.length;
    if (v && v.length > 100 && output.length > 100) outLen--;
    const sep = 2, dataLen = new Array(outLen);
    for (let i = 0; i < outLen; i++) { const len = output[i].length; dataLen[i] = len; total += len + sep; if (maxLen < len) maxLen = len; }
    const actualMax = maxLen + sep;
    if (actualMax * 3 + ctx.indentationLvl < ctx.breakLength && (total / actualMax > 5 || maxLen <= 6)) {
      const averageBias = Math.sqrt(actualMax - total / output.length), biasedMax = Math.max(actualMax - 3 - averageBias, 1);
      const columns = Math.min(Math.round(Math.sqrt(2.5 * biasedMax * outLen) / biasedMax), Math.floor((ctx.breakLength - ctx.indentationLvl) / actualMax), ctx.compact * 4, 15);
      if (columns <= 1) return output;
      const tmp = [], maxLine = [];
      for (let i = 0; i < columns; i++) { let l = 0; for (let j = i; j < output.length; j += columns) if (dataLen[j] > l) l = dataLen[j]; maxLine.push(l + sep); }
      let padStart = true;
      if (v !== undefined) for (let i = 0; i < output.length; i++) if (typeof v[i] !== 'number' && typeof v[i] !== 'bigint') { padStart = false; break; }
      for (let i = 0; i < outLen; i += columns) {
        const max = Math.min(i + columns, outLen); let str = '', j = i;
        for (; j < max - 1; j++) { const s = `${output[j]}, `; str += padStart ? s.padStart(maxLine[j - i]) : s.padEnd(maxLine[j - i]); }
        str += padStart ? output[j].padStart(maxLine[j - i] - sep) : output[j];
        tmp.push(str);
      }
      if (output.length > outLen) tmp.push(output[outLen]);
      return tmp;
    }
    return output;
  }
  function reduce(ctx, output, base, braces, extras, depth, v) {
    const entries = output.length;
    if (extras === 'array' && entries > 6) output = group(ctx, output, v);
    if (ctx.currentDepth - depth < ctx.compact && entries === output.length) {
      const start = output.length + ctx.indentationLvl + braces[0].length + base.length + 10;
      let total = output.length + start, fits = total + output.length <= ctx.breakLength;
      for (let i = 0; fits && i < output.length; i++) { total += output[i].length; if (total > ctx.breakLength) fits = false; }
      if (fits && (base === '' || !base.includes('\n'))) {
        const joined = output.join(', ');
        if (!joined.includes('\n')) return `${base ? `${base} ` : ''}${braces[0]} ${joined} ${braces[1]}`;
      }
    }
    const ind = `\n${' '.repeat(ctx.indentationLvl)}`;
    return `${base ? `${base} ` : ''}${braces[0]}${ind}  ${output.join(`,${ind}  `)}${ind}${braces[1]}`;
  }
  const inspect = v => value({ seen: [], indentationLvl: 0, currentDepth: 0, depth: 2, breakLength: 80, compact: 3 }, v, 0);
  // console.log(a, b, ...) as Node joins it: strings as they are, other values inspected, %-patterns when the first argument has them.
  const show = x => typeof x === 'string' ? x : inspect(x);
  function formatArgs(args) {
    const f = args[0];
    if (typeof f !== 'string' || args.length < 2 || !f.includes('%')) return args.map(show).join(' ');
    let a = 1, out = '', last = 0;
    for (let i = 0; i < f.length - 1; i++) {
      if (f[i] !== '%') continue;
      const c = f[i + 1];
      if (c === '%') { out += f.slice(last, i) + '%'; last = i + 2; i++; continue; }
      if (a >= args.length || !'sdifjoOc'.includes(c)) continue;
      const x = args[a++], obj = typeof x === 'object' && x !== null;
      const s = c === 's' ? (typeof x === 'bigint' ? `${x}n` : obj ? value({ seen: [], indentationLvl: 0, currentDepth: 0, depth: 0, breakLength: 80, compact: 3 }, x, 0) : typeof x === 'string' ? x : typeof x === 'number' ? primitive({}, x) : String(x))
        : c === 'd' ? (typeof x === 'bigint' ? `${x}n` : obj ? 'NaN' : primitive({}, Number(x)))
        : c === 'i' ? (typeof x === 'bigint' ? `${x}n` : obj ? 'NaN' : String(parseInt(x)))
        : c === 'f' ? (typeof x === 'symbol' ? 'NaN' : String(parseFloat(x)))
        : c === 'j' ? (() => { try { return JSON.stringify(x); } catch (e) { return '[Circular]'; } })()
        : c === 'c' ? '' : c === 'o' && Array.isArray(x) ? inspect(x).replace(/ ?\]$/, `${x.length ? ', ' : ' '}[length]: ${x.length} ]`) : inspect(x);
      out += f.slice(last, i) + s; last = i + 2; i++;
    }
    out += f.slice(last);
    for (; a < args.length; a++) out += ' ' + show(args[a]);
    return out;
  }
  function print(...args) {
    if (capped) return;
    const text = formatArgs(args);
    for (const line of text.split('\n')) {
      if (lines >= 1000) { capped = true; post({ type: 'cap' }); return; }
      lines++; post({ type: 'line', text: line });
    }
  }
  const userConsole = { log: print, info: print, debug: print, warn: print, error: print, trace: print, dir: x => print(x) };
  self.console = Object.assign(Object.create(null), userConsole);

  // --- line numbers: the code runs as user.ts, wrapped in one header line ---
  const lineOf = e => {
    const m = e && typeof e.stack === 'string' && e.stack.match(/user\.ts:(\d+)(?::\d+)?/);
    const n = m ? +m[1] : e && typeof e.lineNumber === 'number' && /user\.ts/.test(e.fileName || '') ? e.lineNumber : 0;
    return n > 1 ? n - 1 : 0;
  };
  const describe = e => {
    if (e === null || typeof e !== 'object') return `Uncaught ${inspect(e)}`;
    const line = lineOf(e);
    return `${errText(e)}${line ? ` (line ${line})` : ''}`;
  };
  const fail = e => post({ type: 'error', text: describe(e) });

  // --- timers: real ones, counted, so the run ends only when none is left ---
  const live = new Set();
  const guard = fn => (...a) => { try { const r = fn(...a); if (r && typeof r.then === 'function') r.then(undefined, fail); } catch (e) { fail(e); } };
  const realTimers = {
    setTimeout(fn, ms, ...a) { const id = realSet(() => { live.delete(id); if (typeof fn === 'function') guard(fn)(...a); }, ms); live.add(id); return id; },
    clearTimeout(id) { live.delete(id); realClear(id); },
    setInterval(fn, ms, ...a) { const id = realSetI(() => { if (typeof fn === 'function') guard(fn)(...a); }, ms); live.add(id); return id; },
    clearInterval(id) { live.delete(id); realClearI(id); },
  };
  Object.assign(self, realTimers);

  // --- node:test mock.timers (setTimeout and clearTimeout), node:test mock.fn ---
  const fake = { on: false, now: 0, seq: 0, queue: [] };
  const fakeTimers = {
    setTimeout(fn, ms = 0, ...a) { const id = { id: ++fake.seq }; fake.queue.push({ id, at: fake.now + Math.max(1, +ms || 0), fn, a, seq: fake.seq }); return id; },
    clearTimeout(id) { fake.queue = fake.queue.filter(t => t.id !== id); },
  };
  const mock = {
    timers: {
      enable(opts = {}) {
        const apis = opts.apis || ['setTimeout', 'setInterval', 'setImmediate', 'Date'];
        fake.on = true; fake.now = 0; fake.queue = [];
        if (apis.includes('setTimeout')) { self.setTimeout = fakeTimers.setTimeout; self.clearTimeout = fakeTimers.clearTimeout; }
      },
      tick(ms = 1) {
        const end = fake.now + ms;
        for (;;) {
          fake.queue.sort((x, y) => x.at - y.at || x.seq - y.seq);
          const t = fake.queue[0];
          if (!t || t.at > end) break;
          fake.queue.shift(); fake.now = t.at; t.fn(...t.a);
        }
        fake.now = end;
      },
      runAll() { this.tick(Math.max(0, ...fake.queue.map(t => t.at - fake.now))); },
      reset() { fake.on = false; fake.queue = []; self.setTimeout = realTimers.setTimeout; self.clearTimeout = realTimers.clearTimeout; },
    },
    fn(impl = () => undefined) {
      const calls = [];
      const f = function (...args) { const result = impl.apply(this, args); calls.push({ arguments: args, result, this: this }); return result; };
      f.mock = { calls, callCount: () => calls.length, resetCalls: () => { calls.length = 0; } };
      return f;
    },
  };

  // --- node:assert/strict ---
  class AssertionError extends Error {
    constructor(message, extra) { super(message); this.name = 'AssertionError'; this.code = 'ERR_ASSERTION'; Object.assign(this, extra); }
  }
  const isObj = x => x !== null && typeof x === 'object';
  function deep(a, b, seen = new Map()) {
    if (Object.is(a, b)) return true;
    if (!isObj(a) || !isObj(b)) return false;
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
    if (seen.get(a) === b) return true;
    seen.set(a, b);
    const tagA = Object.prototype.toString.call(a);
    if (tagA !== Object.prototype.toString.call(b)) return false;
    if (a instanceof Date) return Object.is(a.getTime(), b.getTime());
    if (a instanceof RegExp) return String(a) === String(b) && a.lastIndex === b.lastIndex;
    if (a instanceof Error && (a.message !== b.message || a.name !== b.name)) return false;
    if (['[object Number]', '[object String]', '[object Boolean]'].includes(tagA) && !Object.is(a.valueOf(), b.valueOf())) return false;
    if (Array.isArray(a) && a.length !== b.length) return false;
    if (ArrayBuffer.isView(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false; }
    if (a instanceof Set) {
      if (a.size !== b.size) return false;
      outer: for (const x of a) { if (b.has(x)) continue; if (isObj(x)) { for (const y of b) if (isObj(y) && deep(x, y, seen)) continue outer; } return false; }
    }
    if (a instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [k, x] of a) { if (!b.has(k) || !deep(x, b.get(k), seen)) return false; }
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !deep(a[k], b[k], seen)) return false;
    const sa = Object.getOwnPropertySymbols(a).filter(s => Object.prototype.propertyIsEnumerable.call(a, s));
    const sb = Object.getOwnPropertySymbols(b).filter(s => Object.prototype.propertyIsEnumerable.call(b, s));
    if (sa.length !== sb.length) return false;
    for (const s of sa) if (!deep(a[s], b[s], seen)) return false;
    return true;
  }
  const raise = (message, fallback, extra) => {
    if (message instanceof Error) throw message;
    throw new AssertionError(message !== undefined ? message : fallback, extra);
  };
  const ok = (v, message) => { if (!v) raise(message, `The expression evaluated to a falsy value:\n\n  assert.ok(${inspect(v)})\n`, { actual: v, expected: true, operator: '==' }); };
  function matches(err, check, message) {
    if (check === undefined) return;
    if (check instanceof RegExp) { if (!check.test(String(err))) raise(message, `The input did not match the regular expression ${String(check)}. Input:\n\n${inspect(String(err))}\n`); return; }
    if (typeof check === 'function') {
      if (check.prototype !== undefined && err instanceof check) return;
      if (Error.isPrototypeOf(check) || check === Error) raise(message, `The error is expected to be an instance of "${check.name}". Received "${err && err.constructor && err.constructor.name}"`);
      if (check.call({}, err) !== true) raise(message, `The validation function is expected to return "true". Received ${inspect(check.call({}, err))}`);
      return;
    }
    if (isObj(check)) {
      for (const k of Object.keys(check)) {
        const want = check[k], got = err == null ? undefined : err[k];
        if (want instanceof RegExp && typeof got === 'string' ? !want.test(got) : !deep(got, want)) raise(message, `Expected values to be strictly deep-equal:\n+ actual - expected\n\n  Comparison {\n+   ${k}: ${inspect(got)}\n-   ${k}: ${inspect(want)}\n  }\n`);
      }
    }
  }
  const assert = (v, message) => ok(v, message);
  Object.assign(assert, {
    AssertionError, ok,
    equal: (a, b, m) => { if (!Object.is(a, b)) raise(m, `Expected values to be strictly equal:\n\n${inspect(a)} !== ${inspect(b)}\n`, { actual: a, expected: b, operator: 'strictEqual' }); },
    notEqual: (a, b, m) => { if (Object.is(a, b)) raise(m, `Expected "actual" to be strictly unequal to: ${inspect(b)}`, { actual: a, expected: b, operator: 'notStrictEqual' }); },
    deepEqual: (a, b, m) => { if (!deep(a, b)) raise(m, `Expected values to be strictly deep-equal:\n+ actual - expected\n\n+ ${inspect(a)}\n- ${inspect(b)}\n`, { actual: a, expected: b, operator: 'deepStrictEqual' }); },
    notDeepEqual: (a, b, m) => { if (deep(a, b)) raise(m, `Expected "actual" not to be strictly deep-equal to: ${inspect(b)}`, { actual: a, expected: b, operator: 'notDeepStrictEqual' }); },
    fail: m => raise(m, 'Failed'),
    match: (s, re, m) => { if (!re.test(s)) raise(m, `The input did not match the regular expression ${String(re)}. Input:\n\n${inspect(s)}\n`); },
    doesNotMatch: (s, re, m) => { if (re.test(s)) raise(m, `The input was expected to not match the regular expression ${String(re)}. Input:\n\n${inspect(s)}\n`); },
    throws(fn, check, message) {
      if (typeof check === 'string') { message = check; check = undefined; }
      try { fn(); } catch (e) { matches(e, check, message); return; }
      raise(message, 'Missing expected exception.');
    },
    doesNotThrow(fn, message) { try { fn(); } catch (e) { raise(typeof message === 'string' ? message : undefined, `Got unwanted exception.\nActual message: "${e && e.message}"`); } },
    async rejects(p, check, message) {
      if (typeof check === 'string') { message = check; check = undefined; }
      try { await (typeof p === 'function' ? p() : p); } catch (e) { matches(e, check, message); return; }
      raise(message, 'Missing expected rejection.');
    },
    async doesNotReject(p, message) { try { await (typeof p === 'function' ? p() : p); } catch (e) { raise(typeof message === 'string' ? message : undefined, `Got unwanted rejection.\nActual message: "${e && e.message}"`); } },
  });
  assert.strictEqual = assert.equal; assert.notStrictEqual = assert.notEqual;
  assert.deepStrictEqual = assert.deepEqual; assert.notDeepStrictEqual = assert.notDeepEqual;
  assert.strict = assert;

  const modules = { 'node:assert': assert, 'node:assert/strict': assert, assert, 'assert/strict': assert, 'node:test': { mock }, 'test': { mock } };
  const require = name => {
    if (Object.prototype.hasOwnProperty.call(modules, name)) return modules[name];
    throw new Error(`Cannot use '${name}' here. The page provides node:assert, node:assert/strict and node:test (mock.timers).`);
  };

  self.addEventListener('unhandledrejection', e => { e.preventDefault(); fail(e.reason); });
  self.addEventListener('error', e => { e.preventDefault(); fail(e.error || { name: 'Error', message: e.message }); });
  const tick = () => new Promise(r => realSet(r, 0));
  self.onmessage = async e => {
    let js;
    try { js = SUCRASE.transform(e.data.code, { transforms: ['typescript', 'imports'], filePath: 'user.ts' }).code; }
    catch (err) {
      const m = String(err.message).replace(/^Error transforming \S+: /, '').match(/^(.*?)\s*\((\d+):\d+\)$/);
      post({ type: 'error', text: m ? `SyntaxError: ${m[1]} (line ${m[2]})` : `SyntaxError: ${err.message}` });
      post({ type: 'done' }); return;
    }
    let fn;
    try { fn = (0, eval)(`(async function (require, exports, module, console) { "use strict";\n${js}\n})\n//# sourceURL=user.ts`); }
    catch (err) { fail(err); post({ type: 'done' }); return; }
    const module = { exports: {} };
    try { await fn(require, module.exports, module, userConsole); } catch (err) { fail(err); }
    // Finished when no timer is left; a few extra turns let rejection events fire.
    for (let quiet = 0; quiet < 3; quiet = live.size ? 0 : quiet + 1) await tick();
    post({ type: 'done' });
  };
  post({ type: 'ready' });
}

// ---------- the page side ----------
const runs = new Set();
const editors = new Map();  // .editor element -> CodeMirror view
function stopRuns() { for (const r of [...runs]) r.stop(); }
let tsWorkerUrl = null;
async function tsWorker() {
  if (!tsWorkerUrl) {
    const sucrase = await unpackText('sucrase');
    tsWorkerUrl = URL.createObjectURL(new Blob([sucrase, `\n;(${tsWorkerMain})();\n`], { type: 'text/javascript' }));
  }
  return tsWorkerUrl;
}

// One run in a new worker. `on` gets line(text), error(text), result(data); returns { stop, done } where done gives the status.
function startWorker(url, message, transfer, on) {
  let w, timer, ready = false, finished = false, resolve;
  const h = { done: new Promise(r => { resolve = r; }), t0: performance.now() };
  const finish = status => {
    if (finished) return; finished = true;
    clearTimeout(timer); if (w) w.terminate(); runs.delete(h);
    resolve({ status, ms: Math.round(performance.now() - h.t0) });
  };
  h.stop = () => finish('stopped');
  try { w = new Worker(url); } catch (e) { finish('blocked'); return h; }
  runs.add(h);
  w.onerror = e => {
    e.preventDefault();
    if (!ready) { finish('blocked'); return; }
    on.error(e.message ? e.message.replace(/^Uncaught /, '') : 'Error: the code stopped the runner'); finish('done');
  };
  w.onmessage = ({ data: m }) => {
    if (finished) return;
    if (m.type === 'ready') { ready = true; w.postMessage(message, transfer); timer = setTimeout(() => finish('timeout'), RUN_LIMIT_MS); }
    else if (m.type === 'line') on.line(m.text);
    else if (m.type === 'error') on.error(m.text);
    else if (m.type === 'result') on.result(m);
    else if (m.type === 'cap') finish('capped');
    else if (m.type === 'done') finish('done');
  };
  return h;
}

// Output panel: printed lines, errors, then a status line.
function outPanel(out) {
  out.innerHTML = '<div class="out-status">Running…</div>';
  const status = out.lastChild;
  const add = (cls, text) => { const el = document.createElement('div'); el.className = cls; el.textContent = text; out.insertBefore(el, status); return el; };
  return {
    line: text => add('out-line', text),
    error: text => add('out-error', text),
    node: el => out.insertBefore(el, status),
    end: ({ status: s, ms }) => { status.textContent = s === 'done' ? `Finished in ${ms} ms.` : MSG[s]; status.dataset.status = s; },
  };
}

// Runs TS/JS code, printing into `out`. Resolves with the status and the printed lines.
async function runTS(code, out, ctl = {}) {
  const panel = outPanel(out), lines = [];
  let url;
  try { url = await tsWorker(); } catch (e) { panel.error(MSG.unpack); panel.end({ status: 'done', ms: 0 }); return { status: 'unpack', lines }; }
  if (ctl.stopped || !out.isConnected) { panel.end({ status: 'stopped' }); return { status: 'stopped', lines }; }
  const h = startWorker(url, { code }, [], { line: t => { lines.push(t); panel.line(t); }, error: t => panel.error(t), result() {} });
  h.out = out; ctl.h = h;
  const r = await h.done;
  if (r.status === 'blocked') { out.innerHTML = ''; const p = document.createElement('div'); p.className = 'out-error'; p.textContent = MSG.blocked; out.append(p); return { status: 'blocked', lines }; }
  if (out.isConnected) panel.end(r);
  return { ...r, lines };
}

// Run and Stop on one button: while `start(ctl)` runs, the button reads Stop and stops it.
async function runButton(btn, start) {
  if (btn._ctl) { btn._ctl.stop(); return; }
  const idle = btn.textContent, ctl = btn._ctl = { stopped: false, h: null, stop() { this.stopped = true; if (this.h) this.h.stop(); } };
  btn.textContent = 'Stop';
  try { return await start(ctl); } finally { btn._ctl = null; btn.textContent = idle; }
}

// A run whose output left the page (the question was redrawn or left) is stopped; editors left behind are freed.
new MutationObserver(() => {
  for (const r of [...runs]) if (r.out && !r.out.isConnected) r.stop();
  for (const [el, view] of editors) if (!el.isConnected) { view.destroy(); editors.delete(el); }
  upgradeEditors();
}).observe(document.body, { childList: true, subtree: true });

// ---------- editor (idea 34): textarea first, CodeMirror once unpacked ----------
function editorCode(box) { const v = editors.get(box); return v ? v.state.doc.toString() : box.querySelector('textarea.ed').value; }
function setEditorCode(box, text) {
  const v = editors.get(box);
  if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } });
  else box.querySelector('textarea.ed').value = text;
}
let editorFailed = false;
function upgradeEditors() {
  const boxes = [...document.querySelectorAll('.editor')].filter(b => !editors.has(b) && !b.dataset.upgrading && b.querySelector('textarea.ed'));
  if (!boxes.length || editorFailed) return;
  boxes.forEach(b => { b.dataset.upgrading = '1'; });
  loadScript('codemirror').then(() => boxes.forEach(mountEditor), () => { editorFailed = true; boxes.forEach(b => delete b.dataset.upgrading); });
}
function mountEditor(box) {
  const ta = box.querySelector('textarea.ed');
  delete box.dataset.upgrading;
  if (!box.isConnected || !ta || editors.has(box)) return;
  const i = +box.dataset.i, lang = box.dataset.lang;
  const runKey = () => { const b = box.querySelector('.run-btn'); if (b) b.click(); return true; };
  const view = new CM.EditorView({
    doc: ta.value,
    extensions: [
      CM.keymap.of([{ key: 'Mod-Enter', run: runKey }, { key: 'Tab', run: v => { v.dispatch(v.state.replaceSelection('  '), { scrollIntoView: true, userEvent: 'input' }); return true; }, shift: CM.indentLess }]),
      CM.basicSetup,
      lang === 'sql' ? CM.sql({ dialect: CM.SQLite }) : CM.javascript({ typescript: true }),
      CM.syntaxHighlighting(CM.classHighlighter),
      CM.EditorView.contentAttributes.of({ 'aria-label': 'Code editor' }),
      CM.EditorView.updateListener.of(u => { if (u.docChanged) edSave(i, u.state.doc.toString()); }),
    ],
  });
  ta.replaceWith(view.dom);
  editors.set(box, view);
}
