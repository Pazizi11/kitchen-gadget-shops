import {
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { cj, parseCjUsSellableQuantity } from "./client"

const MARKUP = 8.35
const USD = "usd"

function moneyToCents(value: unknown) {
  const n = Number(value)
  return Math.round(n * 100)
}

function extractVariants(detail: any): any[] {
  return (
    detail?.content ||
    detail?.variants ||
    detail?.data?.content ||
    detail?.data?.variants ||
    []
  )
}

function extractPrice(variant: any, product: any) {
  return Number(
    variant?.sellPrice ??
      variant?.price ??
      variant?.variantSellPrice ??
      variant?.costPrice ??
      product?.sellPrice ??
      product?.price ??
      product?.costPrice ??
      0
  )
}

export function calculateStorePrice(cjCost: number) {
  return Math.round(cjCost * (1 + MARKUP) * 100) / 100
}

const FREIGHT_START_COUNTRY = "CN"
const FREIGHT_END_COUNTRY = "US"
const TARGET_MARGIN = 0.40
const BALANCED_FREIGHT_PREMIUM = 2.50
const FALLBACK_FREIGHT_PREMIUM = 5.00
const FAST_DELIVERY_MAX_DAYS = 11

function getFreightOptions(response: any): any[] {
  if (Array.isArray(response)) {
    return response
  }

  const possible =
    response?.data ||
    response?.content ||
    response?.list ||
    response?.data?.list ||
    response?.data?.content

  return Array.isArray(possible)
    ? possible
    : []
}

function getFreight(option: any): number {
  const totalPostage =
    Number(option?.totalPostageFee)

  if (
    Number.isFinite(totalPostage) &&
    totalPostage >= 0
  ) {
    return totalPostage
  }

  const logisticPrice =
    Number(option?.logisticPrice)

  if (
    Number.isFinite(logisticPrice) &&
    logisticPrice >= 0
  ) {
    return logisticPrice
  }

  return NaN
}

function getDeliveryDays(option: any): number {
  const raw =
    String(
      option?.logisticAging ??
        option?.deliveryTime ??
        option?.aging ??
        ""
    )

  const matches =
    raw.match(/\d+(?:\.\d+)?/g) || []

  const numbers =
    matches
      .map(Number)
      .filter(Number.isFinite)

  if (!numbers.length) {
    return Number.POSITIVE_INFINITY
  }

  return Math.max(...numbers)
}

function getShippingMethod(option: any): string {
  return String(
    option?.logisticName ||
      option?.logisticType ||
      option?.shippingMethod ||
      "Unknown"
  )
}

function isUsableFreightOption(option: any): boolean {
  const freight = getFreight(option)

  return (
    Number.isFinite(freight) &&
    freight >= 0
  )
}

function selectCheapestFreight(
  options: any[]
): any | null {
  const usable =
    options.filter(
      isUsableFreightOption
    )

  if (!usable.length) {
    return null
  }

  return [...usable].sort(
    (a, b) =>
      getFreight(a) -
      getFreight(b)
  )[0]
}

function selectProductionFreight(
  options: any[]
): any | null {
  const usable =
    options.filter(
      isUsableFreightOption
    )

  if (!usable.length) {
    return null
  }

  const cheapest =
    selectCheapestFreight(
      usable
    )

  if (!cheapest) {
    return null
  }

  const cheapestCost =
    getFreight(cheapest)

  /*
   * Primary policy:
   *
   * Prefer delivery within 11 days when
   * it costs no more than $2.50 above the
   * cheapest usable shipping method.
   */
  const balancedEligible =
    usable.filter(
      (option) =>
        getFreight(option) <=
          cheapestCost +
            BALANCED_FREIGHT_PREMIUM &&
        getDeliveryDays(option) <=
          FAST_DELIVERY_MAX_DAYS
    )

  if (balancedEligible.length) {
    return [...balancedEligible].sort(
      (a, b) => {
        const deliveryDifference =
          getDeliveryDays(a) -
          getDeliveryDays(b)

        if (
          deliveryDifference !== 0
        ) {
          return deliveryDifference
        }

        return (
          getFreight(a) -
          getFreight(b)
        )
      }
    )[0]
  }

  /*
   * Secondary policy:
   *
   * Allow up to $5.00 above the cheapest
   * only when that unlocks an <=11-day
   * shipping option.
   */
  const fallbackEligible =
    usable.filter(
      (option) =>
        getFreight(option) <=
          cheapestCost +
            FALLBACK_FREIGHT_PREMIUM &&
        getDeliveryDays(option) <=
          FAST_DELIVERY_MAX_DAYS
    )

  if (fallbackEligible.length) {
    return [...fallbackEligible].sort(
      (a, b) => {
        const deliveryDifference =
          getDeliveryDays(a) -
          getDeliveryDays(b)

        if (
          deliveryDifference !== 0
        ) {
          return deliveryDifference
        }

        return (
          getFreight(a) -
          getFreight(b)
        )
      }
    )[0]
  }

  /*
   * Final fallback:
   *
   * Use the cheapest usable shipping
   * method when no <=11-day option can
   * be selected under the policy.
   */
  return cheapest
}

async function calculateProductionPrice(
  cjCost: number,
  vid: string
) {
  if (
    !Number.isFinite(cjCost) ||
    cjCost < 0
  ) {
    throw new Error(
      `Invalid CJ cost for variant ${vid}: ${cjCost}`
    )
  }

  if (!vid) {
    throw new Error(
      "Cannot calculate production price without a CJ variant ID (vid)."
    )
  }

  const verifiedUsFreeShippingVariants = new Set([
    "1900031106263519234",
    "1992965053199335425",
    "1992904715383119873",
    "1909118777062195202",
    "1909117630112989186",
    "1849382662499618816",
    "1849380581806067712",
  
  "1992903788484915201",
  "1875416841748254722",
  "1892395967128399873",
    "1953124913305329665",
    "2021427212673671170",
    "1923574291005620225",
    "1870314794223005698",
    "1992867067723169793",
    "1957037356730155009",
    "1952775525370810369", // Commercial Exhaust Hood
    "2001203841657122817", // Roof Exhaust Fan
])

  const verifiedUsFreeShipping =
    verifiedUsFreeShippingVariants.has(vid)

  const verifiedUsWarehouseVariants = new Set([
    "1798625243889029120", // Japanese Vanadium Chef Knife
    "1798622933519585280", // 8 Inch Santoku Knife
    "1706600762530746368", // Qulajoy Nakiri Knife
  ])

  const freightStartCountryCode =
    verifiedUsFreeShipping ||
    verifiedUsWarehouseVariants.has(vid) ||
    vid === "1887762842595926017"
      ? "US"
      : FREIGHT_START_COUNTRY

  const freightResponse =
    await cj.freightCalculate({
      startCountryCode:
        freightStartCountryCode,

      endCountryCode:
        FREIGHT_END_COUNTRY,

      products: [
        {
          quantity: 1,
          vid,
        },
      ],
    })

  const options =
    getFreightOptions(
      freightResponse
    )

  const selected =
    selectProductionFreight(
      options
    )

  if (!selected && !verifiedUsFreeShipping) {
    throw new Error(
      `No usable US freight option returned by CJ for variant ${vid}.`
    )
  }

  // CJ dashboard confirms free UPS shipping from US to US
  // for this exact verified variant.
  const freight =
    verifiedUsFreeShipping
      ? 0
      : Math.round(
          getFreight(selected) * 100
        ) / 100

  const landedCost =
    Math.round(
      (cjCost + freight) * 100
    ) / 100

  // Store-wide pricing: landed cost divided by 0.60
  // gives the required 40% gross margin. Always round up.
  const marginFloor =
    Math.ceil(
      (landedCost / (1 - TARGET_MARGIN)) * 100 - 1e-9
    ) / 100

  const storePrice = marginFloor
  const referencePrice = storePrice

  return {
    storePrice,

    cjCost,

    freight,

    landedCost,

    referencePrice,

    marginFloor,

    targetMargin:
      TARGET_MARGIN,

    shippingMethod:
      getShippingMethod(
        selected
      ),

    deliveryDays:
      getDeliveryDays(
        selected
      ),

    shippingPremium:
      Math.round(
        (freight -
          getFreight(
            selectCheapestFreight(
              options
            )!
          )) *
          100
      ) / 100,
  }
}

/*
 * CJ sometimes returns image collections as:
 *
 * 1. an actual array
 * 2. a JSON string containing an array
 * 3. a single URL string
 *
 * Normalize all of those formats into URL strings.
 */
function extractUrlList(value: unknown): string[] {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item: any) => {
        if (typeof item === "string") {
          return [item]
        }

        return [
          item?.url,
          item?.image,
          item?.imageUrl,
          item?.src,
        ].filter(Boolean)
      })
      .map((url) => String(url).trim())
      .filter(Boolean)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()

    if (!trimmed) {
      return []
    }

    /*
     * CJ productImage/productImageSet can be
     * JSON strings containing an array.
     */
    if (
      trimmed.startsWith("[") ||
      trimmed.startsWith("{")
    ) {
      try {
        const parsed = JSON.parse(trimmed)

        return extractUrlList(parsed)
      } catch {
        /*
         * Not valid JSON, so treat it as a normal URL
         * below.
         */
      }
    }

    return [trimmed]
  }

  return []
}

