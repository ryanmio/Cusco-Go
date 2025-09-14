const { getDb } = require('../lib/db.ts');

// Update existing photos with different dates for testing
function updatePhotoDates() {
  const db = getDb();
  
  // Get all captures
  const captures = db.getAllSync('SELECT * FROM captures ORDER BY id');
  
  console.log(`Found ${captures.length} captures to update`);
  
  // Update each capture with a different date (spread over the last 7 days)
  captures.forEach((capture, index) => {
    const daysAgo = index % 7; // Spread over 7 days
    const newDate = new Date();
    newDate.setDate(newDate.getDate() - daysAgo);
    newDate.setHours(10 + (index % 8), 30 + (index % 30), 0, 0); // Vary the time
    
    const timestamp = newDate.getTime();
    
    db.runSync('UPDATE captures SET photoTakenAt = ? WHERE id = ?', [timestamp, capture.id]);
    
    console.log(`Updated capture ${capture.id} to ${newDate.toDateString()}`);
  });
  
  console.log('Photo dates updated successfully!');
}

updatePhotoDates();
