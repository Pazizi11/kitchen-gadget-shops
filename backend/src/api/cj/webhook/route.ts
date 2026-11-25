import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { cj, parseCjUsSellableQuantity, verifyCjWebhookSignature } from "../../../integrations/cj/client"

function rawBodyFromRequest(req: any) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString("utf8")
  if (typeof req.rawBody === "string") return req.rawBody
  return JSON.stringify(req.body || {})
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const rawBody = rawBodyFromRequest(req)
  const signature = req.headers.sign as string | undefined

  if (process.env.CJ_WEBHOOK_VERIFY_SIGNATURE !== "false" && !verifyCjWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ ok: false, message: "Invalid CJ webhook signature" })
  }

  const payload = (req.body || {}) as any
  const type = String(payload.type || "")
  const params = payload.params || {}
  const messageId = String(payload.messageId || "")
  logger.info(`CJ webhook received: ${type}/${payload.messageType || ""} ${messageId}`)

  // Stock webhook: use CJ-managed warehouse inventory, not storage/factory inventory.
  if (type === "STOCK") {
    const inventoryModule = req.scope.resolve(Modules.INVENTORY) as any
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const targetLocationId = "sloc_01M1HWXTD64F09GR5Y8T01ZYME"

    const { data: locations } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })

    const location = (locations || []).find(
      (entry: any) => entry?.id === targetLocationId
    )

    if (!location) {
      logger.warn(`CJ stock webhook skipped: required Medusa location ${targetLocationId} was not found`)
    } else {
      const { data: variants } = await query.graph({
        entity: "product_variant",
        fields: ["id", "metadata", "inventory_items.*"],
      })

      for (const entries of Object.values(params as Record<string, any[]>)) {
        for (const entry of entries || []) {
          const vid = String(entry?.vid || "")
          if (!vid) continue

          const variant = (variants || []).find(
            (v: any) => String(v?.metadata?.cj_vid || "") === vid
          )
          if (!variant) continue

          try {
            const stock = await cj.getStock(vid)
            const parsed = parseCjUsSellableQuantity(stock)

            if (!parsed.ok) {
              logger.warn(`CJ stock webhook skipped ${vid}; existing inventory preserved: ${parsed.reason}`)
              continue
            }

            let updatedLevels = 0

            const items = (variant.inventory_items || []).filter(Boolean) as any[]
            for (const item of items) {
              const inventoryItemId = item.inventory_item_id || item.id
              if (!inventoryItemId) continue

              try {
                const levels = await inventoryModule.listInventoryLevels({
                  inventory_item_id: inventoryItemId,
                  location_id: location.id,
                })

                if (!Array.isArray(levels)) {
                  logger.warn(`Inventory-level lookup returned an unexpected response for ${vid}; skipped`)
                  continue
                }

                const targetLevel = levels.find(
                  (level: any) => level?.location_id === location.id
                )

                if (!targetLevel) {
                  logger.warn(`CJ stock webhook found no existing target inventory level for ${vid}; skipped creation`)
                  continue
                }

                await inventoryModule.updateInventoryLevels({
                  inventory_item_id: inventoryItemId,
                  location_id: location.id,
                  stocked_quantity: parsed.quantity,
                })
                updatedLevels += 1
              } catch (error) {
                logger.warn(`Could not update inventory for CJ variant ${vid}: ${String(error)}`)
              }
            }

            if (updatedLevels > 0) {
              logger.info(`CJ stock webhook updated ${updatedLevels} inventory level(s) for ${vid} using ${parsed.quantity} US CJ-managed units`)
            } else {
              logger.warn(`CJ stock webhook validated ${vid} stock (${parsed.quantity}) but updated no inventory levels`)
            }
          } catch (error) {
            logger.warn(`Could not query CJ stock for variant ${vid}; existing inventory preserved: ${String(error)}`)
          }
        }
      }
    }
  }

  // Order and logistics webhooks update order metadata. We intentionally do not
  // create a second order in Medusa; the original Medusa order remains the source of truth.
  if (type === "ORDER" || type === "LOGISTIC") {
    const orderModule = req.scope.resolve(Modules.ORDER) as any
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const lookup = params.orderNumber || params.orderNum || (Array.isArray(params.storeOrderNumbers) ? params.storeOrderNumbers[0] : undefined)
    const cjOrderId = params.cjOrderId || params.orderId
    if (lookup || cjOrderId) {
      const { data: orders } = await query.graph({ entity: "order", fields: ["id", "display_id", "metadata"], filters: lookup ? { display_id: String(lookup) } : {} })
      const order = orders?.[0]
      if (order) {
        await orderModule.updateOrders(order.id, {
          metadata: {
            ...(order.metadata || {}),
            cj_order_id: cjOrderId || order.metadata?.cj_order_id,
            cj_order_status: params.orderStatus || params.trackingStatus || order.metadata?.cj_order_status,
            cj_tracking_number: params.trackNumber || params.trackingNumber || order.metadata?.cj_tracking_number,
            cj_tracking_url: params.trackingUrl || order.metadata?.cj_tracking_url,
            cj_tracking_provider: params.trackingProvider || order.metadata?.cj_tracking_provider,
            cj_logistic_name: params.logisticName || order.metadata?.cj_logistic_name,
            cj_last_webhook_message_id: messageId || order.metadata?.cj_last_webhook_message_id,
            cj_last_webhook_at: new Date().toISOString(),
          },
        })
      }
    }
  }

  // CJ requires a 200 response quickly. Processing above is deliberately lightweight.
  return res.status(200).json({ ok: true })
}
