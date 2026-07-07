const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { lookupOemCrossAndApplicability } = require('../services/oemLookup');

const router = express.Router();
router.use(authRequired);

// AI-lookup: cross-references and applicability by OEM number
router.post('/:id/ai-lookup', requireRole('admin', 'storekeeper', 'manager'), async (req, res) => {
  try {
    const [[prod]] = await db.query('SELECT p.id, p.name, p.oem_number, p.oem_manufacturer, d.brand AS donor_brand, d.model AS donor_model, d.year AS donor_year FROM products p LEFT JOIN donors d ON d.id = p.donor_id WHERE p.id=?', [req.params.id]);
    if (!prod) return res.status(404).json({ error: 'Product not found' });
    if (!prod.oem_number) return res.status(400).json({ error: 'Product has no OEM number' });
    const donorInfo = prod.donor_brand ? { make: prod.donor_brand, model: prod.donor_model, year: prod.donor_year } : null;
    const result = await lookupOemCrossAndApplicability(prod.oem_number, prod.name, prod.oem_manufacturer, donorInfo);
    let added = 0;
    for (const cr of result.crossRefs) {
      const [[existing]] = await db.query('SELECT id FROM cross_references WHERE product_id=? AND cross_number=?', [prod.id, cr.number]);
      if (existing) continue;
      await db.query("INSERT INTO cross_references (product_id, cross_number, brand, source) VALUES (?,?,?,'ai')", [prod.id, cr.number, cr.brand]);
      added++;
    }
    if (result.applicability && result.applicability.length) {
      await db.query('UPDATE products SET applicability=? WHERE id=?', [JSON.stringify(result.applicability), prod.id]);
    }
    res.json({ ok: true, addedCrossRefs: added, applicability: result.applicability });
  } catch (e) {
    res.status(502).json({ error: e.message || 'AI lookup failed' });
  }
});

async function generateSku() {
  // Счётчик: атомарно берём следующий номер, никогда не повторяется
  await db.query('UPDATE sku_counter SET val = LAST_INSERT_ID(val + 1) WHERE id = 1');
  const [[row]] = await db.query('SELECT LAST_INSERT_ID() AS n');
  return String(row.n);
}

