# Granny’s Gift – Minimal Inquiry Form

A tiny, responsive, vanilla HTML/CSS/JS site for collecting simple inquiries and sending them via EmailJS. Designed for GitHub Pages hosting.

## Files
- `index.html` – single page app with the form and button
- `styles.css` – minimal styling
- `script.js` – validation + EmailJS logic
- `email-config.sample.json` – sample config; copy to `email-config.json` and fill in actual values
- (Optional) `email-config.json` – your real EmailJS keys (public) for client-side sending

## Behavior
- Required fields: **Name**, **Phone Number**, **Email**, **Size**, **Quantity**
- Button is **grey + disabled** until all required fields are filled and email is valid
- When valid: button turns **yellow** with a **bold red border**
- On click:
  - Button **immediately** reverts to **grey** and becomes **disabled**
  - Attempts to send email via EmailJS
  - Shows **“Granny's Gift <3”** on success or **“Inquiry failed”** on failure for ~2 seconds
- “Message (Optional)” is limited to 300 chars and shows a live counter

## EmailJS Setup
1. Create an account at **https://www.emailjs.com/**
2. Add an **Email Service** and connect your sending email.
3. Create a **Template** that includes variables: `name`, `phone`, `email`, `size`, `quantity`, `message`, `message_body`, `to_email_1`, `to_email_2`. Configure the template to send to both:
   - `grannysgiftinc@gmail.com`
   - `kylekelleyjr@gmail.com`
4. Get your **Public Key**, **Service ID**, and **Template ID** from EmailJS.
5. In EmailJS **Allowed Origins**, add your GitHub Pages URL (e.g., `https://USERNAME.github.io/REPO`).

## Add your config
1. Copy `email-config.sample.json` → **`email-config.json`**
2. Replace placeholders with your values:
   ```json
   {
     "EMAILJS_SERVICE_ID": "your_service_id",
     "EMAILJS_TEMPLATE_ID": "your_template_id",
     "EMAILJS_PUBLIC_KEY": "your_public_key"
   }
   ```
3. Commit the file (public keys are intended for client-side use).

## Publish on GitHub Pages
1. Create a new repo (e.g., `grannys-gift`) and add all files.
2. In GitHub: **Settings → Pages** → set **Branch** to `main` (or `master`) and **/root**.
3. Visit your site at `https://YOUR-USERNAME.github.io/grannys-gift/`.

## Access on Desktop & Mobile
- Open the GitHub Pages URL in any browser (desktop or phone).
- Fill all required fields; the button turns yellow with a red border.
- Press **Submit** to send. You’ll see a brief success or failure message.
- (Optional) Add to Home Screen:
  - **iOS (Safari):** Share → *Add to Home Screen*
  - **Android (Chrome):** ⋮ menu → *Add to Home screen*

## Notes
- If sending fails, verify keys in `email-config.json` and that your Pages URL is listed in EmailJS **Allowed Origins**.
- This repo intentionally uses only vanilla HTML/CSS/JS and a very simple layout for clarity and reliability.
