var r = db.claimRequests.findOne({requestId:"e2e_req_indep_a"}, {_id:1,requestId:1,claimId:1,status:1,tenantId:1,type:1});
if (r) { print("FOUND: "+JSON.stringify(r)); } else { print("NOT FOUND"); }
print("TOTAL:"+db.claimRequests.countDocuments());
