// Merge tenantapp -> remedyggg (handles duplicates gracefully)
var src = db.getSiblingDB('tenantapp');
var dst = db.getSiblingDB('remedygcc');

var collections = ['admins', 'adminSessions', 'tenantDashboardSessions', 'tenants', 'clinics',
                   'aggregationSnapshots', 'attributeTemplateVersions', 'runtimeConfigs',
                   'scannerVersions', 'scanners', 'rawResponses', 'attributeTemplates'];

var totalCopied = 0;
var totalSkipped = 0;

collections.forEach(function(col) {
  if (!src.getCollectionNames().includes(col)) {
    print(col + ': not in tenantapp, skipping');
    return;
  }
  
  var count = src[col].countDocuments();
  if (count === 0) {
    print(col + ': empty in tenantapp, skipping');
    return;
  }
  
  var copied = 0;
  var skipped = 0;
  var errors = 0;
  
  src[col].find({}).toArray().forEach(function(srcDoc) {
    try {
      // Check if doc exists in destination by _id
      var existing = dst[col].findOne({_id: srcDoc._id});
      if (existing) {
        skipped++;
      } else {
        // Remove any internal keys that might conflict
        dst[col].insertOne(JSON.parse(JSON.stringify(srcDoc)));
        copied++;
      }
    } catch (e) {
      if (e.codeName === 'DuplicateKey') {
        skipped++;
      } else {
        print(col + ': ERROR on ' + srcDoc._id + ': ' + e.message);
        errors++;
      }
    }
  });
  
  print(col + ': copied=' + copied + ' skipped=' + skipped + ' errors=' + errors + '/' + count);
  totalCopied += copied;
  totalSkipped += skipped;
});

print('\n=== MERGE COMPLETE ===');
print('Total copied: ' + totalCopied);
print('Total skipped: ' + totalSkipped);
