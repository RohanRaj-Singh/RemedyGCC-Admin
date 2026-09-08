# RemedyGCC --- Super Admin Financial Workflow Master Context

**Status:** Canonical working context for phased Super Admin work\
**Scope:** Claims, invoicing, organization payment, clinic/recipient
payout recording, budget, bank details, guided UX, bulk operations,
traceability, exceptions, and final simplification.\
**Priority:** Completeness → remove ambiguity → enforce business truth →
simplify UX → bulk efficiency → final audit.

------------------------------------------------------------------------

## 1. Executive Direction

The Super Admin experience has grown into separate Claims, Invoices, and
Payments areas. The client now wants the financial workflow to feel
**simple, guided, and operational**, not like three disconnected CRUD
screens.

The latest direction is:

-   **Two primary financial sections:** Claims and Payments.
-   **Guided two-screen/wizard-like workflow** for the normal path.
-   **Bulk operations** for repeated work.
-   Super Admin must **retain direct power**: search, filters, history,
    individual actions, exceptions, and direct navigation must not
    disappear.
-   The underlying Invoice domain remains important even if Invoice is
    no longer a third primary navigation section.
-   Before polishing, the architecture and business workflow must remain
    explicit and testable.

The Aug 16 meeting recorded the decision to simplify the
claims/invoicing workflow into a guided two-screen process and
reorganize the dashboard around **Claims** and **Payments**. It also
recorded Requests and Chat as separate tabs.

------------------------------------------------------------------------

# 2. Canonical Business Workflow

``` text
Employee submits claim
        ↓
Tenant reviews
        ↓
Tenant approves
        ↓
Claim is handed to Remedy
        ↓
Super Admin selects approved claims
        ↓
Consolidated Remedy invoice is created
        ↓
Invoice is reviewed/downloaded/sent externally
        ↓
Organization pays Remedy
        ↓
Super Admin records organization payment
        ↓
Linked claims become To Be Paid
        ↓
Remedy prepares external payout
        ↓
Actual money transfer happens outside RemedyGCC
        ↓
Super Admin records the external payout
        ↓
Claim becomes Paid
        ↓
Relevant user receives notification
```

### Critical interpretation

RemedyGCC is **not a banking/payment-transfer system**.

The client explicitly clarified that money transfers happen outside the
system, through external processes/email. The system therefore:

-   prepares and displays payment information;
-   generates useful reports/documents;
-   records organization payment;
-   records external clinic/recipient payment;
-   preserves references/history;
-   communicates the resulting status.

It must not pretend to transmit money through a bank unless a future
real integration is explicitly approved.

------------------------------------------------------------------------

# 3. Responsibility Boundaries

## Employee

-   Submit claims.
-   Supply required information, including bank details.
-   View claim history/status.
-   Receive updates/notifications.
-   Use existing communication features where applicable.

## Tenant Admin

Tenant owns the **claim review lifecycle**:

-   Pending.
-   In Progress.
-   Approve.
-   Reject.
-   Freeze.
-   Resubmission/review flow.
-   Review reasons/notes.
-   Progress updates.

Once a claim is approved, the client said it is completely in Remedy's
hands. Tenant should not continue changing the approved financial
workflow.

## Super Admin / Remedy

Super Admin owns the **post-approval financial workflow**:

-   Monitor approved claims.
-   Select eligible claims for invoicing.
-   Create/review/download invoices.
-   Record organization payment.
-   Release linked claims into To Be Paid.
-   Prepare payout information.
-   Record external clinic/recipient payments.
-   Maintain financial history and traceability.
-   Use safe bulk operations.
-   Handle exceptions.

Super Admin is **not normally a Tenant Admin** and must not gain
Approve/Reject/Freeze/In Progress powers unless the permission model is
explicitly changed.

------------------------------------------------------------------------

# 4. Canonical Claim State Machine

``` text
Pending
   ↓
In Progress
   ↓
Approved
   ↓
To Be Paid
   ↓
Paid
```

Other review paths:

``` text
Pending / In Progress → Rejected
Pending / In Progress → Frozen → In Progress
Rejected → resubmission workflow where applicable
```

## Financial transitions

