import { model } from "@medusajs/framework/utils"

const Review = model.define("review", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  customer_id: model.text(),
  order_id: model.text(),
  rating: model.number(),
  title: model.text().nullable(),
  content: model.text(),
  first_name: model.text(),
  last_name: model.text(),
  customer_email: model.text(),
  status: model.enum(["pending", "approved", "rejected"]).default("pending"),
  verified_purchase: model.boolean().default(true),
})

export default Review