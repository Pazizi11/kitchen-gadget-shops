import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import nodemailer from "nodemailer"
import { createHash, randomBytes } from "node:crypto"

const PUBLIC_API_URL = (
  process.env.NEWSLETTER_PUBLIC_API_URL ||
  "https://api.bykitchengadgetshops.com"
).replace(/\/+$/, "")

function clean(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]!)
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Record<string, unknown>

  // Silently accept honeypot submissions without storing or emailing them.
  if (clean(body.website, 200)) {
    return res.status(200).json({
      subscribed: true,
      message: "Thank you for your interest.",
    })
  }

  const email = clean(body.email, 254).toLowerCase()
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[\r\n]/.test(email)
  ) {
    return res.status(400).json({
      message: "Please enter a valid email address.",
    })
  }

  const newsletter = req.scope.resolve("newsletter") as any

  try {
    const matches = await newsletter.listNewsletterSubscriptions({ email })
    let subscription = matches[0]
    let token: string

    if (subscription?.status === "subscribed") {
      return res.status(200).json({
        subscribed: true,
        alreadySubscribed: true,
        message: "This email is already subscribed.",
      })
    }

    token = randomBytes(32).toString("hex")
    const tokenHash = hashToken(token)

    if (subscription) {
      subscription = await newsletter.updateNewsletterSubscriptions(
        { id: subscription.id },
        {
          status: "subscribed",
          unsubscribe_token_hash: tokenHash,
          welcome_email_status: "pending",
          welcome_email_sent_at: null,
          unsubscribed_at: null,
        }
      )
    } else {
      subscription = await newsletter.createNewsletterSubscriptions({
        email,
        status: "subscribed",
        unsubscribe_token_hash: tokenHash,
        welcome_email_status: "pending",
      })
    }

    // The subscription is saved before attempting email delivery.
    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT || 465)
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const secure = (process.env.SMTP_SECURE || "true").toLowerCase() === "true"

    try {
      if (!host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("Required SMTP settings are missing.")
      }

      const unsubscribeUrl =
        `${PUBLIC_API_URL}/store/newsletter/unsubscribe?token=${encodeURIComponent(token)}`

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      })

      await transporter.sendMail({
        from: user,
        to: email,
        subject: "Welcome to Kitchen Gadget Shops",
        text: [
          "Thanks for subscribing to Kitchen Gadget Shops!",
          "",
          "We'll send you updates about new kitchen gadgets and special offers.",
          "",
          "To unsubscribe, open this link and confirm your choice:",
          unsubscribeUrl,
          "",
          "Kitchen Gadget Shops",
        ].join("\n"),
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#12294A;max-width:600px;margin:auto">
            <h2>Welcome to Kitchen Gadget Shops!</h2>
            <p>Thanks for subscribing.</p>
            <p>We'll send you updates about new kitchen gadgets and special offers.</p>
            <p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from these emails</a></p>
            <p>Happy cooking!<br>Kitchen Gadget Shops</p>
          </div>
        `,
      })

      await newsletter.updateNewsletterSubscriptions(
        { id: subscription.id },
        {
          welcome_email_status: "sent",
          welcome_email_sent_at: new Date(),
        }
      )
    } catch (mailError) {
      console.error(
        "Newsletter welcome email failed:",
        mailError instanceof Error ? mailError.message : "Unknown email error"
      )

      try {
        await newsletter.updateNewsletterSubscriptions(
          { id: subscription.id },
          { welcome_email_status: "failed" }
        )
      } catch (statusError) {
        console.error(
          "Could not update newsletter email status:",
          statusError instanceof Error ? statusError.message : "Unknown status error"
        )
      }
    }

    return res.status(200).json({
      subscribed: true,
      message: "Thanks for subscribing!",
    })
  } catch (error) {
    console.error(
      "Newsletter subscription failed:",
      error instanceof Error ? error.message : "Unknown subscription error"
    )
    return res.status(500).json({
      message: "We couldn't save your subscription right now. Please try again later.",
    })
  }
}