``` text
Approved → To Be Paid
To Be Paid → Paid
```

The first occurs when the relevant organization invoice is recorded as
paid.

The second occurs when Remedy records the external payout.

### Prohibited normal shortcut

``` text
Approved → Paid
```

There must not be a Claims-page shortcut that bypasses the
invoice/organization-payment workflow.

------------------------------------------------------------------------

# 5. State / Ownership Matrix

  -----------------------------------------------------------------------------
  State          Primary owner     Meaning        Invoice        Payout
                                                  eligible       eligible
  -------------- ----------------- -------------- -------------- --------------
  Pending        Tenant            Waiting for    No             No
                                   review                        

  In Progress    Tenant            Review started No             No

  Frozen         Tenant            Review         No             No
                                   temporarily                   
                                   frozen                        

  Rejected       Tenant/employee   Review outcome No             No
                 workflow                                        

  Approved       Tenant → Remedy   Financially    Yes            Not yet
                                   eligible                      

  To Be Paid     Remedy            Organization   No             Yes
                                   has paid;                     
                                   ready for                     
                                   external                      
                                   payout                        

  Paid           Remedy            External       No             Complete
                                   payout                        
                                   recorded                      
  -----------------------------------------------------------------------------

------------------------------------------------------------------------

# 6. Budget Truth

Budget is **annual**.

The client clarified:

``` text
Pending
  → no reservation

In Progress
  → amount reserved

Rejected
  → reservation released

Frozen
  → reservation released

Approved
  → amount permanently committed

To Be Paid
  → remains committed

Paid
  → remains committed
```

Therefore:

  Claim state   Budget effect
  ------------- -----------------------
  Pending       No reservation
  In Progress   Reserved
  Frozen        Reservation released
  Rejected      Reservation released
  Approved      Permanently committed
  To Be Paid    Remains committed
  Paid          Remains committed

Payment does not create another budget deduction.

## Insufficient budget

The client chose:

> **Warn + allow Super Admin override.**

The UI must clearly explain the warning and the override must be
intentional/auditable.

------------------------------------------------------------------------

# 7. Invoice Business Meaning

An invoice is:

> **Remedy's consolidated vendor invoice to the organization/company.**

It is not a clinic invoice and not an employee invoice.

The organization pays Remedy. Remedy then distributes the appropriate
claim amounts externally.

## Consolidation

Claims from multiple clinics belonging to the same organization can be
placed on one invoice.

Example:

``` text
Organization X

Clinic A: 3 claims
Clinic B: 5 claims
Clinic C: 2 claims

One consolidated Remedy invoice
```

------------------------------------------------------------------------

# 8. Invoice Claim Selection

This is a major client requirement.

If 20 approved claims exist and the Super Admin wants 8:

``` text
Select 8 → Generate Invoice
```

must work.

The client wants:

-   individual claim selection;
-   Select All eligible approved claims;
-   ability to remove an accidentally selected claim before
    finalization.

### Already invoiced claims

A claim already included in an invoice must:

-   not be silently eligible for another invoice;
-   be visibly marked where useful;
-   retain its invoice relationship;
-   be prevented from accidental duplicate invoicing.

The client specifically mentioned an invoiced marker/tag.

------------------------------------------------------------------------

# 9. Invoice Dates

Dates are **optional**.

Selection is the primary mechanism.

If a date filter is used, the client specified:

> use the **employee claim submission date**.

Do not use service date as the default billing basis.

Therefore:

``` text
Organization
+ eligible approved claims
+ optional date/filter
+ explicit selection
```

is the correct mental model.

A date range must not be required to generate an invoice.

------------------------------------------------------------------------

# 10. Invoice Lifecycle

Recommended business lifecycle:

``` text
Eligible Approved Claims
        ↓
Selected
        ↓
Draft Invoice
        ↓
Review
        ↓
Download / Issue / Send externally
        ↓
Awaiting Organization Payment
        ↓
Organization Payment Recorded
```

The client wants a draft first.

Before sending/releasing the invoice, the Super Admin should be able to
verify:

-   organization;
-   claims included;
-   total;
-   number of sessions;
-   invoice date.

The client explicitly said clinic and employee names do not need to
appear on the invoice preview.

