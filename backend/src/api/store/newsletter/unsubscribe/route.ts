import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createHash } from "node:crypto"

const PUBLIC_API_URL = (
  process.env.NEWSLETTER_PUBLIC_API_URL ||
  "https://api.bykitchengadgetshops.com"
).replace(/\/+$/, "")

function cleanToken(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function page(title: string, message: string, form = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${title} — Kitchen Gadget Shops</title>
</head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:60px auto;padding:24px;line-height:1.6;color:#12294A">
  <h1>${title}</h1>
  <p>${message}</p>
  ${form}
  <p><a href="https://bykitchengadgetshops.com/">Return to Kitchen Gadget Shops</a></p>
</body>
</html>`
}

function setSafeHeaders(res: MedusaResponse) {
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Referrer-Policy", "no-referrer")
  res.setHeader("X-Content-Type-Options", "nosniff")
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  setSafeHeaders(res)

  const token = cleanToken(req.query.token)
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).send(
      page("Invalid unsubscribe link", "This link is invalid or incomplete. Please use the link from your newsletter email.")
    )
  }

  try {
    const newsletter = req.scope.resolve("newsletter") as any
    const matches = await newsletter.listNewsletterSubscriptions({
      unsubscribe_token_hash: hashToken(token),
      status: "subscribed",
    })

    if (!matches.length) {
      return res.status(404).send(
        page("Link unavailable", "This unsubscribe link is invalid, expired, or the subscription has already been cancelled.")
      )
    }

    const action =
      `${PUBLIC_API_URL}/store/newsletter/unsubscribe?token=${encodeURIComponent(token)}`

    return res.status(200).send(
      page(
        "Unsubscribe from our newsletter?",
        "Confirm below if you no longer want to receive Kitchen Gadget Shops newsletter emails.",
        `<form method="post" action="${action}">
          <button type="submit" style="background:#12294A;color:white;padding:12px 20px;border:0;border-radius:6px;cursor:pointer">
            Confirm unsubscribe
          </button>
        </form>`
      )
    )
  } catch (error) {
    console.error(
      "Newsletter unsubscribe page failed:",
      error instanceof Error ? error.message : "Unknown error"
    )
    return res.status(500).send(
      page("Temporarily unavailable", "We couldn't verify this link right now. Please try again later.")
    )
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  setSafeHeaders(res)

  const token = cleanToken(req.query.token)
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).send(
      page("Invalid unsubscribe link", "This link is invalid or incomplete.")
    )
  }

  try {
    const newsletter = req.scope.resolve("newsletter") as any
    const matches = await newsletter.listNewsletterSubscriptions({
      unsubscribe_token_hash: hashToken(token),
      status: "subscribed",
    })

    const subscription = matches[0]
    if (!subscription) {
      return res.status(200).send(
        page("Subscription already updated", "This link is invalid or your subscription has already been cancelled.")
      )
    }

    await newsletter.updateNewsletterSubscriptions(
      { id: subscription.id },
      {
        status: "unsubscribed",
        unsubscribed_at: new Date(),
      }
    )

    return res.status(200).send(
      page("You are unsubscribed", "You will no longer receive Kitchen Gadget Shops newsletter emails.")
    )
  } catch (error) {
    console.error(
      "Newsletter unsubscribe failed:",
      error instanceof Error ? error.message : "Unknown error"
    )
    return res.status(500).send(
      page("Temporarily unavailable", "We couldn't update your subscription right now. Please try again later.")
    )
  }
}