/*
 * Extract image URLs embedded directly inside the
 * CJ HTML product description.
 */
function extractHtmlImageUrls(
  html: unknown
): string[] {
  if (typeof html !== "string") {
    return []
  }

  const urls: string[] = []

  const regex =
    /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi

  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      urls.push(match[1].trim())
    }
  }

  return urls.filter(Boolean)
}

/*
 * Build one clean, duplicate-free image list from
 * every image source CJ provides.
 */
function collectProductImages(
  product: any,
  variants: any[],
  description: unknown
): string[] {
  const urls: string[] = []

  urls.push(
    ...extractUrlList(product?.bigImage),
    ...extractUrlList(product?.productImage),
    ...extractUrlList(product?.productImageSet),
    ...extractUrlList(product?.image),
    ...extractUrlList(product?.images),
    ...extractUrlList(product?.imageSet)
  )

  /*
   * Variant images can contain images that aren't included
   * in the main product image collection.
   */
  for (const variant of variants || []) {
    urls.push(
      ...extractUrlList(
        variant?.variantImage
      ),
      ...extractUrlList(
        variant?.image
      ),
      ...extractUrlList(
        variant?.imageUrl
      )
    )
  }

  /*
   * The CJ description itself can contain additional
   * product-detail images.
   */
  urls.push(
    ...extractHtmlImageUrls(description)
  )

  /*
   * Remove empty values and duplicate URLs while
   * preserving their original order.
   */
  return [
    ...new Set(
      urls
        .map((url) => String(url).trim())
        .filter(Boolean)
    ),
  ]
}

/*
 * Extract a usable CJ product video URL when CJ provides
 * one. The current test product has no video, so this
 * safely returns undefined for that product.
 */
function extractProductVideo(
  product: any
): string | undefined {
  const candidates = [
    product?.productVideo,
    product?.video,
    product?.videoUrl,
    product?.videoUrlList?.[0],
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const value = candidate.trim()

      if (value) {
        return value
      }

      continue
    }

    if (candidate && typeof candidate === "object") {
      const value =
        candidate.url ||
        candidate.videoUrl ||
        candidate.src

      if (value) {
        return String(value)
      }
    }
  }

  return undefined
}

/*
 * Convert the CJ product information into one searchable
 * string used for category classification.
 */
