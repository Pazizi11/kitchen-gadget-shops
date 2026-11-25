import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import nodemailer from "nodemailer"

const SUPPORT_EMAIL = "hello@bykitchengadgetshops.com"

const ALLOWED_TOPICS = new Set([
  "Shipping and delivery",
  "Order status",
  "Product question",
  "Returns and refunds",
  "Damaged or incorrect item",
  "Payment",
  "Other",
])

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maxLength)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }
    return entities[character]
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Record<string, unknown>

  // Honeypot: bots often fill hidden fields that people leave empty.
  if (cleanText(body.website, 200)) {
    return res.status(200).json({
      received: true,
      message: "Thank you. Your question has been received.",
    })
  }

  const name = cleanText(body.name, 100)
  const email = cleanText(body.email, 254)
  const topic = cleanText(body.topic, 80)
  const orderNumber = cleanText(body.orderNumber, 100)
  const message = cleanText(body.message, 5000)

  const validEmail =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    !/[\r\n]/.test(email)

  if (
    name.length < 2 ||
    !validEmail ||
    !ALLOWED_TOPICS.has(topic) ||
    message.length < 10
  ) {
    return res.status(400).json({
      message: "Please check your name, email, topic, and message, then try again.",
    })
  }

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 465)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const secure = (process.env.SMTP_SECURE || "true").toLowerCase() === "true"

  if (!host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("Support email is not configured: required SMTP settings are missing.")
    return res.status(503).json({
      message: "Customer support messaging is temporarily unavailable. Please try again later.",
    })
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })

    const text = [
      "New customer question — Kitchen Gadget Shops",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Topic: ${topic}`,
      `Order number: ${orderNumber || "Not provided"}`,
      "",
      "Message:",
      message,
    ].join("\n")

    const html = `
      <h2>New customer question</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
      <p><strong>Order number:</strong> ${escapeHtml(orderNumber || "Not provided")}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    `

    await transporter.sendMail({
      from: user,
      to: SUPPORT_EMAIL,
      replyTo: email,
      subject: `[Customer Question] ${topic}`,
      text,
      html,
    })

    return res.status(200).json({
      received: true,
      message: "Thank you. Your question has been sent to our support team.",
    })
  } catch (error) {
    console.error(
      "Support email delivery failed:",
      error instanceof Error ? error.message : "Unknown mail transport error"
    )

    return res.status(502).json({
      message: "We couldn't send your question right now. Please try again later.",
    })
  }
}
