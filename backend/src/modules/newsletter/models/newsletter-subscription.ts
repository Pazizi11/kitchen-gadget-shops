import { model } from "@medusajs/framework/utils"

const NewsletterSubscription = model.define("newsletter_subscription", {
  id: model.id().primaryKey(),
  email: model.text().unique(),
  status: model.enum(["subscribed", "unsubscribed"]).default("subscribed"),
  unsubscribe_token_hash: model.text(),
  welcome_email_status: model.enum(["pending", "disabled", "sent", "failed"]).default("pending"),
  welcome_email_sent_at: model.dateTime().nullable(),
  unsubscribed_at: model.dateTime().nullable(),
})

export default NewsletterSubscription
