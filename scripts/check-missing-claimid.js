var r = db.claimRequests.findOne({requestId:"req_f667439d-55a4-40c6-b3be-96bf8f826098"});
print("DB:", db.getName());
if (!r) { print("NOT FOUND"); quit(0); }
print("FULL DOC:");
printjson(r);
print("\n--- Docs missing claimId ---");
var bad = db.claimRequests.find({$or: [{claimId: null}, {$exists: false}]}).toArray();
bad.forEach(function(d){ printjson({_id:d._id, requestId:d.requestId, status:d.status, has_claimId: !!d.claimId}); });
print("Total:", db.claimRequests.countDocuments());
