---
name: EJN v2 integration
description: Key decisions and gotchas for the EJN realtime integration upgrade
---

**Endpoint choice:** The EJN Open Data API has two main endpoints:
- `AnnouncementProcedureCalls` — minimal fields (used originally), no EstimatedValue/DeadlineDate/CpvCode/HasEAuction
- `Announcements` — richer fields, used from v2 onwards

**Why:** The Announcements endpoint has DeadlineDate, QuestionsDeadline, EstimatedValue, CurrencyCode, CpvCode, HasEAuction, AwardCriteria, RequiredGuaranteeAmount etc. which are essential for full tender analysis.

**New DB columns on tendersTable:** questionsDeadline, statusName, hasEAuction, awardCriteria, awardCriteriaDetails, guaranteeAmount, guaranteeType, tenderPreparationCost
**New DB table:** tenderChangesTable — tracks field-level changes detected by hourly cron sync on active tenders.
**New aiAnalysisTable columns:** participationConditions (jsonb), requiredDeclarations (jsonb), awardAnalysis, guaranteeInfo, estimatedPrepTime

**Cron jobs added to server index:**
- Every 2h: full EJN scrape for new tenders
- Every 1h: sync active tenders for changes (detectAndSaveChanges)
- Daily 8:00: send deadline reminders for tenders expiring within 3 days

**How to apply:** When changing ejnScraper, always update both the main scrape path (new tenders) AND the sync path (detectAndSaveChanges) to track the same fields.
