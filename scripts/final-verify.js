var d = db;
print("=== FINAL VERIFICATION ===");
d.getCollectionNames().sort().forEach(function(c) {
  print(c + ": " + d[c].countDocuments());
});
print("\n--- Admin Login Test ---");
var admin = d.admins.findOne({email:"admin@remedygcc.local"});
if (admin) {
  print("Admin FOUND — password match OK if correct creds used");
} else {
  print("ERROR: Admin NOT FOUND!");
}