The invoice must be downloadable.

Automatic invoice email is not a core requirement; the client is
comfortable sending it externally.

------------------------------------------------------------------------

# 11. Organization Payment

The organization pays Remedy outside the system.

Super Admin then records/confirm payment.

The critical handoff is:

``` text
Invoice
   ↓
Organization payment confirmed
   ↓
Linked Approved claims → To Be Paid
```

The UI must immediately explain the result.

Example:

> **Organization payment recorded. 18 linked claims are now ready for
> clinic payout.**

Then provide:

**\[Review Payments\]**

------------------------------------------------------------------------

# 12. Partial Organization Payment

The client said partial payment should be treated as paid and other
communication handled outside the system.

The system should still preserve the actual financial information rather
than hiding the discrepancy.

Recommended representation:

``` text
Invoice total:   OMR 10,000
Amount received: OMR 8,000
Status:          Paid
```

Notes/history should preserve the context.

------------------------------------------------------------------------

# 13. Clinic / Recipient Payout

After the organization pays:

``` text
Approved → To Be Paid
```

If an invoice contains 10 claims and the organization pays Remedy:

> all 10 become ready for payout.

If Remedy pays 9 externally:

``` text
9 → Paid
1 → To Be Paid
```

The whole group must not be marked Paid.

Payment completion is **claim-level**.

------------------------------------------------------------------------

# 14. Payments Is Not a Bank Transfer Interface

The client explicitly said the system does not perform the actual
payment.

The Payments workspace should therefore answer:

> **Who needs to be paid, how much, what information do we have, and
> what has already been recorded as paid?**

It should show:

-   organization;
-   clinic;
-   employee/recipient;
-   claim/reference;
-   amount;
-   bank account/name;
-   related invoice/reference;
-   payment status;
-   payment date;
-   payment reference;
-   warnings/problems.

The client selected all of these information categories.

------------------------------------------------------------------------

# 15. Payments Grouping

If five claims belong to one clinic, the client wants **both**:

-   clinic-level combined view;
-   individual claim-level view.

Example:

``` text
ABC Clinic
5 claims
OMR 850 total

Claim 001  OMR 100
Claim 002  OMR 150
Claim 003  OMR 200
Claim 004  OMR 250
Claim 005  OMR 150
```

This supports operational review without removing individual control.

------------------------------------------------------------------------

# 16. External Payment Recording

The safe workflow is:

``` text
To Be Paid
    ↓
Review recipient + bank + amount
    ↓
Send money outside RemedyGCC
    ↓
Return to system
    ↓
Record payment
    ↓
Paid
```

The payment-recording UI should capture:

-   payment date;
-   amount;
-   bank/payment reference;
-   payment method;
-   notes.

It should explicitly state:

> **Payment is completed outside RemedyGCC. Record it here after it has
> been sent.**

------------------------------------------------------------------------

# 17. Bank Details

## Employee claim creation

If bank details exist from signup:

``` text
Claim creation
  ↓
Bank details prefilled
  ↓
Employee reviews/changes if needed
  ↓
Submit
```

If they do not exist:

``` text
Claim creation
  ↓
Bank details required
  ↓
Cannot submit without them
```

## Claim-level snapshot

The bank details used for a claim must be stored with that claim.

If the employee later changes profile bank details, an existing claim
must retain the original claim-level details.

This prevents historical payout destinations from silently changing.

------------------------------------------------------------------------

# 18. Missing Bank Details

If one claim is missing/incorrect but others are ready:

``` text
Claim A → ready
Claim B → ready
Claim C → blocked/problem
Claim D → ready
```

C should be blocked/flagged, but A/B/D should continue.

The client expects Remedy staff to contact the person and obtain the
correct information externally.

------------------------------------------------------------------------

# 19. Duplicate Payment Safety

The client chose:

> allow another payment action with a strong warning.

This should be implemented as a controlled override, not a normal
action.

Example:

``` text
⚠ This claim is already marked Paid.

Recording another payment may represent a duplicate payment.

Reason:
[________________]

[Cancel] [Continue]
```

The override should be:

-   visually dangerous;
-   explicitly confirmed;
-   reason-based;
-   audited.

