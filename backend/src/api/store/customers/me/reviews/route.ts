import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id

  if (!customerId) {
    return res.status(401).json({
      message: "You must be logged in as a customer.",
    })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "customer_id",
      "items.*",
      "items.product.*",
    ],
    filters: {
      customer_id: customerId,
    },
  })

  const purchasedProducts = new Map<
    string,
    {
      product_id: string
      product_title: string
      order_id: string
      order_display_id: string | number
    }
  >()

  for (const order of orders) {
    for (const item of order.items || []) {
      if (!item) {
        continue
      }

      const product = item.product

      if (!product?.id) {
        continue
      }

      if (!purchasedProducts.has(product.id)) {
        purchasedProducts.set(product.id, {
          product_id: product.id,
          product_title: product.title || item.title || "Product",
          order_id: order.id,
          order_display_id: order.display_id ?? "",
        })
      }
    }
  }

  res.json({
    products: Array.from(purchasedProducts.values()),
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id

  if (!customerId) {
    return res.status(401).json({
      message: "You must be logged in as a customer.",
    })
  }

  const {
    order_id,
    product_id,
    rating,
    title,
    content,
  } = req.body as {
    order_id?: string
    product_id?: string
    rating?: number
    title?: string
    content?: string
  }

  if (!order_id || !product_id || rating === undefined) {
    return res.status(400).json({
      message:
        "order_id, product_id, and rating are required.",
    })
  }

  const numericRating = Number(rating)

  if (
    !Number.isInteger(numericRating) ||
    numericRating < 1 ||
    numericRating > 5
  ) {
    return res.status(400).json({
      message: "Rating must be an integer between 1 and 5.",
    })
  }

  if (!content || !content.trim()) {
    return res.status(400).json({
      message: "Review content is required.",
    })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  /*
   * Verify that the order belongs to the logged-in customer
   * and that the product was actually purchased in that order.
   */
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "items.*",
      "items.product.*",
    ],
    filters: {
      id: order_id,
      customer_id: customerId,
    },
  })

  const order = orders?.[0]

  if (!order) {
    return res.status(403).json({
      message:
        "This order does not belong to the logged-in customer.",
    })
  }

  const purchasedItem = (order.items || []).find(
    (item: any) =>
      item &&
      item.product &&
      item.product.id === product_id
  )

  if (!purchasedItem) {
    return res.status(403).json({
      message:
        "This product was not purchased in the specified order.",
    })
  }

  /*
   * Load the customer so the review stores the customer's
   * details alongside the review.
   */
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
    ],
    filters: {
      id: customerId,
    },
  })

  const customer = customers?.[0]

  if (!customer) {
    return res.status(404).json({
      message: "Customer could not be found.",
    })
  }

  /*
   * Resolve the custom Product Review module.
   */
  const reviewModule = req.scope.resolve("productReview")

  const review = await reviewModule.createReviews({
    product_id,
    customer_id: customer.id,
    order_id,
    rating: numericRating,
    title: title?.trim() || null,
    content: content.trim(),
    first_name: customer.first_name || "",
    last_name: customer.last_name || "",
    customer_email: customer.email || "",
    status: "pending",
    verified_purchase: true,
  })

  res.status(201).json({
    review,
  })
}