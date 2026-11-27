// ---------- packed parts ----------
// The build stores the questions and the third-party parts gzip-compressed and base64-encoded in
// <script type="application/x-gzip-base64" id="pack-NAME"> tags. unpack(name) gives the bytes, once per page load (docs/phase3-spec.md).
const unpacked = {};
function fromBase64(text) {
  if (Uint8Array.fromBase64) return Uint8Array.fromBase64(text);
  const s = atob(text), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function unpack(name) {
  return unpacked[name] ??= (async () => {
    const el = document.getElementById('pack-' + name);
    if (!el) throw new Error('part ' + name + ' is missing');
    const stream = new Blob([fromBase64(el.textContent)]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  })();
}
const unpackText = async name => new TextDecoder().decode(await unpack(name));
// Runs an unpacked script part (it sets a global such as CM) once, as a classic script.
const loaded = {};
function loadScript(name) {
  return loaded[name] ??= unpackText(name).then(code => { const s = document.createElement('script'); s.textContent = code; document.head.appendChild(s); });
}
