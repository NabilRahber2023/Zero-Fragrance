# ZEROØ FRAGRANCE — lightweight static website

A responsive website made with plain HTML, CSS, and Vanilla JavaScript. Product data is stored in `js/products.js`. Buy Now opens a form; submitting the form opens WhatsApp with a pre-filled order message.

## Configure your WhatsApp number

1. Open `js/app.js`.
2. Find `const WHATSAPP_NUMBER = "8801XXXXXXXXX";`
3. Replace the placeholder with your business WhatsApp number in international format, digits only. For Bangladesh, use `8801...` and omit the leading `0`, plus sign, spaces, and hyphens.
4. Save the file.

Until configured, the site intentionally will not send customers to a made-up number.

## Edit products

Open `js/products.js`. Replace the sample product names, prices, stock counts, descriptions, and image paths with your real product details.

For local product images, put files in `assets/products/` and set `image: "assets/products/your-image.jpg"` in the corresponding product entry.

Example:
`{ id: "noir", name: "Noir", price: 1250, stock: 25, description: "Bold. Elegant. Timeless.", family: "dark-art", image: "assets/products/noir.jpg", notes: "Woody and spicy" }`

If `image` is empty, a CSS bottle illustration is shown instead.

## Run locally

Open `index.html` in a modern browser. For a local server, use VS Code Live Server or another static file server.

## Hosting

Upload the files and folders inside this project to the document root of your existing static hosting account (often `public_html`). Connect your purchased domain through your hosting provider's dashboard.

## Important limitations

- This is a static storefront preview. It does not save orders to a database, reduce real stock, or provide an admin dashboard.
- WhatsApp click-to-chat opens a pre-filled message. The customer must press Send in WhatsApp.
- Product prices and stock are sample frontend data. Update them before publishing.
- The configured WhatsApp number is required before order submission works.
- Use HTTPS on your production domain.
