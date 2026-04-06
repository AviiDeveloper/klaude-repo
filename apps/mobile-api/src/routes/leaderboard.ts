import { Router } from 'express';
import { requireAuth, getUser } from '../auth.js';
import { queryAll } from '../db.js';

const router = Router();

interface RankRow {
  user_id: string;
  name: string;
  contractor_number: string | null;
  sales_count: number;
  earned: number;
}

// GET /leaderboard?period=weekly|monthly|alltime
router.get('/', requireAuth, (req, res) => {
  const { user_id } = getUser(req);
  const period = (req.query.period as string) ?? 'alltime';

  let dateFilter = '';
  if (period === 'weekly') {
    dateFilter = `AND la.sold_at >= datetime('now', '-7 days')`;
  } else if (period === 'monthly') {
    dateFilter = `AND la.sold_at >= datetime('now', '-30 days')`;
  }

  const sql = `
    SELECT
      su.id as user_id,
      su.name,
      su.contractor_number,
      COUNT(la.id) as sales_count,
      COALESCE(SUM(la.commission_amount), COUNT(la.id) * 50) as earned
    FROM sales_users su
    LEFT JOIN lead_assignments la
      ON la.user_id = su.id
      AND la.status = 'sold'
      ${dateFilter}
    WHERE su.active = 1
    GROUP BY su.id
    ORDER BY sales_count DESC, earned DESC
  `;

  const rows = queryAll<RankRow>(sql);

  const rankings = rows.map((row, index) => ({
    rank: index + 1,
    user_id: row.user_id,
    name: row.name,
    contractor_number: row.contractor_number,
    sales_count: row.sales_count,
    earned: row.earned,
    is_you: row.user_id === user_id,
  }));

  res.json({ rankings });
});

export default router;
