// Example Express.js routes

// Get all categories
app.get('/api/categories', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM categories ORDER BY name');
  res.json(rows);
});

// Assign category to a transaction
app.post('/api/transactions/:id/categories', async (req, res) => {
  const { categoryId } = req.body;
  const transactionId = req.params.id;

  await db.query(
    'INSERT IGNORE INTO transaction_categories (transaction_id, category_id) VALUES (?, ?)',
    [transactionId, categoryId]
  );

  res.json({ success: true });
});

// Remove category from a transaction
app.delete('/api/transactions/:id/categories/:categoryId', async (req, res) => {
  const { id, categoryId } = req.params;

  await db.query(
    'DELETE FROM transaction_categories WHERE transaction_id = ? AND category_id = ?',
    [id, categoryId]
  );

  res.json({ success: true });
});
