import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { syncVariantInventory } from "../../../../integrations/cj/service"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const body = (req.body || {}) as any

  const variantIds =
    Array.isArray(body.variantIds)
      ? body.variantIds.map(String)
      : undefined

  const cjVids =
    Array.isArray(body.cjVids)
      ? body.cjVids.map(String)
      : undefined

  const result =
    await syncVariantInventory(
      req.scope,
      variantIds,
      cjVids
    )

  res.json(result)
}