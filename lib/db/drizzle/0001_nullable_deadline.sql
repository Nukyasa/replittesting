-- A missing portal deadline must remain unknown, not the publication date.
ALTER TABLE "tenders" ALTER COLUMN "deadline" DROP NOT NULL;
-- Preserve records, but exclude goods/works (e.g. railway signal equipment) from insurance services.
UPDATE "tenders" SET "category" = 'Drugo', "updated_at" = now()
WHERE "source" IN ('ejn', 'ejn_openapi') AND "category" = 'Osiguranje'
AND "raw_data"->'announcement'->>'ContractType' IN ('Goods', 'Works');
