import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cj } from "../../../../integrations/cj/client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pid = req.query.pid as string | undefined

  if (!pid) {
    return res.status(400).json({
      message: "pid is required",
    })
  }

  const product = await cj.getProduct(pid)

  res.json(product)
}