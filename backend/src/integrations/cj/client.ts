import crypto from "node:crypto"

const CJ_BASE_URL =
  "https://developers.cjdropshipping.com/api2.0/v1"

type CjEnvelope<T> = {
  code?: number
  result?: boolean
  message?: string
  data?: T
  requestId?: string
  success?: boolean
}

type TokenState = {
  accessToken?: string
  refreshToken?: string
  accessTokenExpiryDate?: string
  refreshTokenExpiryDate?: string
  openId?: string
}

let tokenState: TokenState = {
  accessToken:
    process.env.CJ_ACCESS_TOKEN ||
    undefined,

  refreshToken:
    process.env.CJ_REFRESH_TOKEN ||
    undefined,

  accessTokenExpiryDate:
    process.env.CJ_ACCESS_TOKEN_EXPIRES_AT ||
    undefined,

  openId:
    process.env.CJ_OPEN_ID ||
    undefined,
}

function isExpired(date?: string) {
  if (!date) return false

  const expiresAt =
    new Date(date).getTime()

  return (
    Number.isFinite(expiresAt) &&
    expiresAt <= Date.now() + 60_000
  )
}

async function parseResponse<T>(
  response: Response
): Promise<T> {
  const text =
    await response.text()

  let payload: CjEnvelope<T>

  try {
    payload =
      JSON.parse(text) as CjEnvelope<T>
  } catch {
    throw new Error(
      `CJ API returned non-JSON response (${response.status})`
    )
  }

  if (
    !response.ok ||
    (
      payload.code !== undefined &&
      payload.code !== 200
    ) ||
    payload.result === false ||
    payload.success === false
  ) {
    throw new Error(
      `CJ API error ${
        payload.code ?? response.status
      }: ${
        payload.message ??
        "Unknown error"
      } (requestId: ${
        payload.requestId ??
        "n/a"
      })`
    )
  }

  return (
    payload.data ??
    payload
  ) as T
}

async function getFreshToken(): Promise<string> {
  if (
    tokenState.accessToken &&
    !isExpired(
      tokenState.accessTokenExpiryDate
    )
  ) {
    return tokenState.accessToken
  }

  if (tokenState.refreshToken) {
    const response =
      await fetch(
        `${CJ_BASE_URL}/authentication/refreshAccessToken`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            refreshToken:
              tokenState.refreshToken,
          }),
        }
      )

    try {
      const data =
        await parseResponse<TokenState>(
          response
        )

      tokenState = {
        ...tokenState,
        ...data,
      }

      return tokenState.accessToken!
    } catch {
      /*
       * Fall through to API-key
       * authorization if the refresh
       * token request fails.
       */
    }
  }

  const apiKey =
    process.env.CJ_API_KEY

  if (!apiKey) {
    throw new Error(
      "CJ_API_KEY is not configured"
    )
  }

  const response =
    await fetch(
      `${CJ_BASE_URL}/authentication/getAccessToken`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          apiKey,
        }),
      }
    )

  const data =
    await parseResponse<TokenState>(
      response
    )

  tokenState = {
    ...tokenState,
    ...data,
  }

  return tokenState.accessToken!
}

let cjRateLimitQueue:
  Promise<void> =
    Promise.resolve()

