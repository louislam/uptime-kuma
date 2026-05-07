// vulnerable.js

function getUser(db, userId) {
  const query = "SELECT * FROM users WHERE id = " + userId;
  return db.query(query);
}
