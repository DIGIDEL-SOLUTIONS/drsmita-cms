// Dual-layer CMS build: applies content/site.json onto the extracted Framer site.
// Patches BOTH the SSR HTML (first paint + SEO) and the runtime page chunks
// (what React re-renders from after hydration) — verified both layers required.
// Usage: node build.mjs   → writes patched site into dist/
import fs from 'fs';
import path from 'path';

const ROOT = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname)).replace(/^\/([A-Za-z]:)/, '$1');
const SRC = path.join(ROOT, 'site');
const DIST = path.join(ROOT, 'dist');
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'site.json'), 'utf8'));
const H = content.home;
const S = content.site;

try {
  fs.rmSync(DIST, { recursive: true, force: true });
} catch {}
fs.cpSync(SRC, DIST, { recursive: true, force: true });

const report = [];
function apply(file, ops) {
  const fp = path.join(DIST, file);
  let c = fs.readFileSync(fp, 'utf8');
  for (const op of ops) {
    const before = c;
    if (op.find instanceof RegExp) {
      c = c.replace(op.find, op.replace);
    } else if (op.nth !== undefined) {
      // replace the nth (0-based) occurrence
      let idx = -1;
      for (let k = 0; k <= op.nth; k++) {
        idx = c.indexOf(op.find, idx + 1);
        if (idx < 0) break;
      }
      if (idx >= 0) c = c.slice(0, idx) + op.replace + c.slice(idx + op.find.length);
    } else if (op.all) {
      c = c.split(op.find).join(op.replace);
    } else {
      c = c.replace(op.find, op.replace);
    }
    const changed = c !== before;
    const noop = !changed;
    report.push({ file: file.slice(0, 44), name: op.name, ok: changed || noop, noop });
  }
  fs.writeFileSync(fp, c);
}

// ---------- helpers ----------
const GOLD = '--token-587d8d25-5f92-4c72-a034-bbc3b07c59df, rgb(251, 192, 45)';
const ORANGE = '--token-d586707e-9ac9-472a-9144-e2bee1b4bc85, rgb(254, 127, 45)';

// HTML: <span style="--framer-text-color:var(TOKEN)" class="framer-text">WORD</span>
const htmlAccent = (token, word) => `<span style="--framer-text-color:var(${token})" class="framer-text">${word}</span>`;
// chunk: c(`span`,{style:{"--framer-text-color":`var(TOKEN)`},children:`WORD`})
const chunkAccent = (token, word) => `c(\`span\`,{style:{\"--framer-text-color\":\`var(${token})\`},children:\`${word}\`})`;

function chunkPatchByAnchor(anchor, find, replace, windowSize = 4000) {
  return { anchor, find, replace, windowSize };
}

