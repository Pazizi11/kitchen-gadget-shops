import "dotenv/config"

const CJ_BASE_URL =
  "https://developers.cjdropshipping.com/api2.0/v1"

type CJResponse<T> = {
  code: number
  result: boolean
  message: string
  data: T
  requestId?: string
  success?: boolean
}

export type CJProduct = {
  pid: string
  productNameEn: string
  productSku: string
  bigImage: string
  productImageSet?: string[]
  sellPrice: string
  description?: string
  categoryName?: string
  productWeight?: string
  variants?: CJVariant[]
}

export type CJVariant = {
  vid: string
  pid: string
  variantNameEn: string
  variantImage?: string
  variantSku: string
  barcode?: string
  variantSellPrice: number
  variantWeight?: number
  variantLength?: number
  variantWidth?: number
  variantHeight?: number
  variantKey?: string
}

export type CJInventory = {
  vid: string
  areaId: string
  areaEn: string
  countryCode: string
  storageNum: number
  totalInventoryNum: number
  cjInventoryNum: number
  factoryInventoryNum: number
  stock: {
    stockId: string
    inventory: number
    factoryInventory: number
  }[]
}

export class CJClient {
  private accessToken: string

  constructor() {
    const token = process.env.CJ_ACCESS_TOKEN

    if (!token) {
      throw new Error(
        "CJ_ACCESS_TOKEN is missing from apps/backend/.env"
      )
    }

    this.accessToken = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${CJ_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "CJ-Access-Token": this.accessToken,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    })

    const text = await response.text()

    let data: CJResponse<T>

    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(
        `CJ API returned invalid JSON. HTTP ${response.status}: ${text}`
      )
    }

    if (!response.ok || !data.result) {
      throw new Error(
        `CJ API error. HTTP ${response.status}: ${data.message}`
      )
    }

    return data.data
  }

  async getProduct(pid: string): Promise<CJProduct> {
    return this.request<CJProduct>(
      `/product/query?pid=${encodeURIComponent(pid)}`
    )
  }

  async getInventory(vid: string): Promise<CJInventory[]> {
    return this.request<CJInventory[]>(
      `/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`
    )
  }

  calculateSellingPrice(costPrice: number): number {
    const markupPercent = Number(
      process.env.CJ_MARKUP_PERCENT || "30"
    )

    return Number(
      (costPrice * (1 + markupPercent / 100)).toFixed(2)
    )
  }
}