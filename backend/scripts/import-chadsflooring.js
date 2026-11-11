// Imports the chadsflooring.bz catalog (prisma/data/chadsflooring-catalog.json) into the shop:
// one product per product group, its real variants as ProductOption (label, price, stock),
// its images, description, brand and category. Safe to run again: products are matched by
// their variants' site ids (the seed's frontendId is one of them), never duplicated.
//
//   node scripts/import-chadsflooring.js            import / update
//   node scripts/import-chadsflooring.js --dry-run  show what would change, write nothing
//   node scripts/import-chadsflooring.js --keep-missing   don't hide products absent from the catalog
//
// Images stay on the site's image server (like the seed). Quantity price tiers are not imported
// (the shop has no tier pricing).
require('dotenv').config();
const path = require('path');
const prisma = require('../src/db');

const DRY = process.argv.includes('--dry-run');
const KEEP_MISSING = process.argv.includes('--keep-missing');
const catalog = require(path.join(__dirname, '..', 'prisma', 'data', 'chadsflooring-catalog.json'));

const slugify = s => String(s).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
const round2 = n => Math.round(n * 100) / 100;
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

// The site's HTML description as plain text with line breaks
function plain(html) {
  return String(html || '')
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function describe(g) {
  const text = plain(g.description);
  const facts = (g.tags || [])
    .filter(t => t.values?.length && !/authentic/i.test(t.name))
    .map(t => `${t.name}: ${t.values.join(', ')}`);
  return [text, facts.join('\n')].filter(Boolean).join('\n\n');
}

(async () => {
  const stats = { created: 0, updated: 0, options: 0, images: 0, brands: 0, categories: 0, hidden: 0, skipped: 0 };

  // Categories: the shop's categories carry the site's category id as frontendId
  const cats = Object.fromEntries((await prisma.category.findMany()).map(c => [c.frontendId, c]));
  async function categoryId(c) {
    if (!c) return null;
    const key = String(c.id);
    if (cats[key]) return cats[key].id;
    stats.categories++;
    if (DRY) return null;
    const created = await prisma.category.create({ data: { frontendId: key, slug: slugify(c.name) || `cat-${key}`, label: c.name } });
    cats[key] = created;
    return created.id;
  }

  // Brands: slug = the site's brand handle (as the seed did)
  const brands = Object.fromEntries((await prisma.brand.findMany()).map(b => [b.slug.toLowerCase(), b]));
  async function brandId(b) {
    if (!b?.name) return null;
    const slug = String(b.url || slugify(b.name));
    const hit = brands[slug.toLowerCase()];
    if (hit) return hit.id;
    stats.brands++;
    if (DRY) return null;
    const created = await prisma.brand.create({ data: { name: clean(b.name), slug } });
    brands[slug.toLowerCase()] = created;
    return created.id;
  }

  // Existing products by frontendId (the seed used a variant id)
  const existing = await prisma.product.findMany({ select: { id: true, frontendId: true, slug: true } });
  const byFid = new Map(existing.filter(p => p.frontendId != null).map(p => [p.frontendId, p]));
  const usedSlugs = new Set(existing.map(p => p.slug));
  const touched = new Set();

  for (const g of catalog) {
    const variations = (g.variations || []).filter(v => v.price != null);
    if (!variations.length) { stats.skipped++; continue; }
    const vPrice = v => round2(Number(v.discountPrice ?? v.price));
    const base = Math.min(...variations.map(vPrice));
    const stock = variations.reduce((s, v) => s + Math.max(0, v.stock || 0), 0);
    const ids = variations.map(v => v.id);
    const match = ids.map(id => byFid.get(id)).find(Boolean);
    const images = (g.images || []).filter(Boolean);
    const card = images[0] ? images[0].replace('/x950-', '/x450-') : '';

    const data = {
      name:         clean(g.name),
      description:  describe(g),
      price:        base,
      priceType:    'usd',
      stock,
      imageUrl:     card,
      rating:       Number(g.rating || 0),
      reviewCount:  g.reviewCount || 0,
      optionsCount: variations.length,
      isActive:     true,
      isOnSale:     variations.some(v => v.sale || v.discountPrice != null) || !!g.sale,
      brandId:      await brandId(g.brand),
      categoryId:   await categoryId(g.category),
    };

    let productId;
    if (match) {
      stats.updated++;
      productId = match.id;
      if (!DRY) await prisma.product.update({ where: { id: match.id }, data });
    } else {
      stats.created++;
      let slug = slugify(`${g.brand?.name || ''} ${g.name}`) || `product-${g.id}`;
      if (usedSlugs.has(slug)) slug = `${slug}-${g.id}`;
      usedSlugs.add(slug);
      if (!DRY) {
        const created = await prisma.product.create({ data: { ...data, slug, frontendId: Math.min(...ids) } });
        productId = created.id;
      }
    }
    touched.add(productId);
    if (DRY) { stats.options += variations.length; stats.images += images.length; continue; }

    // Variants: matched by label (keeps the ids that orders point to), others added, missing ones emptied
    const opts = await prisma.productOption.findMany({ where: { productId } });
    const byLabel = new Map(opts.map(o => [o.label.toLowerCase(), o]));
    const seen = new Set();
    for (const [i, v] of variations.entries()) {
      const label = clean(v.name) || `Option ${i + 1}`;
      const row = { label, priceDelta: round2(vPrice(v) - base), stock: Math.max(0, v.stock || 0), sortOrder: i };
      const hit = byLabel.get(label.toLowerCase());
      if (hit) { await prisma.productOption.update({ where: { id: hit.id }, data: row }); seen.add(hit.id); }
      else await prisma.productOption.create({ data: { ...row, productId } });
      stats.options++;
    }
    const gone = opts.filter(o => !seen.has(o.id) && !variations.some(v => clean(v.name).toLowerCase() === o.label.toLowerCase()));
    if (gone.length) await prisma.productOption.updateMany({ where: { id: { in: gone.map(o => o.id) } }, data: { stock: 0 } });

    // Images: replaced by the catalog's
    await prisma.productImage.deleteMany({ where: { productId } });
    if (images.length) {
      await prisma.productImage.createMany({ data: images.map((url, i) => ({ productId, url, altText: data.name, sortOrder: i })) });
      stats.images += images.length;
    }
  }

  // Products of the site no longer in its catalog: hidden (not deleted, orders keep them)
  if (!KEEP_MISSING) {
    const stale = existing.filter(p => p.frontendId != null && !touched.has(p.id)).map(p => p.id);
    stats.hidden = stale.length;
    if (stale.length && !DRY) await prisma.product.updateMany({ where: { id: { in: stale } }, data: { isActive: false } });
  }

  console.log(`${DRY ? '[dry run] ' : ''}${catalog.length} product groups in the catalog`);
  console.log(stats);
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