------------------------------------------------------------------------

# 20. Financial Traceability

The client explicitly wants long-term traceability.

For a claim, six months later, the Super Admin should be able to
understand:

-   submission;
-   approval;
-   invoice relationship;
-   organization payment;
-   clinic/recipient payout;
-   payment reference.

For an invoice:

-   organization;
-   total;
-   claims included;
-   organization payment;
-   payment/reference information.

For a payment:

-   clinic;
-   claims;
-   amount;
-   bank/payment reference;
-   related invoice.

The required conceptual chain is:

``` text
Claim
  ↓
Invoice
  ↓
Organization Payment
  ↓
Clinic Payment
```

------------------------------------------------------------------------

# 21. Financial Timeline

A useful claim timeline is:

``` text
Claim Submitted
      ↓
Tenant Review Started
      ↓
Approved
      ↓
Added to Invoice INV-XXXX
      ↓
Invoice Issued
      ↓
Organization Payment Recorded
      ↓
Ready for Clinic Payout
      ↓
External Payment Recorded
      ↓
Paid
```

Each event should answer:

-   What happened?
-   When?
-   Who caused it?
-   What record is connected?

------------------------------------------------------------------------

# 22. Two-Section Super Admin UX

The final primary financial navigation should be:

``` text
Claims
Payments
```

This does **not** mean deleting the Invoice domain.

Invoices remain first-class business records but become part of the
guided billing workflow and remain accessible through related
records/history.

## Claims

Answers:

> **What claims exist, which are approved, what is ready for invoicing,
> and what needs attention?**

Can contain:

-   claims;
-   filters;
-   approved queue;
-   invoiced marker;
-   invoice initiation;
-   financial timeline;
-   invoice/payment relationships;
-   exceptions;
-   bulk selection.

## Payments

Answers:

> **What is ready for payout, what information is needed, and what has
> been paid?**

Can contain:

-   payout-ready claims;
-   clinic grouping;
-   bank details;
-   payment recording;
-   payment history;
-   reports/exports;
-   exceptions;
-   traceability.

------------------------------------------------------------------------

# 23. Guided Workflow Without Losing Power

Do **not** build a restrictive wizard that forces the Super Admin
through a linear path.

Instead build a **guided workspace**.

Example:

``` text
CLAIMS

24 approved claims ready for invoicing
OMR 4,850

[Review & Create Invoice]
```

The Super Admin can still:

-   search;
-   filter;
-   open a specific claim;
-   view history;
-   select a subset;
-   handle exceptions;
-   navigate directly.

The wizard is the **default path**, not a permission boundary.

------------------------------------------------------------------------

# 24. Recommended Guided Journey

### Step 1 --- Approved claims

Show:

> 24 approved claims ready for invoicing.

Actions:

-   Review.
-   Filter.
-   Select.
-   Select All.
-   Create invoice.

### Step 2 --- Invoice review

Show:

-   organization;
-   selected claims;
-   count;
-   total;
-   sessions;
-   invoice date;
-   remove claim;
-   generate draft.

### Step 3 --- Invoice

Show:

> Draft invoice created.

Actions:

-   Review.
-   Download PDF.
-   Issue/send externally.
-   Later record organization payment.

### Step 4 --- Organization payment

After confirmation:

> Payment recorded. 24 claims are now ready for clinic payout.

**\[Review Payments\]**

### Step 5 --- Payment preparation

Show:

-   clinic;
-   employee/recipient;
-   bank details;
-   amount;
-   claim reference;
-   invoice reference;
-   warnings.

### Step 6 --- External payout

Super Admin sends money externally.

Then:

**\[Record Payment\]**

### Step 7 --- Completion

Claim becomes Paid.

Show:

> **Financial process complete.**

------------------------------------------------------------------------

# 25. Bulk Operations Are a Core Capability

Bulk operations must reduce repetitive work without weakening financial
controls.

The general model:

``` text
Select
  ↓
Determine valid actions
  ↓
Show only safe actions
  ↓
Confirm
  ↓
Execute
  ↓
Summarize result
  ↓
Show next step
```

Every bulk operation must explain:

-   what will change;
-   which records are included;
-   which are excluded;
-   what happens next.

