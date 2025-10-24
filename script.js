// script.js — shows a post-submit summary, keeps yellow+red-border UX,
// sends internal email + auto-reply, optional Sheets logging, and spam guard.
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    // ====== EDIT THESE IF YOUR EMAILJS IDs ARE DIFFERENT ======
    const CFG = {
      EMAILJS_PUBLIC_KEY: "fTkyrOb1GWzQ36JvY",
      EMAILJS_SERVICE_ID: "service_5axgx93",
      EMAILJS_INTERNAL_TEMPLATE_ID: "template_fxankcs",   // to your two inboxes (set in Template "To")
      EMAILJS_AUTOREPLY_TEMPLATE_ID: "template_autoreply",// To must be {{to_email}}
      GSHEETS_WEBAPP_URL: ""                               // optional: paste your Apps Script Web App URL
    };
    // =========================================================

    const form = document.getElementById('orderForm');
    if (!form) return;

    // Inputs
    const nameEl = document.getElementById('name');
    const phoneEl = document.getElementById('phone');
    const emailEl = document.getElementById('email');
    const sizeEl = document.getElementById('size');
    const qtyEl = document.getElementById('quantity');
    const msgEl = document.getElementById('message');
    const hpEl = document.getElementById('website'); // honeypot
    const countEl = document.getElementById('charCount');
    const submitBtn = document.getElementById('submitBtn');
    const statusEl = document.getElementById('status');

    // Success panel + summary (create if missing so this works even without HTML changes)
    let successPanel = document.getElementById('successPanel');
    let summaryEl = document.getElementById('summary');
    if (!successPanel) {
      successPanel = document.createElement('div');
      successPanel.id = 'successPanel';
      successPanel.hidden = true;
      successPanel.innerHTML = `
        <h2>Thank you!</h2>
        <p>We’ve received your inquiry and sent you a confirmation email.
        We’ll reply within <strong>1–3 business days</strong>.</p>
        <div id="summary"></div>
        <p class="muted">Need to add details? Just reply to the confirmation email.</p>
      `;
      form.parentNode.insertBefore(successPanel, form);
    }
    if (!summaryEl) {
      summaryEl = document.createElement('div');
      summaryEl.id = 'summary';
      successPanel.appendChild(summaryEl);
    }

    // Status helper
    function setStatus(msg, kind) {
      if (!statusEl) return;
      statusEl.textContent = msg || '';
      statusEl.classList.toggle('ok', kind === 'ok');
      statusEl.classList.toggle('error', kind === 'error');
    }

    // Live char counter
    if (msgEl && countEl) {
      const updateCount = () => (countEl.textContent = `${msgEl.value.length}/300`);
      msgEl.addEventListener('input', updateCount);
      updateCount();
    }

    // Enable/disable submit (message optional)
    const requiredEls = [nameEl, phoneEl, emailEl, sizeEl, qtyEl];
    function allRequiredFilled() {
      const hasVal = el => !!(el && (el.value || '').trim());
      const emailOk = emailEl?.checkValidity?.() ?? true;
      return requiredEls.every(hasVal) && emailOk;
    }
    function updateSubmitState() {
      const ready = allRequiredFilled();
      submitBtn.disabled = !ready;
      submitBtn.classList.toggle('ready', ready); // yellow + red border when ready
    }
    requiredEls.forEach(el => {
      el.addEventListener('input', updateSubmitState);
      el.addEventListener('change', updateSubmitState);
    });
    updateSubmitState();

    // Spam guards: honeypot + min time + simple rate limit
    const pageLoadedAt = Date.now();
    function isSpammy() {
      if (hpEl && hpEl.value.trim() !== "") return true;           // honeypot filled
      if (Date.now() - pageLoadedAt < 2500) return true;           // submitted too fast (<2.5s)
      const last = Number(localStorage.getItem('gg_last_submit_ts') || 0);
      if (Date.now() - last < 45_000) return true;                 // throttle: 45s between submits
      return false;
    }
    function markSubmittedNow() {
      localStorage.setItem('gg_last_submit_ts', String(Date.now()));
    }

    // Price helper (from <option data-price>)
    function getPriceForSize() {
      const opt = sizeEl.options[sizeEl.selectedIndex];
      return parseFloat(opt?.dataset?.price || "0");
    }

    // EmailJS init
    if (!window.emailjs) {
      setStatus("Email system isn't loaded. Please refresh.", 'error');
      return;
    }
    emailjs.init({ publicKey: CFG.EMAILJS_PUBLIC_KEY });

    // Submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validation
      if (!allRequiredFilled()) { setStatus('Please fill in all required fields.', 'error'); return; }
      if ((msgEl.value || '').length > 300) { setStatus('Message must be 300 characters or fewer.', 'error'); return; }
      if (isSpammy()) { setStatus('Something went wrong. Please try again in a moment.', 'error'); return; }

      const name = nameEl.value.trim();
      const phone = phoneEl.value.trim();
      const fromEmail = emailEl.value.trim();
      const size = sizeEl.value.trim();
      const quantity = qtyEl.value.trim();
      const message = (msgEl.value || '').trim();
      const priceEach = getPriceForSize();
      const total = priceEach * Number(quantity || 0);

      // Params for internal notification (recipients STATIC in EmailJS Template “To”)
      const internalParams = {
        name, phone, email: fromEmail, size, quantity,
        price_each: `$${priceEach.toFixed(2)}`,
        total: isFinite(total) ? `$${total.toFixed(2)}` : '—',
        message: message || '(no message)',
        submitted_at: new Date().toLocaleString(),
        reply_to: fromEmail,
        from_name: name
      };

      // Params for auto-reply (Template “To” must be {{to_email}})
      const autoReplyParams = {
        to_email: fromEmail,
        name,
        size,
        quantity,
        price_each: `$${priceEach.toFixed(2)}`,
        total: isFinite(total) ? `$${total.toFixed(2)}` : '—',
        submitted_at: new Date().toLocaleString()
      };

      try {
        submitBtn.disabled = true;
        submitBtn.classList.remove('ready');
        setStatus('Sending…');

        // 1) Send to your team
        await emailjs.send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_INTERNAL_TEMPLATE_ID, internalParams);

        // 2) Auto-reply to customer (non-blocking)
        if (CFG.EMAILJS_AUTOREPLY_TEMPLATE_ID) {
          emailjs
            .send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_AUTOREPLY_TEMPLATE_ID, autoReplyParams)
            .catch(() => {}); // do not block success UI if auto-reply fails
        }

        // 3) Log to Google Sheets (optional)
        if (CFG.GSHEETS_WEBAPP_URL) {
          fetch(CFG.GSHEETS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name, email: fromEmail, phone, size,
              price_each: priceEach, quantity, total,
              message, submitted_at: new Date().toISOString()
            })
          }).catch(() => {});
        }

        // --- Success UI: render summary & show panel ---
        renderSummary({ name, email: fromEmail, phone, size, quantity, priceEach, total, message });
        form.hidden = true;
        successPanel.hidden = false;
        setStatus('', ''); // clear inline status (panel is the success now)
        markSubmittedNow();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error(err);
        setStatus('Inquiry failed. Please try again.', 'error');
        updateSubmitState();
      }
    });

    // Summary renderer
    function renderSummary({ name, email, phone, size, quantity, priceEach, total, message }) {
      summaryEl.innerHTML = `
        <dl>
          <dt>Name</dt><dd>${escapeHtml(name)}</dd>
          <dt>Email</dt><dd>${escapeHtml(email)}</dd>
          <dt>Phone</dt><dd>${escapeHtml(phone)}</dd>
          <dt>Size</dt><dd>${escapeHtml(size)} ${priceEach ? `($${priceEach.toFixed(2)})` : ''}</dd>
          <dt>Quantity</dt><dd>${escapeHtml(quantity)}</dd>
          <dt>Total</dt><dd>${isFinite(total) ? '$' + total.toFixed(2) : '—'}</dd>
          <dt>Message</dt><dd>${escapeHtml(message || '(no message)')}</dd>
        </dl>`;
    }
    function escapeHtml(s=''){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c])); }
  });
})();

