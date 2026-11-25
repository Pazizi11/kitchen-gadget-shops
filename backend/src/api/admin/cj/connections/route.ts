import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cj } from "../../../../integrations/cj/client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pid = req.query.pid as string | undefined
  const vid = req.query.vid as string | undefined

  const connections = await cj.getConnections({
    pid,
    vid,
  })

  res.json(connections)
}