// ---------- 1. HOME: index.html (SSR layer) ----------
apply('index.html', [
  {
    name: 'badge kicker (10M+ Meals Distributed)',
    find: `>${htmlAccent(ORANGE, '10M+')} Meals Distributed<`,
    replace: `>${htmlAccent(ORANGE, H.hero.badgeKicker)} ${H.hero.badgeLine}<`,
  },
  { name: 'badge sub', find: '>Trusted charity organization<', replace: `>${H.hero.badgeSub}<` },
  {
    name: 'hero h1 (accent span)',
    find: `Making ${htmlAccent(GOLD, 'every')} life count`,
    replace: `${H.hero.titlePre}${htmlAccent(GOLD, H.hero.titleAccent)}${H.hero.titlePost}`,
  },
  {
    name: 'hero subtitle',
    find: 'We are dedicated to improving lives through education, healthcare, food assistance, and emergency relief.',
    replace: H.hero.subtitle,
  },
  { name: 'hero button', find: 'Support Our Cause', replace: H.hero.button, nth: 0 },
  { name: 'counter label', find: 'Total Donations Raised', replace: H.hero.counterLabel, all: true },
  {
    name: 'about h2 (accent span)',
    find: `Making ${htmlAccent(ORANGE, 'kindness')} create lasting change`,
    replace: H.about.heading,
  },
  {
    name: 'about sub',
    find: 'Our organization has partnered with generous donors, volunteers, and local communities.',
    replace: H.about.sub,
  },
  { name: 'causes h2 (accent span, 1st)', find: `Support ${htmlAccent(ORANGE, 'meaningful')} emergency relief causes`, replace: H.causes.heading, nth: 0 },
  { name: 'impact h2 (accent span, remaining)', find: `Support ${htmlAccent(ORANGE, 'meaningful')} emergency relief causes`, replace: H.impact.heading, nth: 0 },
  {
    name: 'testimonial h2 (accent span)',
    find: /Real stories from happy donors <span[^>]*>worldwide<\/span>/,
    replace: H.testimonials.heading,
  },
  { name: 'faq sub', find: 'Find answers to common questions about donations, volunteering, fundraising.', replace: H.faq.sub },
  {
    name: 'blog h2 (accent span, escaped &amp;)',
    find: /Latest news &amp; <span[^>]*>inspiring<\/span> charity stories/,
    replace: H.blog.heading.replaceAll('&', '&amp;'),
  },
  {
    name: 'donation heading (accent span)',
    find: /Your generosity helps provide food, clean water, <span[^>]*>[^<]*<\/span>/,
    replace: H.donation.heading,
  },
  { name: 'donation sub', find: 'Providing nutritious meals to families individuals.', replace: H.donation.sub },
  { name: 'volunteer sub', find: 'Join our dedicated team of volunteers and use your time, skills, and compassion to make.', replace: H.volunteer.sub },
  {
    name: 'volunteer heading (accent span)',
    find: /Be the <span[^>]*>change<\/span> your community needs/,
    replace: H.volunteer.heading,
  },
  { name: 'footer email', find: 'hello@charido.org', replace: S.email, all: true },
  { name: 'footer address', find: '245 Hope Street, New York, NY 10001, USA', replace: S.location, all: true },
  { name: 'footer brand', find: 'Charido', replace: S.name, all: true },
  { name: 'page title', find: /<title>[^<]*<\/title>/, replace: `<title>${S.title}</title>` },
]);

// ---------- 2. HOME: runtime chunk (hydration layer) ----------
const HOME_CHUNK = 'assets/sites/3LQS4CGS56cvolV6sVy6bE/5F3AGoiSROBCn8eQJ_kPSMizDaCyNkfDr9X3BI-HEVg.C0DNhNKv.mjs';
const C = '`';