------------------------------------------------------------------------

# 26. Bulk Approved Claims

For:

``` text
15 Approved claims
```

valid actions may include:

-   Create Invoice.
-   Export.
-   Send Update where applicable.
-   Clear Selection.

Do not show:

-   Mark Paid.
-   Direct payout.
-   Tenant approval actions.

------------------------------------------------------------------------

# 27. Bulk To Be Paid Claims

For:

``` text
8 To Be Paid claims
```

valid actions may include:

-   Prepare/export payment information.
-   Record payment where business-safe.
-   Export.
-   Send Update where applicable.

Do not show:

-   Create Invoice.
-   Approve.
-   Reject.
-   Freeze.

------------------------------------------------------------------------

# 28. Mixed Selection

Example:

``` text
5 Approved
3 To Be Paid
2 Paid
```

Do not create a dangerous combined action.

Instead:

> **10 selected · 3 financial stages**

Only universally valid actions should remain, such as Export/View.

If an action is unavailable:

> "Invoice creation is available only for selected Approved claims."

This replaces the old confusing behavior where multiple financial states
could produce a combined "Queue Payment & Mark Paid" style action.

------------------------------------------------------------------------

# 29. Bulk Invoice Creation

Required flow:

``` text
Choose organization
      ↓
Filter eligible Approved claims
      ↓
Select individual OR Select All
      ↓
Review
      ↓
Remove unwanted claims
      ↓
Create consolidated invoice
```

The result should clearly show:

``` text
24 claims
OMR 4,850
Organization X
```

------------------------------------------------------------------------

# 30. Bulk Payment Preparation

Because actual payment is external, bulk payment should primarily
prepare information.

Example:

``` text
20 To Be Paid claims
8 clinics
OMR 4,850

[Generate Payment Report]
```

The report is used by Remedy staff to make external payments.

Do not invent a bank-transfer batch unless a real payment integration is
later approved.

------------------------------------------------------------------------

# 31. Bulk Does Not Replace Individual Control

The client wants individual claim control.

Therefore:

-   bulk accelerates repeated work;
-   individual actions remain available;
-   exceptions are handled individually;
-   one bad claim does not block unrelated claims;
-   selected claims can be removed;
-   financial actions require clear confirmation.

------------------------------------------------------------------------

# 32. Guidance / Toast Contract

Every important action must answer:

> **What just happened? Why? What next?**

Examples:

### Draft created

> **Draft invoice INV-104 created.**\
> 18 approved claims included.\
> **\[Review Invoice\]**

### Invoice issued

> **Invoice INV-104 issued.**\
> Waiting for organization payment.

### Organization payment recorded

> **Payment recorded.**\
> 18 linked claims are now ready for clinic payout.\
> **\[Review Payments\]**

### Payments recorded

> **7 claims marked Paid.**\
> 2 claims remain waiting because bank details need attention.

------------------------------------------------------------------------

# 33. Exceptions Required for Completeness

The system must intentionally handle:

1.  Missing bank details.
2.  Incorrect bank details.
3.  Already invoiced claim.
4.  Duplicate invoice selection.
5.  Invoice already issued.
6.  Invoice already paid.
7.  Partial organization payment.
8.  Organization payment recorded incorrectly.
9.  One payout completed while another remains waiting.
10. Missing payment reference.
11. Duplicate payment attempt.
12. Over-budget claim.
13. Frozen claim.
14. Rejected claim.
15. Correction after approval.
16. Correction after invoicing.
17. Claim already linked to invoice.
18. External payment failed/delayed.
19. Historical lookup.
20. Mixed-status bulk selection.

Every exception should answer:

``` text
What happened?
Why can't I proceed?
What can I do?
Who needs to act?
What happens if I continue?
```

------------------------------------------------------------------------

# 34. Filtering and Search

Super Admin needs operational filtering.

Useful filters:

-   Organization.
-   Clinic.
-   Claim status.
-   Financial stage.
-   Invoice status.
-   Payment status.
-   Submission date.
-   Invoice date.
-   Payment date.
-   Invoiced / not invoiced.
-   Paid / unpaid.
-   Bank details complete / missing.
-   Aging.
-   Amount range.
-   Claim reference.
-   Invoice number.
-   Payment reference.
-   Employee/recipient where appropriate.