function getCategorySearchText(
  product: any,
  title: string,
  description: unknown
): string {
  const descriptionText =
    typeof description === "string"
      ? description.replace(/<[^>]*>/g, " ")
      : ""

  return [
    title,
    product?.categoryName,
    product?.categoryNameEn,
    product?.entryNameEn,
    product?.productKeyEn,
    product?.productNameEn,
    product?.nameEn,
    descriptionText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

/*
 * Map CJ products to the exact seven categories used
 * by the storefront.
 *
 * More specific categories are checked first.
 */
function classifyKitchenCategory(
  product: any,
  title: string,
  description: unknown
): string {
  const text = getCategorySearchText(
    product,
    title,
    description
  )

  /*
   * STORAGE & ORGANIZATION
   *
   * Keep explicit storage products in this category.
   *
   * Important:
   * A product such as "knife storage rack" should be
   * Storage & Organization even though it contains
   * words such as "knife".
   */
  if (
    /\b(storage rack|storage racks|storage holder|storage holders|kitchen rack|kitchen racks|organizer|organiser|organization|organisation|drawer organizer|drawer organiser|cabinet organizer|cabinet organiser|shelf|shelves|shelving|dish rack|plate rack|cutlery rack|knife rack|knife holder|knife block|utensil holder|pot holder|pan holder|spice rack|spice organizer|spice organiser|countertop organizer|countertop organiser|kitchen organizer|kitchen organiser|storage box|storage basket|storage cabinet|jar|jars)\b/.test(
      text
    )
  ) {
    return "Storage & Organization"
  }

  /*
   * BAKEWARE
   */
  if (
    /\b(bake|baking|bakeware|cake|pastry|bread|muffin|cupcake|cookie|cookies|dough|oven tray|baking tray|baking pan|cake pan|cake mold|cake mould|bread pan|loaf pan|pie pan|tart pan|baking mold|baking mould)\b/.test(
      text
    )
  ) {
    return "Bakeware"
  }

  /*
   * COFFEE & TEA
   */
  if (
    /\b(coffee|espresso|cappuccino|latte|tea|teapot|teacup|tea cup|tea maker|coffee maker|coffee machine|coffee grinder|french press|coffee filter|tea infuser|tea strainer)\b/.test(
      text
    )
  ) {
    return "Coffee & Tea"
  }

  /*
   * SMALL APPLIANCES
   */
  if (
    /\b(blender|mixer|juicer|air fryer|airfryer|toaster|microwave|food processor|electric kettle|rice cooker|electric oven|electric grill|electric cooker|appliance|electric appliance)\b/.test(
      text
    )
  ) {
    return "Small Appliances"
  }


  /*
   * GADGETS & TOOLS — SPECIFIC TOOL OVERRIDES
   *
   * A knife sharpener contains the word "knife", but it
   * is a sharpening tool rather than a knife/utensil.
   * Therefore it must be classified before the general
   * knife rule below.
   */
  if (
    /\b(knife sharpener|knife sharpeners|sharpener|sharpeners)\b/.test(
      text
    )
  ) {
    return "Gadgets & Tools"
  }
  /*
   * KITCHEN UTENSILS & SERVING
   *
   * These rules are deliberately placed before the
   * broader cooking-tools rules.
   */
  if (
    /\b(knife|knives|spoon|fork|chopsticks|ladle|tongs|spatula|turner|whisk|peeler|peelers|grater|strainer|strainers|colander|colanders|utensil|utensils|serving|cutlery|bottle opener|can opener|opener|scissors|kitchen scissors|kitchen shear|kitchen shears)\b/.test(
      text
    )
  ) {
    return "Kitchen Utensils & Serving"
  }

  /*
   * GADGETS & TOOLS — FAUCET OVERRIDE
   *
   * Faucets must be classified before the broader
   * cooking-tools rule because CJ product titles and
   * descriptions may contain words such as "cooking"
   * even when the actual product is a kitchen faucet.
   */
  if (
    /\b(faucet|faucets|sink faucet|kitchen faucet|pull[- ]down faucet|pull[- ]out faucet|kitchen tap|sink tap)\b/.test(
      text
    )
  ) {
    return "Gadgets & Tools"
  }

  /*
   * COOKING TOOLS
   *
   * Includes cookware and manual cooking/grinding tools.
   */
  if (
    /\b(pot|pots|pan|pans|wok|saucepan|skillet|cookware|cooking|frying|fry|steamer|pressure cooker|grill|griddle|mortar|pestle|food grinder|meat grinder|manual grinder)\b/.test(
      text
    )
  ) {
    return "Cooking Tools"
  }

  /*
   * GADGETS & TOOLS
   *
   * Specific kitchen tools that don't fit the other
   * categories.
   *
   * Faucets and knife sharpeners intentionally land here.
   */
  if (
    /\b(faucet|faucets|sink faucet|kitchen faucet|tap|kitchen tap|knife sharpener|knife sharpeners|sharpener|sharpeners|thermometer|timer|scale|measuring scale|oil sprayer|spray bottle|kitchen gadget|kitchen tool)\b/.test(
      text
    )
  ) {
    return "Gadgets & Tools"
  }

  /*
   * Safe fallback for kitchen products that don't match
   * a more specific category.
   */
  return "Gadgets & Tools"
}
/*
 * Resolve the exact storefront category IDs from Medusa.
 */
async function getStorefrontCategoryIds(
  query: any
): Promise<Record<string, string>> {
  const { data: categories } =
    await query.graph({
      entity: "product_category",
      fields: [
        "id",
        "name",
        "handle",
      ],
    })

  const requiredNames = [
    "Cooking Tools",
    "Storage & Organization",
    "Bakeware",
    "Kitchen Utensils & Serving",
    "Small Appliances",
    "Gadgets & Tools",
    "Coffee & Tea",
  ]

  const categoryIds: Record<string, string> = {}

  for (const name of requiredNames) {
    const category =
      categories?.find(
        (item: any) =>
          String(item?.name || "") === name
      )

    if (!category?.id) {
      throw new Error(
        `Required storefront category "${name}" was not found in Medusa.`
      )
    }

    categoryIds[name] = String(
      category.id
    )
  }

  return categoryIds
}

export async function syncCjProducts(
  container: any,
  options: {
    keyword?: string
    pageSize?: number
    maxProducts?: number
    pid?: string
    variantIds?: string[]
    createOnly?: boolean
  } = {}
) {
  const logger =
    container.resolve(
      ContainerRegistrationKeys.LOGGER
    )

  const query =
    container.resolve(
      ContainerRegistrationKeys.QUERY
    )

  const pageSize =
    Math.min(
      Number(
        options.pageSize || 20
      ),
      100
    )

  const maxProducts =
    Math.max(
      Number(
        options.maxProducts || 20
      ),
      1
    )

  const keyword =
    options.keyword ||
    process.env.CJ_PRODUCT_KEYWORD ||
    "kitchen"

  /*
   * Resolve the default Medusa sales channel.
   */
  const { data: stores } =
    await query.graph({
      entity: "store",
      fields: [
        "id",
        "default_sales_channel_id",
      ],
    })

  const salesChannelId =
    stores?.[0]
      ?.default_sales_channel_id

  if (!salesChannelId) {
    throw new Error(
      "No default Medusa sales channel exists"
    )
  }

  /*
   * Resolve the exact seven storefront categories
   * before importing any products.
   */
  const categoryIds =
    await getStorefrontCategoryIds(
      query
    )

  let products: any[] = []

  /*
   * Specific PID mode.
   */
  if (options.pid) {
    products = [
      {
        pid: String(
          options.pid
        ),
      },
    ]
    } else {
    /*
     * CJ Product List V2.
     *
     * Fetch multiple pages when necessary instead of
     * requesting only page 1.
     *
     * The CJ client already enforces the 1.2-second
     * request spacing and network retry protection.
     */
    const allProducts: any[] = []

    const maxPages = Math.ceil(
      maxProducts / pageSize
    )

    for (
      let page = 1;
      page <= maxPages;
      page++
    ) {
      const list =
        await cj.listProducts({
          page,
          size: pageSize,
          keyWord: keyword,
        })

      const pageProducts =
        list?.content?.[0]
          ?.productList ||
        list?.list ||
        list?.content ||
        list?.data?.list ||
        list?.data?.content ||
        []

      if (
        !Array.isArray(pageProducts) ||
        pageProducts.length === 0
      ) {
        logger.info(
          `CJ Product List V2 returned no products on page ${page}. Stopping pagination.`
        )

        break
      }

      allProducts.push(
        ...pageProducts
      )

      logger.info(
        `CJ Product List V2 page ${page}: ` +
        `received ${pageProducts.length} product(s). ` +
        `Collected ${allProducts.length}/${maxProducts}.`
      )

      if (
        allProducts.length >=
        maxProducts
      ) {
        break
      }

      /*
       * If CJ returns fewer products than the
       * requested page size, there is no need to
       * request another page.
       */
      if (
        pageProducts.length <
        pageSize
      ) {
        break
      }
    }

    products = allProducts
  }

  const limited =
    products.slice(
      0,
      maxProducts
    )

  const prepared: any[] = []
  const preparedPids =
    new Set<string>()

  const preparedVids =
    new Set<string>()

  let skipped = 0

  const skippedProducts: any[] =
    []

  /*
   * Track handles prepared during this CJ import batch.
   *
   * Medusa validates handles across the entire
   * createProductsWorkflow batch, so two different
   * CJ products must not produce the same handle.
   */
  const preparedHandles =
    new Set<string>()

  for (const item of limited) {
    const pid = String(
      item.pid ||
        item.id ||
        item.productId ||
        ""
    )

    if (!pid) {
      continue
    }

    if (preparedPids.has(pid)) {
      skipped++

      skippedProducts.push({
        pid,
        reason:
          "duplicate_in_request",
      })

      continue
    }

    preparedPids.add(pid)

    /*
     * Check whether this CJ PID already exists
     * in Medusa.
     */
    const productModule =
      container.resolve(
        "product"
      )

    /*
     * Find an existing Medusa product by its CJ PID.
     *
     * We intentionally retrieve products with metadata
     * and compare cj_pid in JavaScript instead of relying
     * on a JSON metadata filter in query.graph().
     */
    const existingCandidates =
      await productModule.listProducts(
        {},
        {
          select: [
            "id",
            "title",
            "status",
            "metadata",
            "variants.*",
          ],
          take: 1000,
        }
      )

    const existingCjVids = new Set<string>(
      (existingCandidates || []).flatMap((candidate: any) =>
        (candidate?.variants || [])
          .map((variant: any) =>
            String(variant?.metadata?.cj_vid || "").trim()
          )
          .filter(Boolean)
      )
    )

    const existingProducts =
      (existingCandidates || []).filter(
        (candidate: any) =>
          String(
            candidate?.metadata?.cj_pid ||
            ""
          ) === pid
      )

    /*
     * Get complete CJ product details.
     */
    const detail =
      await cj.getProduct(pid)

    const product =
      detail?.product ||
      detail?.data ||
      detail ||
      item

    /*
     * Existing product:
     *
     * Do NOT create a duplicate.
     * Update its USD variant prices using
     * the current 835% markup.
     */
    if (existingProducts?.length && options.createOnly) {
      throw new Error(
        `CREATE-ONLY SAFETY STOP: CJ PID ${pid} already exists in Medusa. No existing product was modified.`
      )
    }

    if (existingProducts?.length) {
      const existing =
        existingProducts[0]

      const cjVariants =
        extractVariants(
          detail
        )

      const priceUpdates: any[] =
        []

      const variantMetadataUpdates: any[] =
        []

      const pricingModule =
        container.resolve(
          Modules.PRICING
        )

      const productModule =
        container.resolve(
          "product"
        )

      /*
       * Rebuild the complete CJ image collection.
       */
      const existingImages =
        collectProductImages(
          product,
          cjVariants,
          product?.description ||
            product?.descriptionEn ||
            product?.descriptionHtml ||
            ""
        )

      /*
       * Determine the exact Kitchen Gadget Shops
       * storefront category.
       */
      const existingCategoryName =
        classifyKitchenCategory(
          product,
          existing.title ||
            product?.productNameEn ||
            "",
          product?.description ||
            product?.descriptionEn ||
            product?.descriptionHtml ||
            ""
        )

      const existingCategoryId =
        categoryIds[
          existingCategoryName
        ]

      if (!existingCategoryId) {
        throw new Error(
          `Could not resolve Medusa category ID for "${existingCategoryName}" while repairing existing CJ PID ${pid}.`
        )
      }

      logger.info(
        `Repairing existing CJ product ${pid}: category="${existingCategoryName}", images=${existingImages.length}.`
      )

      /*
       * Calculate landed-cost pricing for the
       * primary CJ variant so product-level
       * metadata matches the production price
       * used by its variants.
       */
      const primaryCjVariant =
        cjVariants[0]

      const primaryCjVid =
        String(
          primaryCjVariant?.vid ||
            primaryCjVariant?.id ||
            primaryCjVariant?.variantId ||
            primaryCjVariant?.variantID ||
            ""
        )

      const primaryCjCost =
        extractPrice(
          primaryCjVariant,
          product
        )

      let primaryProductionPricing

      try {
        primaryProductionPricing =
          await calculateProductionPrice(
            primaryCjCost,
            primaryCjVid
          )
      } catch (error: any) {
        const message =
          error?.message ||
          String(error)

        if (
          message.includes(
            "No usable US freight option returned by CJ"
          )
        ) {
          logger.warn(
            `Skipping existing CJ product ${pid}: no usable US freight was returned for primary variant ${primaryCjVid}.`
          )

          skipped++
          skippedProducts.push({
            pid,
            product_id:
              existing.id,
            title:
              existing.title,
            reason:
              "no_usable_us_freight_for_primary_variant",
            cj_vid:
              primaryCjVid,
          })

          continue
        }

        throw error
      }

      /*
       * Update product metadata, description,
       * thumbnail and complete image collection.
       */
      const existingProductMetadata = {
        ...(existing.metadata || {}),

        cj_pid:
          pid,

        cj_source:
          "cjdropshipping",

        cj_category:
          existingCategoryName,

        cj_category_id:
          existingCategoryId,

        cj_cost_price:
          primaryCjCost,

        cj_freight_cost:
          primaryProductionPricing.freight,

        cj_landed_cost:
          primaryProductionPricing.landedCost,

        cj_reference_price:
          primaryProductionPricing.referencePrice,

        cj_margin_floor:
          primaryProductionPricing.marginFloor,

        cj_store_price:
          primaryProductionPricing.storePrice,

        cj_markup_percent: 0,

        cj_shipping_method:
          primaryProductionPricing.shippingMethod,

        cj_shipping_delivery_days:
          primaryProductionPricing.deliveryDays,

        cj_shipping_premium:
          primaryProductionPricing.shippingPremium,

        cj_raw_title:
          existing.title ||
          product?.productNameEn ||
          "",
      }

      await productModule.updateProducts(
        existing.id,
        {
          description:
            product?.descriptionEn ||
            product?.description ||
            product?.descriptionHtml ||
            existing.description,

          thumbnail:
            existingImages[0] ||
            existing.thumbnail,

          images:
            existingImages.map(
              (url: string) => ({
                url,
              })
            ),

          category_ids:
            [existingCategoryId],

          metadata:
            existingProductMetadata,
        }
      )

      /*
       * Update every matching CJ variant.
       */
      for (
        const medusaVariant of
          existing.variants ||
        []
      ) {
        const cjVid =
          String(
            medusaVariant
              ?.metadata
              ?.cj_vid ||
              ""
          )

        if (!cjVid) {
          continue
        }

        const cjVariant =
          cjVariants.find(
            (variant: any) =>
              String(
                variant?.vid ||
                  variant?.id ||
                  variant?.variantId ||
                  variant?.variantID ||
                  ""
              ) === cjVid
          )

        if (!cjVariant) {
          continue
        }

        const cjCost =
          extractPrice(
            cjVariant,
            product
          )

        if (
          !Number.isFinite(
            cjCost
          ) ||
          cjCost < 0
        ) {
          continue
        }

        /*
         * Production landed-cost pricing:
         *
         * 1. Calculate CJ cost + US freight.
         * 2. Select shipping using the production
         *    shipping policy.
         * 3. Preserve the 835% reference price.
         * 4. Raise the price when necessary to
         *    maintain the 40% target margin.
         */
        let productionPricing

        try {
          productionPricing =
            await calculateProductionPrice(
              cjCost,
              cjVid
            )
        } catch (error: any) {
          const message =
            error?.message ||
            String(error)

          if (
            message.includes(
              "No usable US freight option returned by CJ"
            )
          ) {
            logger.warn(
              `Skipping existing CJ variant ${cjVid} for product ${pid}: no usable US freight returned by CJ.`
            )

            continue
          }

          throw error
        }

        const newStorePrice =
          productionPricing.storePrice

        const variantImage =
          extractUrlList(
            cjVariant?.variantImage
          )[0] ||
          extractUrlList(
            cjVariant?.image
          )[0] ||
          undefined

        const updatedVariantMetadata = {
          ...(medusaVariant.metadata || {}),

          cj_pid:
            pid,

          cj_vid:
            cjVid,

          cj_sku:
            medusaVariant?.sku ||
            cjVariant?.variantSku ||
            medusaVariant?.metadata?.cj_sku ||
            "",

          cj_cost_price:
            cjCost,

          cj_freight_cost:
            productionPricing.freight,

          cj_landed_cost:
            productionPricing.landedCost,

          cj_reference_price:
            productionPricing.referencePrice,

          cj_margin_floor:
            productionPricing.marginFloor,

          cj_store_price:
            newStorePrice,

          cj_markup_percent: 0,

          cj_shipping_method:
            productionPricing.shippingMethod,

          cj_shipping_delivery_days:
            productionPricing.deliveryDays,

          cj_shipping_premium:
            productionPricing.shippingPremium,

          cj_variant_image:
            variantImage ||
            medusaVariant?.metadata?.cj_variant_image,
        }

        await productModule.updateProductVariants(
          medusaVariant.id,
          {
            metadata:
              updatedVariantMetadata,
          }
        )

        variantMetadataUpdates.push({
          variant_id:
            medusaVariant.id,

          cj_cost_price:
            cjCost,

          cj_freight_cost:
            productionPricing.freight,

          cj_landed_cost:
            productionPricing.landedCost,

          cj_reference_price:
            productionPricing.referencePrice,

          cj_margin_floor:
            productionPricing.marginFloor,

          cj_store_price:
            newStorePrice,

          cj_markup_percent: 0,

          cj_shipping_method:
            productionPricing.shippingMethod,

          cj_shipping_delivery_days:
            productionPricing.deliveryDays,

          cj_shipping_premium:
            productionPricing.shippingPremium,
        })

        /*
         * Update the existing USD price.
         */
        const existingPrices =
          medusaVariant
            ?.price_set
            ?.prices ||
          []

        const usdPrice =
          existingPrices.find(
            (price: any) =>
              String(
                price?.currency_code ||
                  ""
              ).toLowerCase() ===
              USD
          )

        if (!usdPrice?.id) {
          logger.warn(
            `CJ product ${pid}, variant ${cjVid}: no existing USD price found. Skipping price update.`
          )

          continue
        }

        const priceSetId =
          medusaVariant
            ?.price_set
            ?.id

        if (!priceSetId) {
          logger.warn(
            `CJ product ${pid}, variant ${cjVid}: no price set found. Skipping price update.`
          )

          continue
        }

        await pricingModule
          .updatePriceSets(
            priceSetId,
            {
              prices: [
                {
                  id:
                    usdPrice.id,

                  amount:
                    moneyToCents(
                      newStorePrice
                    ),

                  currency_code:
                    USD,
                },
              ],
            }
          )

        priceUpdates.push({
          variant_id:
            medusaVariant.id,

          price_id:
            usdPrice.id,

          amount:
            moneyToCents(
              newStorePrice
            ),
        })
      }

      logger.info(
        `Repaired existing CJ product ${pid}: ${existingImages.length} image(s), category="${existingCategoryName}", ${priceUpdates.length} price update(s), ${variantMetadataUpdates.length} variant metadata update(s), global 40% landed-cost margin.`
      )

      skipped++

      skippedProducts.push({
        pid,

        product_id:
          existing.id,

        title:
          existing.title,

        reason:
          "already_exists_repaired_landed_cost_images_category",

        updated_variants:
          priceUpdates.length,

        updated_variant_metadata:
          variantMetadataUpdates.length,

        updated_images:
          existingImages.length,

        category:
          existingCategoryName,
      })

      continue
    }
    /*
     * Extract CJ variants.
     */
    const variants =
      extractVariants(
        detail
      )

    const candidateVariants =
      variants.length
        ? variants
        : [
            {
              ...item,
              pid,
            },
          ]

    const requestedVariantIds = new Set(
      (options.variantIds || []).map((id) => String(id).trim())
    )

    if (
      requestedVariantIds.size > 0 &&
      ![...requestedVariantIds].every((id) =>
        candidateVariants.some((variant: any) =>
          String(
            variant?.vid ||
            variant?.id ||
            variant?.variantId ||
            variant?.variantID ||
            ""
          ).trim() === id
        )
      )
    ) {
      throw new Error(
        `VARIANT WHITELIST SAFETY STOP: One or more approved CJ variants were not returned for PID ${pid}.`
      )
    }

    const variantsToProcess =
      requestedVariantIds.size > 0
        ? candidateVariants.filter((variant: any) =>
            requestedVariantIds.has(
              String(
                variant?.vid ||
                variant?.id ||
                variant?.variantId ||
                variant?.variantID ||
                ""
              ).trim()
            )
          )
        : candidateVariants

    const usableVariants = variantsToProcess.filter(
      (variant: any, index: number) => {
        const vid = String(
          variant?.vid ||
          variant?.id ||
          variant?.variantId ||
          variant?.variantID ||
          `${pid}-${index}`
        ).trim()

        if (!vid || existingCjVids.has(vid) || preparedVids.has(vid)) {
          skippedProducts.push({
            pid,
            vid,
            reason: "duplicate_cj_variant_id",
          })
          skipped++
          return false
        }

        preparedVids.add(vid)
        return true
      }
    )

    if (usableVariants.length === 0) {
      skippedProducts.push({
        pid,
        reason: "no_unique_cj_variants",
      })
      skipped++
      continue
    }

    /*
     * Full CJ description.
     *
     * CJ currently supplies the HTML in `description`.
     */
    const description =
      product?.descriptionEn ||
      product?.description ||
      product?.descriptionHtml ||
      undefined

    /*
     * Full English product title.
     */
    const title = String(
      product?.productNameEn ||
        product?.nameEn ||
        product?.productName ||
        product?.name ||
        item?.productNameEn ||
        item?.nameEn ||
        `CJ Product ${pid}`
    ).trim()

    /*
     * Collect ALL available product, variant,
     * productImageSet, and HTML description images.
     */
    const images =
      collectProductImages(
        product,
        usableVariants,
        description
      )

    /*
     * Determine the exact storefront category.
     */
    const categoryName =
      classifyKitchenCategory(
        product,
        title,
        description
      )

    const categoryId =
      categoryIds[
        categoryName
      ]

    if (!categoryId) {
      throw new Error(
        `Could not resolve Medusa category ID for "${categoryName}" while importing CJ PID ${pid}.`
      )
    }

    logger.info(
      `CJ product ${pid} classified as "${categoryName}" with ${images.length} image(s).`
    )

    /*
     * Convert CJ variants into Medusa variants.
     */
    const medusaVariants =
      (
        await Promise.all(
          usableVariants.map(
            async (
              variant: any,
              index: number
            ) => {
          const vid =
            String(
              variant.vid ||
                variant.id ||
                variant.variantId ||
                variant.variantID ||
                `${pid}-${index}`
            )

          let stock

          try {
            stock = await cj.getStock(vid)
          } catch (error: any) {
            logger.warn(
              `Skipping CJ variant ${vid}: stock query failed: ${error?.message || String(error)}`
            )
            return null
          }

          const stockCheck = parseCjUsSellableQuantity(stock)

          if (!stockCheck.ok) {
            logger.warn(
              `Skipping CJ variant ${vid}: ${stockCheck.reason}`
            )
            return null
          }

          const cjCost =
            extractPrice(
              variant,
              product
            )

          /*
           * Production landed-cost pricing:
           *
           * 1. Calculate CJ cost + US freight.
           * 2. Select shipping using the production
           *    shipping policy.
           * 3. Preserve the 835% reference price.
           * 4. Raise the price when necessary to
           *    maintain the 40% target margin.
           *
           * If CJ provides no usable US freight for this
           * variant, skip only this variant instead of
           * aborting the entire product import.
           */
          let productionPricing

          try {
            productionPricing =
              await calculateProductionPrice(
                cjCost,
                vid
              )
          } catch (error: any) {
            const message =
              error?.message ||
              String(error)

            if (
              message.includes(
                "No usable US freight option returned by CJ"
              )
            ) {
              logger.warn(
                `Skipping new CJ variant ${vid} for product ${pid}: no usable US freight returned by CJ.`
              )

              return null
            }

            throw error
          }

          const price =
            productionPricing.storePrice

          const sku =
            String(
              variant.variantSku ||
                variant.sku ||
                `${pid}-${index + 1}`
            )

          const variantTitle =
            String(
              variant.variantNameEn ||
                variant.variantName ||
                variant.name ||
                `Variant ${index + 1}`
            )

          const variantImage =
            extractUrlList(
              variant?.variantImage
            )[0] ||
            extractUrlList(
              variant?.image
            )[0] ||
            undefined

          return {
            title:
              variantTitle,

            sku,

            manage_inventory:
              true,

            options: {
              "Default Option":
                variantTitle,
            },

            prices: [
              {
                currency_code:
                  USD,

                amount:
                  moneyToCents(
                    price
                  ),
              },
            ],

            metadata: {
              cj_pid:
                pid,

              cj_vid:
                vid,

              cj_sku:
                sku,

              cj_cost_price:
                cjCost,

              cj_freight_cost:
                productionPricing.freight,

              cj_landed_cost:
                productionPricing.landedCost,

              cj_reference_price:
                productionPricing.referencePrice,

              cj_margin_floor:
                productionPricing.marginFloor,

              cj_store_price:
                price,

              cj_markup_percent: 0,

              cj_shipping_method:
                productionPricing.shippingMethod,

              cj_shipping_delivery_days:
                productionPricing.deliveryDays,

              cj_shipping_premium:
                productionPricing.shippingPremium,

              cj_variant_image:
                variantImage ||
                undefined,
            },
            }
          }
          )
        )
      ).filter(
        (
          variant: any
        ) => variant !== null
      )

    /*
     * If CJ returned no usable US freight for any
     * variant, do not create an unshippable product.
     */
    if (
      medusaVariants.length === 0
    ) {
      logger.warn(
        `Skipping new CJ product ${pid}: no variants have usable US freight to the US.`
      )

      skipped++

      skippedProducts.push({
        pid,
        title,
        reason:
          "no_usable_us_freight_for_any_variant",
      })

      continue
    }

    /*
     * Product video.
     */
    const videoUrl =
      extractProductVideo(
        product
      )

    /*
     * Prevent an existing Medusa handle from
     * breaking the entire CJ batch.
     *
     * Medusa generates the handle automatically
     * from the product title when no handle is supplied.
     */
    const normalizedHandle =
      title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

    const handleMatches =
      await productModule.listProducts(
        {
          handle:
            normalizedHandle,
        },
        {
          select: [
            "id",
            "title",
            "handle",
            "metadata",
          ],
          take: 1,
        }
      )

    if (handleMatches?.length) {
      skipped++

      skippedProducts.push({
        pid,
        product_id:
          handleMatches[0].id,
        title,
        handle:
          normalizedHandle,
        reason:
          "handle_already_exists",
      })

      logger.info(
        `Skipping CJ product ${pid}: Medusa handle "${normalizedHandle}" already exists.`
      )

      continue
    }

    /*
     * Prevent duplicate handles inside the current
     * import batch.
     *
     * These products do not exist in Medusa yet, so
     * Product Module listProducts() cannot detect them.
     */
    if (preparedHandles.has(normalizedHandle)) {
      skipped++

      skippedProducts.push({
        pid,
        title,
        handle:
          normalizedHandle,
        reason:
          "handle_already_prepared_in_batch",
      })

      logger.info(
        `Skipping CJ product ${pid}: handle "${normalizedHandle}" is already prepared in this CJ batch.`
      )

      continue
    }

    preparedHandles.add(normalizedHandle)

    /*
     * Prepare Medusa product.
     *
     * Products intentionally remain DRAFT until
     * the complete CJ fulfillment flow is verified.
     */
    prepared.push({
      title,

      status:
        "draft",

      description,

      thumbnail:
        images[0],

      images:
        images.map(
          (url: string) => ({
            url,
          })
        ),

      options: [
        {
          title:
            "Default Option",

          values:
            medusaVariants.map(
              (v: any) =>
                v.options[
                  "Default Option"
                ]
            ),
        },
      ],

      variants:
        medusaVariants,

      /*
       * This attaches the product directly to
       * the exact storefront category.
       */
      category_ids: [
        categoryId,
      ],

      sales_channels: [
        {
          id:
            salesChannelId,
        },
      ],

      metadata: {
        cj_pid:
          pid,

        cj_source:
          "cjdropshipping",

        cj_category:
          categoryName,

        cj_category_id:
          categoryId,

        cj_cost_price:
          medusaVariants[0]?.metadata?.cj_cost_price,

        cj_freight_cost:
          medusaVariants[0]?.metadata?.cj_freight_cost,

        cj_landed_cost:
          medusaVariants[0]?.metadata?.cj_landed_cost,

        cj_reference_price:
          medusaVariants[0]?.metadata?.cj_reference_price,

        cj_margin_floor:
          medusaVariants[0]?.metadata?.cj_margin_floor,

        cj_store_price:
          medusaVariants[0]?.metadata?.cj_store_price,

        cj_markup_percent: 0,

        cj_shipping_method:
          medusaVariants[0]?.metadata?.cj_shipping_method,

        cj_shipping_delivery_days:
          medusaVariants[0]?.metadata?.cj_shipping_delivery_days,

        cj_shipping_premium:
          medusaVariants[0]?.metadata?.cj_shipping_premium,

        cj_raw_title:
          title,

        cj_video_url:
          videoUrl ||
          undefined,
      },
    })
  }

  if (!prepared.length) {
    return {
      created: 0,

      skipped,

      products: [],

      skippedProducts,
    }
  }

  /*
   * Create the prepared CJ products in Medusa.
   */
  const {
    result,
  } =
    await createProductsWorkflow(
      container
    ).run({
      input: {
        products:
          prepared,
      },
    })

  // Automatically synchronize fresh CJ US stock for newly created products.

  const createdProductIds = result
    .map((product: any) => product.id)
    .filter(Boolean)

  const { data: createdVariants } = await query.graph({
    entity: "product_variant",
    fields: ["id"],
    filters: { product_id: createdProductIds },
  })

  const inventoryResult = await syncVariantInventory(
    container,
    (createdVariants || []).map((variant: any) => variant.id)
  )

  logger.info(
    `CJ inventory sync: ${inventoryResult.updated.length} updated, ${inventoryResult.skipped.length} skipped.`
  )

  logger.info(
    `CJ sync created ${result.length} draft product(s).`
  )

  return {
    created:
      result.length,

    skipped,

    products:
      result,

    skippedProducts,
  }
}
export async function syncVariantInventory(
  container: any,
  variantIds?: string[],
  cjVids?: string[]
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryModule = container.resolve(Modules.INVENTORY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const targetLocationId = "sloc_01M709RHJEJPRSMVNQQY0JKKR5"

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })

  const location = (locations || []).find(
    (entry: any) =>
      entry.id === targetLocationId &&
      entry.name === "CJ US Warehouse"
  )

  if (!location) {
    throw new Error("CJ US Warehouse missing; inventory sync aborted")
  }

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "metadata", "inventory_items.*"],
    filters: variantIds?.length ? { id: variantIds } : {},
  })

  const selected = (variants || []).filter((variant: any) =>
    !cjVids?.length ||
    cjVids.includes(String(variant.metadata?.cj_vid || ""))
  )

  const updated: any[] = []
  const skipped: any[] = []

  for (const variant of selected) {
    const vid = String(variant.metadata?.cj_vid || "")

    if (!vid) {
      skipped.push({
        variant_id: variant.id,
        reason: "Missing CJ VID",
      })
      continue
    }

    let stock: any

    try {
      stock = await cj.getStock(vid)
    } catch (error) {
      const reason = `CJ stock request failed: ${String(error)}`
      logger.error(`${vid}: ${reason}`)
      skipped.push({ variant_id: variant.id, cj_vid: vid, reason })
      continue
    }

    const parsed = parseCjUsSellableQuantity(stock)

    if (!parsed.ok || !Number.isInteger(parsed.quantity) || parsed.quantity <= 0) {
      const reason = parsed.ok
        ? "US stock quantity is not a positive integer"
        : parsed.reason

      logger.warn(`CJ stock rejected for ${vid}: ${reason}`)
      skipped.push({ variant_id: variant.id, cj_vid: vid, reason })
      continue
    }

    const items = (variant.inventory_items || []).filter(Boolean)

    if (items.length !== 1) {
      const reason = `Expected exactly one linked inventory item; found ${items.length}`
      logger.warn(`${vid}: ${reason}`)
      skipped.push({ variant_id: variant.id, cj_vid: vid, reason })
      continue
    }

    const inventoryItemId =
      items[0].inventory_item_id || items[0].id

    if (!inventoryItemId) {
      skipped.push({
        variant_id: variant.id,
        cj_vid: vid,
        reason: "Missing inventory item ID",
      })
      continue
    }

    try {
      const levels = await inventoryModule.listInventoryLevels({
        inventory_item_id: inventoryItemId,
        location_id: targetLocationId,
      })

      if (!Array.isArray(levels)) {
        throw new Error("Unexpected inventory-level response; no write attempted")
      }

      const targetLevels = levels.filter(
        (level: any) => level.location_id === targetLocationId
      )

      if (targetLevels.length > 1) {
        throw new Error("Duplicate CJ US inventory levels; manual review required")
      }

      const input = {
        inventory_item_id: inventoryItemId,
        location_id: targetLocationId,
        stocked_quantity: parsed.quantity,
      }

      if (targetLevels.length === 1) {
        await inventoryModule.updateInventoryLevels(input)
      } else {
        await inventoryModule.createInventoryLevels(input)
      }

      updated.push({
        variant_id: variant.id,
        cj_vid: vid,
        quantity: parsed.quantity,
      })

      logger.info(`CJ US inventory synced: ${vid} => ${parsed.quantity}`)
    } catch (error) {
      const reason = String(error)
      logger.error(`Inventory sync failed for ${vid}: ${reason}`)
      skipped.push({ variant_id: variant.id, cj_vid: vid, reason })
    }
  }

  return { updated, skipped }
}