function waitForCjRateLimit(): Promise<void> {
  const previous =
    cjRateLimitQueue

  let release!: () => void

  cjRateLimitQueue =
    new Promise<void>(
      (resolve) => {
        release = resolve
      }
    )

  return previous.then(
    async () => {
      /*
       * CJ allows only 1 request per second.
       *
       * Wait 1.2 seconds between requests
       * to provide a small safety margin.
       */
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            1200
          )
      )

      release()
    }
  )
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
  networkRetries = 3
): Promise<T> {
  const token =
    await getFreshToken()

  const headers =
    new Headers(init.headers)

  headers.set(
    "CJ-Access-Token",
    token
  )

  headers.set(
    "Content-Type",
    "application/json"
  )

  if (
    process.env.CJ_PLATFORM_TOKEN
  ) {
    headers.set(
      "platformToken",
      process.env.CJ_PLATFORM_TOKEN
    )
  }

  /*
   * Always preserve the CJ rate-limit
   * protection, including retries.
   */
  await waitForCjRateLimit()

  try {
    const response =
      await fetch(
        `${CJ_BASE_URL}${path}`,
        {
          ...init,
          headers,
        }
      )

    /*
     * Preserve the existing behavior
     * for expired/invalid CJ access tokens.
     */
    if (
      retry &&
      response.status === 401
    ) {
      tokenState.accessToken =
        undefined

      return request<T>(
        path,
        init,
        false,
        networkRetries
      )
    }

    return await parseResponse<T>(
      response
    )
  } catch (error: any) {
    /*
     * Network-level errors happen before
     * an HTTP response is received.
     *
     * These include temporary connection
     * resets and timeouts.
     */
    const errorCode =
      error?.cause?.code ||
      error?.code

    const errorMessage =
      String(
        error?.message || ""
      ).toLowerCase()

    const isNetworkError =
      errorCode ===
        "ECONNRESET" ||
      errorCode ===
        "ECONNREFUSED" ||
      errorCode ===
        "ETIMEDOUT" ||
      errorCode ===
        "EAI_AGAIN" ||
      error?.name ===
        "TypeError" ||
      errorMessage.includes(
        "fetch failed"
      )

    /*
     * Retry temporary network errors
     * up to three times.
     */
    if (
      isNetworkError &&
      networkRetries > 0
    ) {
      const attempt =
        4 - networkRetries

      /*
       * Progressive delays:
       *
       * Retry 1 -> 3 seconds
       * Retry 2 -> 6 seconds
       * Retry 3 -> 9 seconds
       */
      const delay =
        attempt * 3000

      console.warn(
        `CJ network request failed for ${path} ` +
        `(${errorCode || "fetch failed"}). ` +
        `Retrying in ${delay / 1000}s... ` +
        `${networkRetries} retry attempt(s) remaining.`
      )

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            delay
          )
      )

      /*
       * Call request() again so the
       * normal CJ rate-limit protection
       * is applied to the retry as well.
       */
      return request<T>(
        path,
        init,
        retry,
        networkRetries - 1
      )
    }

    /*
     * If the retries are exhausted,
     * return the original error.
     */
    throw error
  }
}

export function getCjOpenId() {
  return (
    tokenState.openId ||
    process.env.CJ_OPEN_ID ||
    undefined
  )
}

export function verifyCjWebhookSignature(
  rawBody: string,
  signature: string | undefined
) {
  const openId =
    getCjOpenId()

  if (
    !openId ||
    !signature
  ) {
    return false
  }

  const expected =
    crypto
      .createHmac(
        "sha256",
        String(openId)
      )
      .update(
        rawBody,
        "utf8"
      )
      .digest("base64")

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  )
}

export type CjUsStockParseResult =
  | { ok: true; quantity: number }
  | { ok: false; reason: string }

export function parseCjUsSellableQuantity(
  value: any
): CjUsStockParseResult {
  let rows: any[] | null = null

  if (Array.isArray(value)) rows = value
  else if (Array.isArray(value?.list)) rows = value.list
  else if (Array.isArray(value?.content)) rows = value.content
  else if (Array.isArray(value?.data)) rows = value.data
  else if (Array.isArray(value?.inventory_levels)) rows = value.inventory_levels

  if (!rows) return { ok: false, reason: "unrecognized CJ stock response shape" }
  if (rows.length === 0) return { ok: false, reason: "CJ stock response contains no rows" }

  const usRows = rows.filter(
    (row: any) => String(row?.countryCode ?? "").trim().toUpperCase() === "US"
  )

  if (usRows.length === 0) return { ok: false, reason: "no US warehouse row" }
  if (usRows.length !== 1) return { ok: false, reason: "multiple US warehouse rows" }

  const rawQuantity = usRows[0]?.cjInventoryNum
  if (
    rawQuantity === undefined ||
    rawQuantity === null ||
    (typeof rawQuantity === "string" && rawQuantity.trim() === "")
  ) {
    return { ok: false, reason: "US cjInventoryNum is missing" }
  }

  if (typeof rawQuantity !== "number" && typeof rawQuantity !== "string") {
    return { ok: false, reason: "US cjInventoryNum must be a number or numeric string" }
  }

  const quantity = Number(rawQuantity)
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    return { ok: false, reason: "US cjInventoryNum must be a positive integer" }
  }

  return { ok: true, quantity }
}

