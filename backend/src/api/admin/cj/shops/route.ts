import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cj } from "../../../../integrations/cj/client"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const shops = await cj.getShops()

  res.json(shops)
}