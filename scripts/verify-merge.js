print("=== VERIFICATION ===");
var d = db;
print("Admins count:", d.admins.countDocuments());
d.admins.find({}, {email: 1}).toArray().forEach(function(a) { print("  Admin:", a.email); });
print("\nAll collections:", d.getCollectionNames().sort());