export const cj = {
  async health() {
    const token =
      await getFreshToken()

    return {
      authenticated:
        Boolean(token),

      openId:
        getCjOpenId(),
    }
  },

  listProducts(
    params: Record<
      string,
      string | number | undefined
    > = {}
  ) {
    const query =
      new URLSearchParams()

    for (
      const [key, value]
      of Object.entries(params)
    ) {
      if (
        value !== undefined &&
        value !== ""
      ) {
        query.set(
          key,
          String(value)
        )
      }
    }

    return request<any>(
      `/product/listV2?${query.toString()}`
    )
  },

  getProduct(
    pid: string
  ) {
    return request<any>(
      `/product/query?pid=${encodeURIComponent(pid)}`
    )
  },

  getVariants(
    params: {
      pid?: string
      productSku?: string
      variantSku?: string
      countryCode?: string
    }
  ) {
    const query =
      new URLSearchParams()

    for (
      const [key, value]
      of Object.entries(params)
    ) {
      if (value) {
        query.set(
          key,
          value
        )
      }
    }

    return request<any>(
      `/product/variant/query?${query.toString()}`
    )
  },

  getVariant(
    vid: string
  ) {
    return request<any>(
      `/product/variant/queryByVid?vid=${encodeURIComponent(vid)}`
    )
  },

  getStock(
    vid: string
  ) {
    return request<any>(
      `/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`
    )
  },

  getWarehouseDetail(storageId: string) {
    return request<any>(
      `/warehouse/detail?id=${encodeURIComponent(storageId)}`
    )
  },

  freightCalculate(
    payload: Record<string, unknown>
  ) {
    return request<any>(
      "/logistic/freightCalculate",
      {
        method: "POST",

        body: JSON.stringify(
          payload
        ),
      }
    )
  },
freightCalculateTip(
  payload: Record<string, unknown>
) {
  return request<any>(
    "/logistic/freightCalculateTip",
    {
      method: "POST",
      body: JSON.stringify(
        payload
      ),
    }
  )
},

  getShops() {
    return request<any>(
      "/shop/getShops"
    )
  },

  getConnections(
    params: Record<
      string,
      string | number | undefined
    > = {}
  ) {
    const query =
      new URLSearchParams()

    for (
      const [key, value]
      of Object.entries(params)
    ) {
      if (
        value !== undefined &&
        value !== ""
      ) {
        query.set(
          key,
          String(value)
        )
      }
    }

    return request<any>(
      `/product/conn/connection?${query.toString()}`
    )
  },

  createOrderV3(
    payload: Record<
      string,
      unknown
    >
  ) {
    return request<any>(
      "/shopping/order/createOrderV3",
      {
        method: "POST",

        body: JSON.stringify(
          payload
        ),
      }
    )
  },

  queryPrivateInventoryByVariant(
    productId: string,
    variantId: string
  ) {
    return request<any>(
      "/product/stock/privateInventory/querySkuListByProductId",
      {
        method: "POST",

        body: JSON.stringify({
          productId,
          variantId,
        }),
      }
    )
  },

  getOrder(
    orderId: string
  ) {
    return request<any>(
      `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(orderId)}`
    )
  },

  getOrders(
    params: Record<
      string,
      string | number | undefined
    > = {}
  ) {
    const query =
      new URLSearchParams()

    for (
      const [key, value]
      of Object.entries(params)
    ) {
      if (
        value !== undefined &&
        value !== ""
      ) {
        query.set(
          key,
          String(value)
        )
      }
    }

    return request<any>(
      `/shopping/order/getOrderList?${query.toString()}`
    )
  },
}
