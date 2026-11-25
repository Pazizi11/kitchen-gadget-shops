import { model } from "@medusajs/framework/utils"

const CjFulfillmentJob = model.define("cj_fulfillment_job", {
  id: model.id().primaryKey(),

  order_id: model.text().unique(),

  payment_status: model.enum([
    "pending",
    "verified",
    "held",
  ]).default("pending"),

  status: model.enum([
    "pending",
    "eligible",
    "processing",
    "submitted",
    "uncertain",
    "held",
    "failed",
  ]).default("pending"),

  payment_verified_at: model.dateTime().nullable(),

  processing_started_at: model.dateTime().nullable(),

  submitted_at: model.dateTime().nullable(),

  cj_order_id: model.text().nullable(),

  cj_order_number: model.text().nullable(),

  last_error: model.text().nullable(),

  reconciliation_note: model.text().nullable(),

  attempt_count: model.number().default(0),
})

export default CjFulfillmentJob
