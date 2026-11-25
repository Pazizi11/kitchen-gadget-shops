import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cj } from "../../../../integrations/cj/client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const vid = req.query.vid as string | undefined

  if (!vid) {
    return res.status(400).json({
      message: "vid is required",
    })
  }

  const variant = await cj.getVariant(vid)

  res.json(variant)
}