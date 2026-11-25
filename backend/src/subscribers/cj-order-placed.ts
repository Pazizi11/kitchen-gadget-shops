import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CJ_FULFILLMENT_MODULE } from "../modules/cj-fulfillment"

export default async function cjOrderPlacedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillment = container.resolve(CJ_FULFILLMENT_MODULE) as any
  const orderId = event.data.id

  try {
    const existing = await fulfillment.listCjFulfillmentJobs({
      order_id: orderId,
    })

    if (existing.length > 0) {
      logger.info(
        `CJ fulfilment queue already contains order ${orderId}; no duplicate created.`
      )
      return
    }

    await fulfillment.createCjFulfillmentJobs({
      order_id: orderId,
      payment_status: "pending",
      status: "pending",
      reconciliation_note:
        "Created from order.placed; awaiting independent payment verification.",
    })

    logger.info(
      `Created pending CJ fulfilment queue record for order ${orderId}. Payment has not yet been verified.`
    )
  } catch (error) {
    logger.error(
      `Failed to queue Medusa order ${orderId} for CJ fulfilment review.`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
