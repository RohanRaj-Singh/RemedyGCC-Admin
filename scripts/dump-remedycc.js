var d = db;
print("=== REMEDYCC DB ===");
d.getCollectionNames().sort().forEach(function(c) {
  print(c + " (" + d[c].countDocuments() + ")");
});
