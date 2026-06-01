---
name: EJN OData URL building
description: How to correctly build OData query URLs for open.ejn.gov.ba to avoid timeouts and errors
---

## Rule
Build EJN OData URLs manually — never use `encodeURIComponent` on OData filter/select values, and never use `URLSearchParams`. Use literal `$` for parameter names. Encode spaces as `%20` and single quotes as `%27` in filter/select values only.

**Why:** The EJN API accepts both literal `$` and `%24` for OData param names, but fully encoding filter values (e.g. `%28`, `%29`, `%2C` for `(`, `)`, `,`) causes the API to time out. Node.js `fetch` also rejects URLs with literal unencoded spaces, so spaces must be `%20`.

**How to apply:**
```typescript
const qs = (s: string) => s.replace(/ /g, "%20").replace(/'/g, "%27");
const url = `${EJN_BASE}/Lots?$top=${top}&$format=json&$select=${LOT_SELECT}&$filter=${qs(filter)}`;
```
- `$orderby=LastUpdated%20desc` — space encoded, `$` literal
- Never use `encodeURIComponent(filter)` — only `qs(filter)`
- Do NOT add `$orderby` with complex filters — it causes full table scans and timeouts
- Set AbortSignal.timeout to 30000ms minimum (EJN is slow on complex filters)

## Correct endpoint
Use `Lots` (not `Announcements` which doesn't exist, not `AnnouncementProcedureCalls` which is minimal).
- Rich fields: `Id,ProcedureId,ProcedureName,ContractingAuthorityName,ContractingAuthorityCityName,ContractingAuthorityAdministrativeUnitName,EstimatedValue,Status,ProcurementPhaseOfferSubmissionDeadline,ApplicationDeadlineDateTime,IsAuctionOnline,AwardCriterion,ContractCategoryName,ContractType,ShortDescription,LastUpdated`
- External ID format: `EJN-LOT-{Id}`
- Offer deadline: `ProcurementPhaseOfferSubmissionDeadline`
- Questions deadline: `ApplicationDeadlineDateTime`
- Status values: `Announced` → open, `Awarded` → closed, `Cancelled`/`Terminated` → cancelled

## Insurance filter (minimal, performant)
```
contains(tolower(ProcedureName),'osiguranj') or contains(tolower(ProcedureName),'kasko') or contains(tolower(ProcedureName),'insurance') or contains(tolower(ContractCategoryName),'osiguranj')
```
Keep to ≤4 OR conditions to avoid timeouts.