// Список товаров с фильтрами и пагинацией
router.get('/', async (req, res) => {
  const {
    q, category_id, status, condition_grade, donor_id, donor_q, archived,
    page = 1, limit = 50, sort = 'created_at', order = 'desc', exclude_draft, receipt_id
  } = req.query;

  const allowedSort = ['created_at', 'price', 'name', 'sku'];
  const sortCol = allowedSort.includes(sort) ? sort : 'created_at';
  const sortDir = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const where = [];
  const params = [];

  if (q) {
    where.push('(p.name LIKE ? OR p.oem_number LIKE ? OR p.sku LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (category_id) { where.push('p.category_id = ?'); params.push(category_id); }
  if (status) { where.push('p.status = ?'); params.push(status); }
  // ARCHIVE_FILTER: sold/written_off live in archive
  if (String(archived) === '1') { where.push("p.status IN ('sold','written_off')"); }
  else if (!status) { where.push("p.status NOT IN ('sold','written_off','cancelled')"); }
  if (condition_grade) { where.push('p.condition_grade = ?'); params.push(condition_grade); }
  if (donor_id) { where.push('p.donor_id = ?'); params.push(donor_id); }
  if (donor_q) { where.push('(d.brand LIKE ? OR d.model LIKE ? OR p.applicability LIKE ?)'); params.push(`%${donor_q}%`, `%${donor_q}%`, `%${donor_q}%`); }

if (receipt_id) { where.push('p.receipt_id = ?'); params.push(receipt_id); } else { where.push('(p.receipt_id IS NULL OR p.receipt_id NOT IN (SELECT id FROM receipts WHERE status = \'draft\'))'); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(1000, parseInt(limit));
  const lim = Math.min(1000, parseInt(limit) || 50);

  const [rows] = await db.query(
    `SELECT p.id, p.sku, p.name, p.category_id, c.name AS category_name,
            p.condition_grade, p.oem_number, p.donor_id, p.price, p.quantity,
            p.storage_location_id, sl.full_code AS storage_code,
            p.status, p.writeoff_reason, p.created_at,
            d.brand AS donor_brand, d.model AS donor_model, d.year AS donor_year,
            (SELECT file_path FROM product_photos pp WHERE pp.product_id = p.id ORDER BY sort_order LIMIT 1) AS thumbnail
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN storage_locations sl ON sl.id = p.storage_location_id
  LEFT JOIN donors d ON d.id = p.donor_id
     ${whereSql}
     ORDER BY p.${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, lim, offset]
  );

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM products p LEFT JOIN donors d ON d.id = p.donor_id ${whereSql}`,
    params
  );

  res.json({ items: rows, total, page: parseInt(page), limit: lim });
});

// Карточка товара — полная
//    SKU/OEM   (   )

//     
router.patch('/:id/receipt', requireRole('admin', 'storekeeper', 'manager'), async (req, res, next) => {
  try {
    const { receipt_id } = req.body;
    const [[product]] = await db.query('SELECT id FROM products WHERE id=?', [req.params.id]);
    if (!product) return res.status(404).json({ error: '  ' });
    if (receipt_id) {
      const [[receipt]] = await db.query('SELECT id FROM receipts WHERE id=?', [receipt_id]);
      if (!receipt) return res.status(404).json({ error: '  ' });
    }
    await db.query('UPDATE products SET receipt_id=? WHERE id=?', [receipt_id || null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.get('/by-sku/:code', async (req, res) => {
  const code = String(req.params.code).trim();
  const [rows] = await db.query(
    `SELECT p.id, p.sku, p.name, p.category_id, c.name AS category_name,
            p.condition_grade, p.oem_number, p.donor_id, p.price, p.quantity,
            p.storage_location_id, p.description, p.status, p.created_by, p.created_at, p.updated_at,
            p.export_avito, p.export_drom, p.export_site, p.writeoff_reason
     FROM products p LEFT JOIN categories c ON c.id=p.category_id
     WHERE (p.sku=? OR p.id=? OR p.oem_number=?) AND p.status<>'cancelled'
     ORDER BY (p.sku=?) DESC LIMIT 1`,
    [code, code, code, code]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ item: rows[0] });
});
router.get('/:id', async (req, res) => {
  const [[product]] = await db.query(
    `SELECT p.*, c.name AS category_name,
            d.brand AS donor_brand, d.model AS donor_model, d.year AS donor_year,
            d.vin AS donor_vin, d.body_type AS donor_body_type, d.engine_code AS donor_engine_code,
            sl.full_code AS storage_code, sl.full_path AS storage_path
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN donors d ON d.id = p.donor_id
     LEFT JOIN storage_locations sl ON sl.id = p.storage_location_id
     WHERE p.id = ?`,
    [req.params.id]
  );

  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  const [photos] = await db.query(
    'SELECT id, file_path, sort_order FROM product_photos WHERE product_id = ? ORDER BY sort_order',
    [req.params.id]
  );
  const [crossRefs] = await db.query(
    'SELECT id, cross_number, brand, source FROM cross_references WHERE product_id = ?',
    [req.params.id]
  );
  const [exportProfiles] = await db.query(
    `SELECT ep.platform_id, pl.code AS platform_code, pl.name AS platform_name,
            ep.is_enabled, ep.publish_status, ep.external_listing_id, ep.last_synced_at, ep.last_error
     FROM export_profiles ep
     JOIN export_platforms pl ON pl.id = ep.platform_id
     WHERE ep.product_id = ?`,
    [req.params.id]
  );
  const [oemApplicability] = await db.query(
    `SELECT oa.id, oa.vehicle_brand, oa.vehicle_model, oa.year_from, oa.year_to,
            oa.body_type, oa.engine_code, oa.is_cross_brand, oa.source, oa.is_confirmed
     FROM product_oem_links pol
     JOIN oem_applicability oa ON oa.oem_part_id = pol.oem_part_id
     WHERE pol.product_id = ?`,
    [req.params.id]
  );

  res.json({ ...product, photos, cross_references: crossRefs, export_profiles: exportProfiles, oem_applicability: oemApplicability });
});

// Создание карточки товара (вручную, без поступления — для совместимости)
router.post('/',
  requireRole('admin', 'storekeeper', 'manager'),
  body('name').notEmpty(),
  body('price').optional().isNumeric(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Проверьте заполненные поля' });

    const {
      name, category_id, condition_grade = 'used_good', oem_number, oem_manufacturer,
      donor_id, receipt_id, price = 0, quantity = 1,
      storage_location_id, description
    } = req.body;

    const sku = await generateSku();

    const [result] = await db.query(
      `INSERT INTO products
        (sku, name, category_id, condition_grade, oem_number, oem_manufacturer, donor_id, receipt_id,
         price, quantity, storage_location_id, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_stock', ?)`,
      [sku, name, category_id || null, condition_grade, oem_number || null, oem_manufacturer || null,
       donor_id || null, receipt_id || null, price, quantity,
       storage_location_id || null, description || null, req.user.id]
    );

    await db.query(
      `INSERT INTO activity_log (user_id, entity_type, entity_id, action, details)
       VALUES (?, 'product', ?, 'create', JSON_OBJECT('sku', ?))`,
      [req.user.id, result.insertId, sku]
    );

    res.status(201).json({ id: result.insertId, sku });
  }
);

// Обновление карточки товара
router.put('/:id',
  requireRole('admin', 'storekeeper', 'manager'),
  async (req, res) => {
    try { require('fs').appendFileSync('/tmp/put_log.txt', new Date().toISOString()+' id='+req.params.id+' body='+JSON.stringify(req.body)+'\n'); } catch(e){}
    const allowedFields = [
      'name', 'category_id', 'condition_grade', 'oem_number', 'oem_manufacturer', 'price',
      'quantity', 'storage_location_id', 'description', 'status',
      'export_avito', 'export_drom', 'export_site', 'donor_id'];
    const updates = [];
    const params = [];
    const numericFields = ['category_id', 'storage_location_id', 'donor_id', 'price', 'quantity'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        let val = req.body[field];
        if (numericFields.includes(field) && (val === '' || val === null)) val = null;
        updates.push(`${field} = ?`);
        params.push(val);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'Нет полей для обновления' });

    params.push(req.params.id);
    await db.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);

    await db.query(
      `INSERT INTO activity_log (user_id, entity_type, entity_id, action, details)
       VALUES (?, 'product', ?, 'update', ?)`,
      [req.user.id, req.params.id, JSON.stringify(req.body)]
    );

    res.json({ ok: true });
  }
);

// Удаление (только администратор, мягкое — статус cancelled)
router.delete('/:id', requireRole('admin', 'storekeeper', 'manager'), async (req, res) => {
  await db.query("UPDATE products SET status = 'cancelled' WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// Добавить кросс-номер вручную
router.post('/:id/cross-references', requireRole('admin', 'storekeeper', 'manager'),
  async (req, res) => {
    try {
      const { cross_number, brand } = req.body;
      if (!cross_number || !cross_number.trim()) return res.status(400).json({ error: 'cross_number required' });
      const [result] = await db.query(
        "INSERT INTO cross_references (product_id, cross_number, brand, source) VALUES (?, ?, ?, 'manual')",
        [req.params.id, cross_number.trim(), brand || null]
      );
      const [[row]] = await db.query('SELECT id, cross_number, brand, source FROM cross_references WHERE id=?', [result.insertId]);
      res.status(201).json(row);
    } catch(e) { res.status(500).json({ error: e.message }); }
  }
);

// Настроить публикацию на площадке
router.put('/:id/export/:platformId', requireRole('admin', 'storekeeper', 'manager'),
  async (req, res) => {
    try {
      const { id, platformId } = req.params;
      const { enabled } = req.body;
      const col = platformId === 'avito' ? 'export_avito' : platformId === 'drom' ? 'export_drom' : platformId === 'site' ? 'export_site' : null;
      if (!col) return res.status(400).json({ error: 'Unknown platform' });
      await db.query(`UPDATE products SET ${col}=? WHERE id=?`, [enabled ? 1 : 0, id]);
      const [[p]] = await db.query('SELECT export_avito, export_drom, export_site FROM products WHERE id=?', [id]);
      res.json({ ok: true, ...p });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Смена статуса товара (возврат → в наличии / списание)
router.patch('/:id/status', requireRole('admin', 'storekeeper', 'manager'), async (req, res) => {
  try {
    const { status, writeoff_reason } = req.body;
    const allowed = ['in_stock', 'reserved', 'sold', 'return', 'written_off'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Недопустимый статус' });
    if (status === 'written_off' && (!writeoff_reason || !writeoff_reason.trim())) {
      return res.status(400).json({ error: 'Для списания нужна причина' });
    }
    if (status === 'written_off') {
      await db.query('UPDATE products SET status = ?, writeoff_reason = ? WHERE id = ?', [status, writeoff_reason.trim(), req.params.id]);
    } else {
      await db.query('UPDATE products SET status = ?, writeoff_reason = NULL WHERE id = ?', [status, req.params.id]);
    }
    const [[row]] = await db.query('SELECT id, status, writeoff_reason FROM products WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// Загрузка нескольких фото к товару
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.params.id}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only images allowed'));
}});

router.post('/:id/photos', upload.array('photos', 20), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });
    const [[{ maxOrder }]] = await db.query('SELECT COALESCE(MAX(sort_order),0) AS maxOrder FROM product_photos WHERE product_id=?', [id]);
    const inserted = [];
    for (let i = 0; i < req.files.length; i++) {
      const f = req.files[i];
      const filePath = `/uploads/products/${f.filename}`;
      await db.query('INSERT INTO product_photos (product_id, file_path, sort_order) VALUES (?,?,?)', [id, filePath, maxOrder + i + 1]);
      inserted.push(filePath);
    }
    res.json({ ok: true, photos: inserted });
  } catch (e) { next(e); }
});

router.delete('/:id/photos/:photoId', async (req, res, next) => {
  try {
    const [[photo]] = await db.query('SELECT file_path FROM product_photos WHERE id=? AND product_id=?', [req.params.photoId, req.params.id]);
    if (!photo) return res.status(404).json({ error: 'Not found' });
    await db.query('DELETE FROM product_photos WHERE id=?', [req.params.photoId]);
    const fullPath = path.join(__dirname, '../..', photo.file_path);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- Распознавание OEM по фото (добавлено) ----
const { recognizeAndSave, recognizeFirstSuccessful } = require('../services/oemVision');

router.post('/:id/recognize-oem', requireRole('admin', 'storekeeper', 'manager'), async (req, res, next) => {
  try {
    const productId = req.params.id;
    const { photoId } = req.body;
    if (!photoId) return res.status(400).json({ error: 'photoId обязателен' });

    const [[photo]] = await db.query(
      'SELECT id, file_path FROM product_photos WHERE id = ? AND product_id = ?',
      [photoId, productId]
    );
    if (!photo) return res.status(404).json({ error: 'Фото не найдено у этого товара' });

    const result = await recognizeAndSave(productId, photoId, photo.file_path);
    res.json({
      ok: true,
      oem_number: result.oem_number,
      confidence: result.confidence,
      status: result.status,
      raw_text: result.raw_text,
      reasoning: result.reasoning,
    });
  } catch (e) { next(e); }
});

// ---- Загрузка фото OEM-номера с автораспознаванием (добавлено, отдельный роут) ----

// ---- Загрузка фото OEM-номера с автораспознаванием ТОЛЬКО для нового товара (добавлено) ----
router.post('/:id/photos/oem', upload.single('photo'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file' });

    // Проверяем, что это действительно НОВЫЙ товар: ещё нет ни одного фото и не заполнен OEM вручную.
    // Это и есть условие "только при добавлении нового товара" — повторная загрузка фото
    // к уже существующей карточке автораспознавание не запускает.
    const [[{ photoCount }]] = await db.query(
      'SELECT COUNT(*) AS photoCount FROM product_photos WHERE product_id = ?',
      [id]
    );
    const [[product]] = await db.query(
      'SELECT oem_number, oem_recognition_status FROM products WHERE id = ?',
      [id]
    );
    const isNewProduct = photoCount === 0 && (!product || !product.oem_number) &&
      (!product || product.oem_recognition_status === 'none' || !product.oem_recognition_status);

    const filePath = `/uploads/products/${req.file.filename}`;
    const [[{ maxOrder }]] = await db.query(
      'SELECT COALESCE(MAX(sort_order),0) AS maxOrder FROM product_photos WHERE product_id=?',
      [id]
    );
    const [result] = await db.query(
      'INSERT INTO product_photos (product_id, file_path, sort_order, is_oem_photo) VALUES (?,?,?,1)',
      [id, filePath, maxOrder + 1]
    );

    res.status(201).json({ ok: true, id: result.insertId, file_path: filePath, auto_recognition: isNewProduct });

    // Распознавание запускаем в фоне ТОЛЬКО для нового товара
    if (isNewProduct) {
      recognizeAndSave(id, result.insertId, filePath).catch((e) => {
        console.error(`Фоновое распознавание OEM не удалось (product ${id}):`, e.message);
      });
    }
  } catch (e) { next(e); }
});

// ---- Загрузка ВСЕХ фото нового товара с перебором для распознавания OEM (добавлено) ----
// Принимает несколько файлов сразу. Сохраняет их все как обычные фото товара.
// Затем в фоне перебирает фото по очереди и распознаёт по КАЖДОМУ, пока не найдёт
// первый успешный результат (oem_number не null). Как только найден — записывает
// его в карточку и останавливается, остальные фото уже не проверяет.
router.post('/:id/photos/oem-batch', upload.array('photos', 20), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files' });

    // Проверяем, что это новый товар (та же защита, что и раньше)
    const [[{ photoCount }]] = await db.query(
      'SELECT COUNT(*) AS photoCount FROM product_photos WHERE product_id = ?',
      [id]
    );
    const [[product]] = await db.query(
      'SELECT oem_number, oem_recognition_status FROM products WHERE id = ?',
      [id]
    );
    const isNewProduct = photoCount === 0 && (!product || !product.oem_number) &&
      (!product || product.oem_recognition_status === 'none' || !product.oem_recognition_status);

    const [[{ maxOrder }]] = await db.query(
      'SELECT COALESCE(MAX(sort_order),0) AS maxOrder FROM product_photos WHERE product_id=?',
      [id]
    );

    // Сохраняем ВСЕ фото как обычные записи (is_oem_photo=1 у всех — все они кандидаты)
    const savedPhotos = [];
    for (let i = 0; i < req.files.length; i++) {
      const f = req.files[i];
      const filePath = `/uploads/products/${f.filename}`;
      const [result] = await db.query(
        'INSERT INTO product_photos (product_id, file_path, sort_order, is_oem_photo) VALUES (?,?,?,1)',
        [id, filePath, maxOrder + i + 1]
      );
      savedPhotos.push({ id: result.insertId, file_path: filePath });
    }

    res.status(201).json({ ok: true, photos: savedPhotos, auto_recognition: isNewProduct });

    // Перебор фото для распознавания — в фоне, останавливаемся на первом успехе
    if (isNewProduct) {
      recognizeFirstSuccessful(id, savedPhotos).catch((e) => {
        console.error(`Фоновое распознавание OEM (batch) не удалось (product ${id}):`, e.message);
      });
    }
  } catch (e) { next(e); }
});

// ---- Ручной запуск распознавания OEM по ВСЕМ уже загруженным фото товара (кнопка) ----
// В отличие от автозапуска при первой загрузке, эта кнопка не имеет ограничений
// "только для нового товара" — её можно нажимать в любой момент, сколько угодно раз,
// например когда фото догружались по одному в разное время.
// Перебирает все фото товара (или только переданные photoIds, если фронт их прислал)
// и останавливается на первом, где уверенно распознан номер.
router.post('/:id/recognize-oem-all', requireRole('admin', 'storekeeper', 'manager'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { photoIds } = req.body; // необязательно: ограничить конкретными фото

    let photos;
    if (Array.isArray(photoIds) && photoIds.length) {
      const placeholders = photoIds.map(() => '?').join(',');
      [photos] = await db.query(
        `SELECT id, file_path FROM product_photos WHERE product_id = ? AND id IN (${placeholders}) ORDER BY sort_order`,
        [id, ...photoIds]
      );
    } else {
      [photos] = await db.query(
        'SELECT id, file_path FROM product_photos WHERE product_id = ? ORDER BY sort_order',
        [id]
      );
    }

    if (!photos.length) {
      return res.status(404).json({ error: 'У товара нет фото' });
    }

    const result = await recognizeFirstSuccessful(id, photos);

    if (!result) {
      return res.status(502).json({ error: 'Не удалось распознать ни по одному фото' });
    }

    res.json({
      ok: true,
      oem_number: result.oem_number,
      confidence: result.confidence,
      status: result.status,
      raw_text: result.raw_text,
      reasoning: result.reasoning,
      comment: result.comment,
      photoId: result.photoId,
      checkedPhotos: photos.length,
    });
  } catch (e) { next(e); }
});
