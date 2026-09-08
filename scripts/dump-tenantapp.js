var d = db;
print("=== TENANTAPP DB ===");
d.getCollectionNames().sort().forEach(function(c) {
  print(c + " (" + d[c].countDocuments() + ")");
});