Search should support:

-   claim/reference number;
-   invoice number;
-   payment reference;
-   employee/recipient;
-   clinic;
-   organization.

The core interaction should be:

``` text
Filter → Select → Action
```

------------------------------------------------------------------------

# 35. Aging

Aging should surface operational delays.

Useful context:

-   days since approval;
-   days since invoice issued;
-   days since payment became ready;
-   days in To Be Paid.

Do not show every metric everywhere. Show the one relevant to the
current stage.

------------------------------------------------------------------------

# 36. Reporting / Export

Useful exports include:

## Invoice report

-   invoice;
-   organization;
-   claims;
-   amounts;
-   status.

## Payment report

-   clinic;
-   employee/recipient;
-   claim reference;
-   amount;
-   bank information;
-   invoice reference;
-   payment status;
-   payment reference.

## History

-   paid claims;
-   invoice history;
-   payment history;
-   budget history.

These reports support the external financial process.

------------------------------------------------------------------------

# 37. Notifications

Existing notification infrastructure covers important claim events.

Financial workflow should provide appropriate notification after payment
recording.

The client expects employee/clinic notification and email after payment
is recorded.

Exact recipients must follow the existing notification architecture.

------------------------------------------------------------------------

# 38. Chat / Requests Boundary

Chat and Requests are separate concerns.

The Aug 16 meeting recorded:

-   Requests as a separate tab.
-   Chat as a separate tab.
-   WebSockets for real-time chat.

Do not mix Chat/Requests into the financial state machine.

Financial workflow may link to communication where useful, but financial
state and communication state remain separate.

------------------------------------------------------------------------

# 39. Historical / Older Plans That Must Not Override Current Decisions

Earlier audits proposed a three-workspace model:

``` text
Claims
Payments
Invoices
```

with strict separation:

-   Claims = service/approval.
-   Invoices = receivables.
-   Payments = clinic payout.

That domain separation is still useful architecturally.

However, the **latest UI direction** is two primary sections:

``` text
Claims
Payments
```

Therefore:

> Keep domain separation in the data/business model; simplify the
> navigation and mental model.

Other older proposals that should not automatically be implemented:

-   bank API integration;
-   automatic bank reconciliation;
-   actual bank transfer;
-   mandatory service-date invoice matching;
-   mandatory invoice date range;
-   automatic invoice email as a core requirement;
-   direct Claims-page payout shortcuts;
-   Super Admin approve/reject/freeze powers;
-   Pending budget reservation;
-   a restrictive wizard;
-   a third primary Invoice section simply because Invoice is a data
    domain.

------------------------------------------------------------------------

# 40. Implementation Plan

## Phase 0 --- Truth / Architecture Lock

Create one authoritative specification covering:

-   states;
-   roles;
-   invoice lifecycle;
-   payment lifecycle;
-   budget;
-   bank details;
-   relationships;
-   notifications;
-   exceptions;
-   bulk behavior.

No UI polishing until this is stable.

## Phase 1 --- Current-System Audit

Audit backend, frontend, APIs, data, permissions and tests against the
canonical workflow.

For every requirement:

``` text
Requirement
→ Current implementation
→ Match / Partial / Missing / Contradiction
→ File/location
→ Required change
→ Risk
```

Do not assume a feature is missing before inspecting the implementation.

## Phase 2 --- State-Machine Compliance

-   Remove invalid actions.
-   Prevent Approved → Paid.
-   Keep Tenant-only review actions.
-   Make bulk actions state-aware.
-   Handle mixed selections safely.

## Phase 3 --- Claims Workspace

-   Approved claims clearly ready for invoicing.
-   Invoiced marker.
-   Invoice linkage.
-   Financial stage.
-   Aging.
-   Organization/clinic.
-   Selection.
-   Select All.
-   Invoice initiation.
-   Financial timeline.
-   Exceptions.

Claims must not directly pay claims.

## Phase 4 --- Guided Invoice Workflow

-   Select eligible approved claims.
-   Optional date/filter.
-   Review.
-   Remove claims.
-   Generate draft.
-   Download.
-   Issue/send externally.
-   Await payment.

