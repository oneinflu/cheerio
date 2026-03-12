const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const axios = require('axios');
const whatsappClient = require('../src/integrations/meta/whatsappClient');

const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const args = { yes: false, filter: '', limit: null, delayMs: 600, wabaId: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes' || a === '-y') args.yes = true;
    else if (a === '--filter') args.filter = String(argv[++i] || '');
    else if (a === '--limit') args.limit = Number(argv[++i] || 0) || null;
    else if (a === '--delay-ms') args.delayMs = Number(argv[++i] || 0) || args.delayMs;
    else if (a === '--waba') args.wabaId = String(argv[++i] || '');
  }
  return args;
}

async function fetchAllTemplates(wabaId) {
  const first = await whatsappClient.getTemplates(wabaId, 200);
  const all = [];
  const pushPage = (resp) => {
    const page = resp && resp.data ? resp.data : resp;
    if (page && Array.isArray(page.data)) all.push(...page.data);
    return page && page.paging && page.paging.next ? String(page.paging.next) : null;
  };

  let next = pushPage(first);
  while (next) {
    if (!TOKEN) throw new Error('WHATSAPP_TOKEN required for pagination fetch');
    const res = await axios.get(next, { headers: { Authorization: `Bearer ${TOKEN}` } });
    next = pushPage(res.data);
  }

  const seen = new Set();
  return all.filter((t) => {
    const k = `${t.name}:${t.language}:${t.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function run() {
  const args = parseArgs(process.argv);
  const wabaId = args.wabaId || WABA_ID;
  const confirmed = args.yes || String(process.env.CONFIRM_DELETE_ALL_TEMPLATES || '').toLowerCase() === 'true';
  if (!wabaId) throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not configured (or pass --waba)');
  if (!confirmed) {
    console.log('Refusing to delete templates without confirmation.');
    console.log('Run with: CONFIRM_DELETE_ALL_TEMPLATES=true node scripts/delete_all_templates.js');
    console.log('Or: node scripts/delete_all_templates.js --yes');
    process.exitCode = 1;
    return;
  }

  const templates = await fetchAllTemplates(wabaId);
  const selected = templates
    .filter((t) => (args.filter ? String(t.name).includes(args.filter) : true))
    .slice(0, args.limit ? Math.max(0, args.limit) : templates.length);

  console.log('[templates:delete] WABA:', wabaId);
  console.log('[templates:delete] Found:', templates.length);
  console.log('[templates:delete] Selected:', selected.length);

  const results = [];
  for (let i = 0; i < selected.length; i++) {
    const t = selected[i];
    const name = t.name;
    const hsmId = t.id || null;
    const language = t.language || null;
    try {
      console.log(`[templates:delete] (${i + 1}/${selected.length}) Deleting ${name} (${language || 'n/a'}) ${hsmId || ''}`);
      const resp = await whatsappClient.deleteTemplate(wabaId, name, hsmId);
      results.push({ name, language, hsmId, ok: true, status: resp.status || 200, data: resp.data || resp });
    } catch (err) {
      console.error(`[templates:delete] FAIL ${name}: ${err.message}`);
      results.push({ name, language, hsmId, ok: false, error: err.message, response: err.response || null, status: err.status || null });
    }
    if (i < selected.length - 1) await sleep(args.delayMs);
  }

  const outPath = path.join(__dirname, 'template_delete_all_results.json');
  fs.writeFileSync(outPath, JSON.stringify({ wabaId, at: new Date().toISOString(), count: selected.length, results }, null, 2));
  console.log('[templates:delete] Done. Results written to:', outPath);
}

run().catch((e) => {
  console.error('[templates:delete] Fatal:', e.message);
  process.exitCode = 1;
});

