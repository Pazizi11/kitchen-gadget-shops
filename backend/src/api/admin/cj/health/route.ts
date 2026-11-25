import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cj } from "../../../../integrations/cj/client"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const health = await cj.health()
  res.json({ ok: true, cj: health })
}
