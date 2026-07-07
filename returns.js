const express = require('express');
const db = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// Список возвратов, ожидающих проверки (брак)
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT dr.*, p.id AS product_id, p.sku, p.name AS product_name, p.price,
        d.id AS deal_id_full, c.name AS client_name
       FROM deal_returns dr
       LEFT JOIN deal_items di ON di.id = dr.item_id
       LEFT JOIN products p ON p.id = di.product_id
       LEFT JOIN deals d ON d.id = dr.deal_id
       LEFT JOIN clients c ON c.id = d.client_id
       WHERE dr.resolution IS NULL
       ORDER BY dr.created_at DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Разрешить возврат: вернуть в товары или списать в архив
router.post('/:returnId/resolve', requireRole('admin', 'storekeeper', 'manager'), async (req, res, next) => {
  try {
    const { returnId } = req.params;
    const { action, comment } = req.body; // action: 'return' | 'writeoff'
    const [[ret]] = await db.query('SELECT * FROM deal_returns WHERE id=?', [returnId]);
    if (!ret) return res.status(404).json({ error: 'Не найдено' });
    if (ret.item_id) {
      const [[item]] = await db.query('SELECT product_id FROM deal_items WHERE id=?', [ret.item_id]);
      if (item) {
        const newStatus = action === 'writeoff' ? 'written_off' : 'in_stock';
        await db.query('UPDATE products SET status=? WHERE id=?', [newStatus, item.product_id]);
      }
    }
    const resolution = action === 'writeoff' ? 'written_off' : 'returned';
    await db.query(
      'UPDATE deal_returns SET resolution=?, resolved_at=NOW(), comment=COALESCE(?, comment) WHERE id=?',
      [resolution, comment || null, returnId]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
