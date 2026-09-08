var req = db.claimRequests.findOne(
    { requestId: "e2e_req_indep_a" },
    { _id: 0, requestId: 1, claimId: 1, status: 1, type: 1, purpose: 1 }
);
print("=== E2E_REQ_INDEP_A ===");
if (!req) {
  print("DOCUMENT NOT FOUND");
} else {
  printjson(req);
  
  // Also check if ANY doc has claimId null/missing
  var allNull = db.claimRequests.find({claimId: null}).toArray();
  print("\n=== Docs with NULL claimId ===");
  allNull.forEach(function(d) { printjson({_id:d._id, requestId:d.requestId, status:d.status, claimId:d.claimId}); });
  
  var total = db.claimRequests.countDocuments();
  print("\nTotal docs: " + total);
  var withClaimId = db.claimRequests.countDocuments({claimId: {$exists:true, $ne:null}});
  var withoutClaimId = total - withClaimId;
  print("With claimId: " + withClaimId);
  print("Without claimId: " + withoutClaimId);
}