## Phase 5 --- Organization Payment Handoff

Record payment and immediately release linked claims:

``` text
Approved → To Be Paid
```

Show count and amount and provide the next action.

## Phase 6 --- Payments Workspace

Redesign around:

> What needs to be paid externally and what has been recorded as paid?

Include clinic grouping, claim detail, bank details, invoice references,
payment recording and history.

## Phase 7 --- Bulk Operations

Build reusable selection/action behavior.

Focus first on:

-   bulk invoice selection/creation;
-   bulk payment preparation/reporting;
-   safe state-aware actions.

## Phase 8 --- Exceptions

Implement and test every major exception.

## Phase 9 --- Traceability

Ensure:

``` text
Claim ↔ Invoice ↔ Organization Payment ↔ Clinic Payment
```

is navigable and visible.

## Phase 10 --- Guided Super Admin UX

Add:

-   next-action banners;
-   workflow summaries;
-   contextual CTAs;
-   warnings;
-   confirmations;
-   toasts;
-   empty states;
-   progress indicators.

## Phase 11 --- Two-Section Simplification

Make Claims + Payments the primary experience.

Invoice remains a first-class domain/workflow record.

## Phase 12 --- Final Audit

Verify clarity, actionability, safety, traceability, recovery, and
efficiency.

------------------------------------------------------------------------

# 41. Testing Strategy

## Backend

Test:

-   state transitions;
-   permission boundaries;
-   invoice selection;
-   duplicate invoice prevention;
-   invoice payment;
-   Approved → To Be Paid;
-   To Be Paid → Paid;
-   budget;
-   bank snapshot;
-   payment recording;
-   notifications;
-   audit/history.

## Frontend

Test:

-   dynamic actions;
-   bulk selection;
-   mixed states;
-   invoice creation;
-   invoice review;
-   download;
-   payment recording;
-   warnings;
-   empty/loading/error states;
-   toasts;
-   navigation.

## End-to-end

The critical scenario is:

``` text
Employee submits
→ Tenant reviews
→ Tenant approves
→ Super Admin selects claims
→ Invoice generated
→ Invoice reviewed/downloaded
→ Organization pays externally
→ Payment recorded
→ Claims become To Be Paid
→ Payment information reviewed
→ External payout made
→ Payout recorded
→ Claim becomes Paid
→ Notification sent
→ Full history visible
```

------------------------------------------------------------------------

# 42. Non-Negotiable Rules

1.  Business truth beats existing UI.
2.  Backend state machine is authoritative.
3.  Super Admin does not become Tenant Admin accidentally.
4.  No normal Approved → Paid shortcut.
5.  Organization payment precedes normal clinic payout.
6.  Actual money transfer is external.
7.  Invoice selection is explicit.
8.  Already invoiced claims cannot be silently invoiced again.
9.  One organization can have one consolidated invoice containing claims
    from multiple clinics.
10. Bank details are required at claim submission.
11. Claim bank details are a historical snapshot.
12. One problematic claim does not block unrelated valid claims.
13. Approved, To Be Paid and Paid remain financially committed.
14. In Progress reserves budget.
15. Pending does not reserve budget.
16. Rejected/Frozen release reservation.
17. Over-budget situations warn and allow authorized Super Admin
    override.
18. Bulk actions are state-aware.
19. Mixed selections cannot create dangerous combined actions.
20. Every important action explains what happened, why, and what comes
    next.
21. Simplification must not remove Super Admin power.
22. Two primary UI sections does not mean deleting Invoice data.
23. Historical traceability is mandatory.
24. No fake bank integration.
25. Do not reopen settled requirements without new client evidence.

------------------------------------------------------------------------