// chunk ops on plain text nodes
const chunkOps = [
  { name: 'c badge sub', find: `children:${C}Trusted charity organization${C}`, replace: `children:${C}${H.hero.badgeSub}${C}` },
  {
    name: 'c badge kicker (accent segment)',
    find: /children:\[c\(`span`,\{style:\{"--framer-text-color":`var\(--token-d586707e[^`]+`\},children:`10M\+`\}\),` Meals Distributed`\]/g,
    replace: `children:[c(\`span\`,{style:{"--framer-text-color":\`var(--token-d586707e-9ac9-472a-9144-e2bee1b4bc85, rgb(254, 127, 45))\`},children:\`${H.hero.badgeKicker}\`}),\` ${H.hero.badgeLine}\`]`,
  },
  {
    name: 'c about sub',
    find: 'Our organization has partnered with generous donors, volunteers, and local communities.',
    replace: H.about.sub,
  },
  { name: 'c hero button', find: 'aO5KKRyox:`Support Our Cause`', replace: `aO5KKRyox:\`${H.hero.button}\``, all: true },
  {
    name: 'c hero h1 (accent segment)',
    find: `children:[${C}Making ${C},${chunkAccent(GOLD, 'every')},${C} life count${C}]`,
    replace: `children:[${C}${H.hero.titlePre}${C},${chunkAccent(GOLD, H.hero.titleAccent)},${C}${H.hero.titlePost}${C}]`,
  },
  {
    name: 'c hero subtitle',
    find: `We are dedicated to improving lives through education, healthcare, food assistance, and emergency relief.`,
    replace: H.hero.subtitle,
  },
  { name: 'c counter label', find: `Total Donations Raised`, replace: H.hero.counterLabel, all: true },
  { name: 'c about h2', find: `children:[${C}Making ${C},${chunkAccent(ORANGE, 'kindness')},${C} create lasting change${C}]`, replace: `children:[${C}${H.about.heading}${C}]` },
  {
    name: 'c causes h2 #1',
    find: `children:[${C}Support ${C},${chunkAccent(ORANGE, 'meaningful')},${C} emergency relief causes${C}]`,
    replace: `children:[${C}${H.causes.heading}${C}]`,
    nth: 0,
  },
  {
    name: 'c impact h2 #2',
    find: `children:[${C}Support ${C},${chunkAccent(ORANGE, 'meaningful')},${C} emergency relief causes${C}]`,
    replace: `children:[${C}${H.impact.heading}${C}]`,
    nth: 0,
  },
  {
    name: 'c testimonials h2 (accent)',
    find: /children:\[`Real stories from happy donors `,c\(`span`,\{style:\{"--framer-text-color":`var\([^`]+\)`\},children:`worldwide`\}\),` `\]/,
    replace: `children:[\`${H.testimonials.heading}\`]`,
  },
  { name: 'c faq h2', find: `children:${C}Frequently asked questions${C}`, replace: `children:${C}${H.faq.heading}${C}` },
  {
    name: 'c blog h2 (accent)',
    find: /children:\[`Latest news & `,c\(`span`,\{style:\{"--framer-text-color":`var\([^`]+\)`\},children:`inspiring`\}\),` charity stories`\]/,
    replace: `children:[\`${H.blog.heading}\`]`,
  },
  {
    name: 'c donation heading (accent)',
    find: /children:\[`Your generosity helps provide food, clean water, `,c\(`span`,\{[^}]+\},children:`[^`]+`\}\),` [^`]+`\]/,
    replace: `children:[\`${H.donation.heading}\`]`,
  },
  { name: 'c donation sub', find: `Providing nutritious meals to families individuals.`, replace: H.donation.sub },
  { name: 'c volunteer sub', find: `Join our dedicated team of volunteers and use your time, skills, and compassion to make.`, replace: H.volunteer.sub },
  {
    name: 'c volunteer heading (accent)',
    find: /children:\[`Be the `,c\(`span`,\{style:\{"--framer-text-color":`var\([^`]+\)`\},children:`change`\}\),` your community needs`\]/,
    replace: `children:[\`${H.volunteer.heading}\`]`,
  },
  { name: 'c impact feature title', find: `Global reach`, replace: H.impact.featureTitle, all: true },
  { name: 'c impact feature sub', find: `Passionate professionals dedicated.`, replace: H.impact.featureSub, all: true },
  { name: 'c impact counter2 label', find: `Community projects`, replace: H.impact.counter2Label, all: true },
  { name: 'c impact counter2 sub', find: `Successful initiatives delivered across.`, replace: H.impact.counter2Sub, all: true },
  { name: 'c impact counter1 label', find: `Donations Collected`, replace: H.impact.counterLabel, all: true },
];

// FAQ defaults (component default props in the chunk)
H.faq.items.forEach((item, i) => {
  chunkOps.push({ name: `c faq q${i + 1}`, find: `\`How are my donations used?\`_\`Is my donation secure?\`_\`Can I make a monthly donation?\`_\`Can I volunteer without previous experience?\`_\`Will I receive updates about my donation?\`_\`How can my organization partner with you?\``.split('_')[i], replace: "`" + item.q + "`" });
});

let homeChunkOps = chunkOps.map(op => ({ ...op, all: op.all || false }));

// apply plain chunk ops
apply(HOME_CHUNK, homeChunkOps);

// CTA component chunk (shared across pages)
{
  const fp = path.join(DIST, 'assets/sites/3LQS4CGS56cvolV6sVy6bE/dcgTNtDUb.ZeFXZRWx.mjs');
  if (fs.existsSync(fp)) {
    apply('assets/sites/3LQS4CGS56cvolV6sVy6bE/dcgTNtDUb.ZeFXZRWx.mjs', [
      {
        name: 'cta heading (accent)',
        find: /children:\[`Every donation `,o\(l\.span,\{style:\{"--framer-text-color":`var\([^`]+\)`\},children:`creates`\}\),` lasting change `\]/,
        replace: `children:[\`${H.cta.heading}\`]`,
      },
      { name: 'cta button', find: 'Supports Us', replace: H.cta.button },
    ]);
  }
}

// nodeId-anchored ops (props on instances in the chunk)
{
  const fp = path.join(DIST, HOME_CHUNK);
  let c = fs.readFileSync(fp, 'utf8');
  const anchorPatch = (nodeId, find, replace) => {
    const anchor = `nodeId:${C}${nodeId}${C}`;
    const i = c.indexOf(anchor);
    if (i < 0) { report.push({ file: 'home chunk', name: 'anchor ' + nodeId, ok: false }); return; }
    const win = c.slice(i, i + 4000);
    if (!win.includes(find)) { report.push({ file: 'home chunk', name: 'anchorfind ' + nodeId, ok: false }); return; }
    c = c.slice(0, i) + win.replace(find, replace) + c.slice(i + 4000);
    report.push({ file: 'home chunk', name: 'anchor ' + nodeId, ok: true });
  };
  // hero counter
  anchorPatch('WP4qBhJWz', `targetNumber:${C}44,000${C}`, `targetNumber:${C}${H.hero.counterNumber}${C}`);
  // impact counter
  anchorPatch('DCYUxvbxh', `targetNumber:${C}44,000${C}`, `targetNumber:${C}${H.impact.counter}${C}`);
  // stats
  anchorPatch('s0Rx2yN5x', `NvpYTjuS_:${C}25${C}`, `NvpYTjuS_:${C}${H.about.stat1.value}${C}`);
  anchorPatch('s0Rx2yN5x', `a4lvuPCRE:${C}Lives Impacted${C}`, `a4lvuPCRE:${C}${H.about.stat1.label}${C}`);
  anchorPatch('P628ssw_z', `NvpYTjuS_:${C}500${C}`, `NvpYTjuS_:${C}${H.about.stat2.value}${C}`);
  anchorPatch('P628ssw_z', `a4lvuPCRE:${C}Active volunteers${C}`, `a4lvuPCRE:${C}${H.about.stat2.label}${C}`);
  fs.writeFileSync(fp, c);
}

// ---------- 3b. CMS schema chunk: rename enum chip labels (fixes "Helth" typo) ----------
{
  const fp = 'assets/sites/3LQS4CGS56cvolV6sVy6bE/fL0pF_sbM.Bi1HnHUX.mjs';
  apply(fp, [
    { name: 'cms enum labels', find: 'optionTitles:[`Food`,`Helth`,`Education`]', replace: 'optionTitles:[`Gaushala`,`Care`,`Child Care`]' },
  ]);
}

// ---------- 3c. rewrite runtime asset URLs in chunks (logo, images, fonts) ----------
// The extractor rewrote URLs in the HTML, but chunks embed absolute
// framerusercontent.com URLs — React re-renders images straight from the CDN.
// Convert each URL to the extractor's local naming (base__query.ext).
{
  const urlToLocal = (raw) => {
    const decoded = raw.replaceAll('&amp;', '&');
    const u = new URL(decoded);
    const ext = path.extname(u.pathname);
    const base = u.pathname.slice(0, u.pathname.length - ext.length);
    const q = u.search ? '__' + u.search.slice(1).replaceAll('&', '_').replaceAll('=', '-') : '';
    return '/assets' + base + q + ext;
  };
  let rewritten = 0;
  (function walkMjs(dir) {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isDirectory()) { walkMjs(fp); continue; }
      if (!f.endsWith('.mjs')) continue;
      let c = fs.readFileSync(fp, 'utf8');
      const before = c;
      const urls = c.match(/https:\/\/framerusercontent\.com\/[^"'`\\\s)>]+/g) || [];
      const seen = new Set();
      for (const raw of urls) {
        if (seen.has(raw)) continue;
        seen.add(raw);
        try { c = c.split(raw).join(urlToLocal(raw)); } catch {}
      }
      const gs = c.match(/https:\/\/fonts\.gstatic\.com\/[^"'`\\\s)>]+/g) || [];
      const gseen = new Set();
      for (const raw of gs) {
        if (gseen.has(raw)) continue;
        gseen.add(raw);
        try { c = c.split(raw).join(urlToLocal(raw)); } catch {}
      }
      if (c !== before) { fs.writeFileSync(fp, c); rewritten += seen.size + gs.length; }
    }
  })(DIST);
  report.push({ file: 'chunks', name: 'runtime asset URL rewrite', ok: true });
}

// ---------- 3d. runtime page title (Framer sets document.title from runtime metadata) ----------
{
  let fixed = 0;
  (function walkMjs(dir) {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isDirectory()) { walkMjs(fp); continue; }
      if (!f.endsWith('.mjs')) continue;
      let c = fs.readFileSync(fp, 'utf8');
      const before = c;
      c = c.split('Charido – Nonprofit & Charity Framer Template').join(S.title);
      c = c.split('Charido - Nonprofit & Charity Framer Template').join(S.title);
      if (c !== before) { fs.writeFileSync(fp, c); fixed++; }
    }
  })(DIST);
  report.push({ file: 'chunks', name: 'runtime page title', ok: true });
}

// ---------- 3e. image swap: overwrite template image files with ours ----------
// content/site.json → "images": { "<framer-image-id>": "<source url>" }
// Every local variant of that image id (base__query.ext) gets replaced with the
// downloaded source — works for both the HTML layer and the runtime chunks.
{
  const images = content.images || {};
  const urlToLocal = (raw) => {
    const decoded = raw.replaceAll('&amp;', '&');
    const u = new URL(decoded);
    const ext = path.extname(u.pathname);
    const base = u.pathname.slice(0, u.pathname.length - ext.length);
    const q = u.search ? '__' + u.search.slice(1).replaceAll('&', '_').replaceAll('=', '-') : '';
    return '/assets' + base + q + ext;
  };
  for (const [id, srcUrl] of Object.entries(images)) {
    try {
      let buf;
      if (srcUrl.startsWith('http')) {
        const res = await fetch(srcUrl);
        if (!res.ok) throw new Error(res.status + ' ' + srcUrl);
        buf = Buffer.from(await res.arrayBuffer());
      } else {
        buf = fs.readFileSync(path.join(ROOT, srcUrl));
      }
      const dir = path.join(DIST, 'assets', 'images');
      let swaps = 0;
      for (const f of fs.readdirSync(dir)) {
        if (f.startsWith(id + '.') || f.startsWith(id + '__')) {
          fs.writeFileSync(path.join(dir, f), buf);
          swaps++;
        }
      }
      // fallback: find runtime URLs referencing this id in chunks and materialize those files
      if (swaps === 0) {
        const runtimeUrls = new Set();
        (function scanMjs(d) {
          for (const f of fs.readdirSync(d)) {
            const fp = path.join(d, f);
            if (fs.statSync(fp).isDirectory()) { scanMjs(fp); continue; }
            if (!f.endsWith('.mjs')) continue;
            const c = fs.readFileSync(fp, 'utf8');
            for (const m of c.matchAll(new RegExp('https://framerusercontent\\.com/images/' + id + '\\\\.[^"\'+`\\\\\\\\\\\\s)>]*', 'g'))) runtimeUrls.add(m[0]);
          }
        })(DIST);
        for (const raw of runtimeUrls) {
          const local = urlToLocal(raw);
          fs.writeFileSync(path.join(DIST, local.replace(/^\//, '')), buf);
          swaps++;
        }
      }
      report.push({ file: 'images', name: `swap ${id.slice(0, 10)}…`, ok: swaps > 0 });
    } catch (e) {
      report.push({ file: 'images', name: `swap ${id.slice(0, 10)}…`, ok: false });
    }
  }
}

// ---------- 3. global strings across all pages (nav/footer shared) ----------
// footer/nav strings ALSO live in the shared runtime chunk (script_main)
{
  const dir = 'assets/sites/3LQS4CGS56cvolV6sVy6bE';
  const fp = path.join(DIST, dir, 'script_main.jJ_cJDMq.mjs');
  if (fs.existsSync(fp)) {
    let c = fs.readFileSync(fp, 'utf8');
    const b = c;
    c = c.split('hello@charido.org').join(S.email);
    c = c.split('245 Hope Street, New York, NY 10001, USA').join(S.location);
    c = c.split('Copyright © 2026 Charido').join(`Copyright © 2026 ${S.name}`);
    c = c.split('We are committed to creating lasting change by supporting education').join('We are committed to creating lasting change by serving humanity — in her memory');
    // brand text nodes + template meta description
    c = c.split('children:`Charido`').join(`children:\`${S.name}\``);
    c = c.split('Charido is a modern Framer template for nonprofits').join('Dr. Smita Sharma Foundation — a nonprofit serving humanity in memory of Dr. Smita Sharma');
    if (c !== b) fs.writeFileSync(fp, c);
    report.push({ file: 'script_main', name: 'footer/nav strings', ok: c !== b });
  }
}
function eachHtml(cb) {
  function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isDirectory()) walk(fp);
      else if (f.endsWith('.html')) cb(fp);
    }
  }
  walk(DIST);
}
eachHtml(fp => {
  let c = fs.readFileSync(fp, 'utf8');
  const before = c;
  c = c.split('hello@charido.org').join(S.email);
  c = c.split('245 Hope Street, New York, NY 10001, USA').join(S.location);
  c = c.split('>Charido<').join(`>${S.name.replace(/ & /g, ' &amp; ')}<`);
  if (c !== before) fs.writeFileSync(fp, c);
});

// ---------- 4. logo swap: overwrite the logo asset with our own SVG ----------
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="166" height="50" viewBox="0 0 166 50"><defs><style>text{font-family:Georgia,'Times New Roman',serif}</style></defs><g transform="translate(4,7)"><path d="M12 33 C6 27 0 22.5 0 15.5 C0 10 4 6.5 8.4 6.5 C10.4 6.5 11.4 7.4 12 8.4 C12.6 7.4 13.6 6.5 15.6 6.5 C20 6.5 24 10 24 15.5 C24 22.5 18 27 12 33 Z" fill="#C96A4A"/><text x="30" y="21" font-size="11.5" font-weight="bold" fill="#2e2e2e">Dr. Smita Sharma</text><text x="30" y="36" font-size="9" fill="#626262">This is humanity, not charity</text></g></svg>`;
{
  const fp = path.join(DIST, 'assets/images/WCZJgSxBvRhpeJ1KeeA7KSacg__width-166_height-50.svg');
  if (fs.existsSync(fp)) fs.writeFileSync(fp, logoSvg);
  report.push({ file: 'logo.svg', name: 'logo swap', ok: fs.existsSync(fp) });
}

// ---------- report ----------
const failed = report.filter(r => !r.ok);
console.log(`patches applied: ${report.length - failed.length}/${report.length}`);
if (failed.length) {
  console.log('FAILED:');
  for (const f of failed) console.log('  ✗', f.file, '·', f.name);
}
// syntax-check every patched .mjs so a broken chunk never ships silently
const { execSync } = await import('node:child_process');
const mjsFiles = [];
(function walkMjs(dir) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) walkMjs(fp);
    else if (f.endsWith('.mjs')) mjsFiles.push(fp);
  }
})(DIST);
let syntaxBad = 0;
for (const fp of mjsFiles) {
  try {
    execSync(`node --check "${fp}"`, { stdio: 'pipe' });
  } catch (e) {
    syntaxBad++;
    console.log('  ⚠ SYNTAX:', path.basename(fp));
  }
}
if (syntaxBad) console.log(`!! ${syntaxBad} chunk(s) have syntax errors — DO NOT SHIP`);
console.log('dist ready:', DIST, syntaxBad ? '(BROKEN)' : '(clean)');
