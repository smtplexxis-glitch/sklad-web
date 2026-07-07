const db = require('../config/db');

const API_KEY = process.env.MOYAPOSYLKA_API_KEY;
const BASE = 'https://moyaposylka.ru/api/v1';

const CARRIERS = ['cdek', 'pecom', 'ozon', 'russian-post'];

function headers() {
  return { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' };
}

async function addTracker(carrier, barcode, orderId) {
  if (!API_KEY) throw new Error('MOYAPOSYLKA_API_KEY not set');
  if (!CARRIERS.includes(carrier)) throw new Error('Unknown carrier: ' + carrier);
  const url = BASE + '/trackers/' + carrier + '/' + encodeURIComponent(barcode);
  const body = orderId ? { orderId: String(orderId) } : {};
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error('addTracker failed ' + res.status + ': ' + text);
  return text ? JSON.parse(text) : null;
}

async function getTrackerEvents(carrier, barcode) {
  if (!API_KEY) throw new Error('MOYAPOSYLKA_API_KEY not set');
  const url = BASE + '/trackers/' + carrier + '/' + encodeURIComponent(barcode);
  const res = await fetch(url, { method: 'GET', headers: headers() });
  const text = await res.text();
  if (!res.ok) throw new Error('getTrackerEvents failed ' + res.status + ': ' + text);
  return text ? JSON.parse(text) : null;
}

function getLatestEvent(data) {
  if (!data || !Array.isArray(data.events) || data.events.length === 0) return null;
  let latest = data.events[0];
  for (const ev of data.events) {
    if ((ev.position || 0) > (latest.position || 0)) latest = ev;
  }
  return latest;
}

function isDeliveredPayload(data) {
  const latest = getLatestEvent(data);
  if (!latest) return false;
  const op = (latest.operation || '').toLowerCase();
  return op.includes('вручен') || op.includes('доставлен') || op.includes('delivered');
}

function latestStatusText(data) {
  const latest = getLatestEvent(data);
  if (!latest) return '    ';
  let result = latest.operation || '';
  if (latest.location) result += ' (' + latest.location + ')';
  if (latest.eventDate) {
    const d = new Date(latest.eventDate);
    result += ', ' + d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return result;
}

async function pollActiveDeliveries() {
  if (!API_KEY) return;
  let deals;
  try {
    [deals] = await db.query(
      "SELECT id, delivery_carrier, tracking_number FROM deals WHERE status='on_delivery' AND tracking_number IS NOT NULL AND delivery_carrier IS NOT NULL"
    );
  } catch (e) {
    console.error('pollActiveDeliveries: db error', e.message);
    return;
  }
  for (const deal of deals) {
    try {
      const data = await getTrackerEvents(deal.delivery_carrier, deal.tracking_number);
      const eventsJson = JSON.stringify(((data && data.events) || []).slice().sort((a,b)=>(a.position||0)-(b.position||0)));
      const statusText = latestStatusText(data);
      const delivered = isDeliveredPayload(data);
      if (delivered) {
        await db.query(
          "UPDATE deals SET delivery_status=?, delivery_events=?, status='completed', delivered_at=NOW() WHERE id=?",
          [statusText, eventsJson, deal.id]
        );
        await db.query(
          "UPDATE products p JOIN deal_items di ON di.product_id=p.id SET p.status='sold', p.export_avito=0, p.export_drom=0, p.export_site=0 WHERE di.deal_id=?",
          [deal.id]
        );
        console.log('Deal ' + deal.id + ' auto-completed: delivered.');
      } else {
        await db.query('UPDATE deals SET delivery_status=?, delivery_events=? WHERE id=?', [statusText, eventsJson, deal.id]);
      }
    } catch (e) {
      console.error('pollActiveDeliveries deal ' + deal.id + ':', e.message);
    }
  }
}

function startDeliveryPolling(intervalMinutes) {
  const ms = (intervalMinutes || 20) * 60 * 1000;
  setInterval(() => { pollActiveDeliveries().catch(e => console.error('pollActiveDeliveries fatal', e.message)); }, ms);
  pollActiveDeliveries().catch(e => console.error('pollActiveDeliveries initial', e.message));
}

module.exports = { addTracker, getTrackerEvents, pollActiveDeliveries, startDeliveryPolling, CARRIERS };
