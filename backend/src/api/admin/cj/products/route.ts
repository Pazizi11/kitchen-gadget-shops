import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { syncCjProducts } from "../../../../integrations/cj/service"

import { cj } from "../../../../integrations/cj/client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pid = req.query.pid as string | undefined

  /*
   * If a CJ PID is supplied, return the complete
   * CJ product detail instead of the product list.
   */
  if (pid) {
    const result = await cj.getProduct(String(pid))
    return res.json(result)
  }

  const page = Number(req.query.page || 1)

  const size = Number(req.query.size || 20)

  const keyWord = req.query.keyWord as string | undefined

  const result = await cj.listProducts({
    page,
    size,
    keyWord,
  })

  return res.json(result)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as any

  const result = await syncCjProducts(req.scope, {
    pid: body.pid || (req.query.pid as string | undefined),
    keyword: body.keyword || (req.query.keyword as string | undefined),
    pageSize: Number(body.pageSize || req.query.pageSize || 20),
    maxProducts: Number(body.maxProducts || req.query.maxProducts || 20),
  })

  res.json(result)
}