export async function syncOrderToCj(
  container: any,
  orderId: string
) {
  const query =
    container.resolve(
      ContainerRegistrationKeys.QUERY
    )

  const logger =
    container.resolve(
      ContainerRegistrationKeys.LOGGER
    )

  const orderModule =
    container.resolve(
      Modules.ORDER
    ) as any

  const { data: orders } =
    await query.graph({
      entity: "order",

      fields: [
        "id",
        "display_id",
        "email",
        "phone",
        "metadata",
        "shipping_address.*",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
      ],

      filters: {
        id: orderId,
      },
    })

  const order =
    orders?.[0]

  if (!order) {
    throw new Error(
      `Medusa order ${orderId} was not found`
    )
  }

  const existingCjId =
    order.metadata?.cj_order_id

  if (existingCjId) {
    return {
      skipped: true,
      reason: "already_sent",
      cj_order_id: existingCjId,
    }
  }

  /*
   * Protect against a retry/crash between
   * CJ accepting the order and Medusa
   * saving the CJ ID.
   */
  try {
    const existing =
      await cj.getOrder(
        String(
          order.display_id ||
            order.id
        )
      )

    const existingData =
      existing?.data ||
      existing

    const foundId =
      existingData?.orderId ||
      existingData?.cjOrderId

    if (foundId) {
      const metadata = {
        ...(order.metadata || {}),

        cj_order_id:
          foundId,

        cj_order_number:
          existingData?.orderNumber ||
          order.display_id,

        cj_order_status:
          existingData?.orderStatus,
      }

      await orderModule.updateOrders(
        order.id,
        {
          metadata,
        }
      )

      return {
        skipped: true,
        reason:
          "already_exists_in_cj",
        cj_order_id: foundId,
      }
    }
  } catch {
    /*
     * A not-found response is expected
     * for a new order; proceed to create it.
     */
  }

  const items =
    (order.items || []).map(
      (item: any) => {
        const metadata =
          item.variant?.metadata ||
          {}

        const vid =
          metadata.cj_vid

        if (!vid) {
          throw new Error(
            `Order item ${item.id} is missing metadata.cj_vid; connect/import this product before CJ fulfillment.`
          )
        }

        return {
          vid: String(vid),

          quantity:
            Number(item.quantity),

          storeProductId:
            String(
              item.variant
                ?.product_id ||
                item.variant
                  ?.product?.id ||
                ""
            ),

          storeProductImg:
            item.variant
              ?.product
              ?.thumbnail ||
            undefined,

          storeProductName:
            item.variant
              ?.product?.title ||
            item.title ||
            undefined,

          storeSku:
            item.variant?.sku ||
            undefined,

          variantOptions:
            item.variant?.title ||
            undefined,

          unitPrice:
            Number(
              item.unit_price || 0
            ) / 100,

          storeLineItemId:
            String(item.id),
        }
      }
    )

  const address =
    order.shipping_address ||
    {}

  const countryCode =
    String(
      address.country_code ||
        "us"
    ).toUpperCase()

  const countryName =
    countryCode === "US"
      ? "United States"
      : countryCode

  const name =
    [
      address.first_name,
      address.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Customer"

  const payload = {
    orderNumber:
      String(
        order.display_id ||
          order.id
      ),

    shippingZip:
      address.postal_code ||
      "",

    shippingCountry:
      countryName,

    shippingCountryCode:
      countryCode,

    shippingProvince:
      address.province ||
      address.state ||
      "",

    shippingCity:
      address.city ||
      "",

    shippingCounty:
      "",

    shippingPhone:
      address.phone ||
      order.phone ||
      "",

    shippingCustomerName:
      name,

    shippingAddress:
      address.address_1 ||
      "",

    shippingAddress2:
      address.address_2 ||
      "",

    email:
      order.email ||
      "",

    remark:
      `Kitchen Gadget Shops / Medusa order ${order.id}`,

    logisticName:
      process.env.CJ_LOGISTIC_NAME ||
      "",

    fromCountryCode:
      process.env.CJ_FROM_COUNTRY_CODE ||
      "CN",

    platform:
      "Api",

    shopLogisticsType:
      Number(
        process.env.CJ_SHOP_LOGISTICS_TYPE ||
          2
      ),

    storageId:
      process.env.CJ_STORAGE_ID ||
      undefined,

    orderFlow:
      1,

    isSandbox:
      process.env.CJ_SANDBOX === "true"
        ? 1
        : 0,

    products:
      items,
  }

  const result =
    await cj.createOrderV3(
      payload
    )

  const data =
    result?.data ||
    result

  const metadata = {
    ...(order.metadata || {}),

    cj_order_id:
      data?.orderId ||
      undefined,

    cj_order_number:
      data?.orderNumber ||
      payload.orderNumber,

    cj_order_status:
      data?.orderStatus ||
      undefined,

    cj_shipment_order_id:
      data?.shipmentOrderId ||
      undefined,

    cj_submitted_at:
      new Date().toISOString(),
  }

  await orderModule.updateOrders(
    order.id,
    {
      metadata,
    }
  )

  logger.info(
    `Order ${order.id} submitted to CJ. CJ order: ${
      data?.orderId ||
      "pending"
    }`
  )

  return {
    order_id: order.id,
    cj: data,
  }
}
export { calculateProductionPrice }



