# 43. Canonical End-to-End Truth Table

  ------------------------------------------------------------------------------------------
  Step        Actor          Input       Action                  Result       Financial
                                                                              effect
  ----------- -------------- ----------- ----------------------- ------------ --------------
  1           Employee       New         Submit                  Pending      No reservation

  2           Tenant         Pending     Start review            In Progress  Amount
                                                                              reserved

  3           Tenant         In Progress Approve                 Approved     Amount
                                                                              committed

  4           Super Admin    Approved    Select for invoice      Eligible     No claim-state
                                                                 selection    change

  5           Super Admin    Selected    Generate                Draft        Invoice
                             claims                              invoice      created

  6           Super Admin    Draft       Review/download/issue   Issued       Organization
                                                                              owes Remedy

  7           Organization   Issued      Pay externally          Payment      Recorded
                                                                 received     manually

  8           Super Admin    Payment     Confirm/mark invoice    Claims → To  Budget
                             received    paid                    Be Paid      unchanged

  9           Super Admin    To Be Paid  Review payout           Ready        Budget
                                                                 externally   unchanged

  10          Remedy         To Be Paid  Pay externally          External     Budget
                                                                 payment      unchanged
                                                                 completed    

  11          Super Admin    To Be Paid  Record payment          Paid         Budget
                                                                              unchanged

  12          System         Paid        Notify                  Financial    No budget
                                                                 completion   change
  ------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 44. Definition of Done

The Super Admin rebuild is not done because the pages look polished.

It is done when:

-   the business workflow is unambiguous;
-   permissions are correct;
-   state machine is enforced;
-   Approved claims cannot bypass invoicing;
-   invoice selection is explicit and safe;
-   duplicate invoicing is prevented;
-   organization payment clearly releases claims;
-   Payments clearly represents external payout recording;
-   bank details are correct and claim-specific;
-   one bad claim does not block others;
-   budget behavior matches the client's rules;
-   bulk operations are safe and useful;
-   mixed selections are handled;
-   every important action has clear feedback;
-   Claim → Invoice → Organization Payment → Clinic Payment is
    traceable;
-   history is available;
-   the Super Admin has a guided normal path;
-   direct operational control remains available;
-   Claims and Payments are the primary financial sections;
-   there are no fake banking assumptions;
-   end-to-end tests prove the workflow.

------------------------------------------------------------------------

# 45. Final Product Mental Model

The cleanest mental model is:

``` text
                    SUPER ADMIN

                       CLAIMS
                         │
                  "What can I bill?"
                         │
                         ▼
                Select approved claims
                         │
                         ▼
                  Create invoice
                         │
                         ▼
                Organization pays
                         │
                         ▼
                      PAYMENTS
                         │
                 "What can I pay?"
                         │
                         ▼
                Review bank details
                         │
                         ▼
                Pay externally
                         │
                         ▼
                 Record payment
                         │
                         ▼
                       PAID
```

The Super Admin should not need to understand database structures or
technical state transitions to operate the product.

------------------------------------------------------------------------

# 46. Final Product Goal

The objective is **not** merely to make Claims, Payments and Invoices
look nicer.

The objective is:

> **Build a complete, trustworthy Super Admin financial operations
> workflow that is simple enough to understand immediately, powerful
> enough for real operational work, safe enough for financial actions,
> and traceable enough that six months later every claim can be
> explained from submission to final payout.**

The priorities are:

1.  **Correctness**
2.  **Completeness**
3.  **Traceability**
4.  **Efficiency**
5.  **Simplicity**

------------------------------------------------------------------------

# 47. Source / Evidence Basis

This context was consolidated from:

-   `reword.md` --- original client requirements.
-   Claims/Invoices/Payments workflow audits.
-   Super Admin UX/product audit and redesign plans.
-   Budget and invoice clarification work.
-   `RemedyGCC_Final_Client_Architecture_Questions.docx` and the
    client's completed answers.
-   Aug 16, 2026 client meeting notes.
-   Later implementation verification notes.

When a later explicit client clarification conflicts with an older
proposal or implementation plan, the later client clarification takes
precedence.

When an older audit proposes functionality that the client never
confirmed, it is treated as a proposal rather than a requirement.

------------------------------------------------------------------------

# 48. One-Sentence Context Snapshot

**Tenant approves claims → Remedy selects approved claims for a
consolidated organization invoice → organization pays Remedy → linked
claims become To Be Paid → Remedy pays recipients externally → Super
Admin records those payments → claims become Paid, with a guided
two-section Super Admin UX and safe bulk operations layered over the
underlying Claims/Invoice/Payment domains.**
