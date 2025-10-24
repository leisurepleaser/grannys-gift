// script.js — quantity forced to 1–20, live total, yellow+red-border UX, spam guard,
// internal email + auto-reply, optional Sheets logging, and a post-submit summary.
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    // ====== EDIT THESE IF YOUR EMAILJS IDs ARE DIFFERENT ======
    const CFG = {
      EMAILJS_PUBLIC_KEY: "fTkyrOb1GWzQ36JvY",
      EMAILJS_SERVICE_ID: "service_5axgx93",
      EMAILJS_INTERNAL_TEMPLATE_ID: "template_fxankcs",    // goes to your two inboxes (set in Template "To")
      EMAILJS_AUTOREPLY_TEMPLATE_ID: "template_autoreply", // To must be {{to_email}}
      GSHEETS_WEBAPP_URL: ""                                // optional: paste your Apps Script Web App URL
    };
    // =========================================================

    const form      = document.getElementById('orderForm');
    if (!form) return;

    // Inputs
    const nameEl    = document.getElementById('name');
    const phoneEl   = document.getElementById('phone');
    const emailEl   = document.getElementById('email');
    const sizeEl    = document.getElementById('size');
    const qtyEl     = document.getElementById('quantity');
    const msgEl     = document.getElementById('message');
    const hpEl      = document.getElementById('website'); // honeypot
    const countEl   = document.getElementById('charCount');
    const submitBtn = document.getElementById('submitBtn');
    const statusEl  = document.getElementById('status');

    // Success panel + summary (create if missing so feature works regardless of HTML)
    let successPanel = document.getElementById('successPanel');
    let summaryEl    = document.getElementById('summary');
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

    // ---- Ensure the "Estimated total" UI exists just above the Submit button ----
    let totalEl = document.getElementById('orderTotal');
    if (!totalEl) {
      const row = document.createElement('div');
      row.className = 'total-row';
      totalEl = document.createElement('div');
      totalEl.id = 'orderTotal';
      totalEl.className = 'total-box';
      totalEl.textContent = 'Estimated total: —';
      // Inline fallback styles (in case CSS wasn’t added)
      totalEl.style.background = totalEl.style.background || '#fff8e1';
      totalEl.style.border = totalEl.style.border || '1px solid #ffe082';
      totalEl.style.borderRadius = totalEl.style.borderRadius || '10px';
      totalEl.style.padding = totalEl.style.padding || '8px 12px';
      totalEl.style.fontWeight = totalEl.style.fontWeight || '700';
      row.style.display = row.style.display || 'flex';
      row.style.justifyContent = row.style.justifyContent || 'flex-end';
      row.style.margin = row.style.margin || '10px 0 8px';
      row.appendChild(totalEl);
      if (submitBtn && submitBtn.parentNode) submitBtn.parentNode.insertBefore(row, submitBtn);
      else form.appendChild(row);
    }

    // Currency formatter
    const fmtUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

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

    // ---- Price helpers ----
    function getPriceForSize() {
      // 1) Prefer data-price on the selected <option>
      const opt = sizeEl.options[sizeEl.selectedIndex];
      let price = parseFloat(opt?.dataset?.price);
      if (Number.isFinite(price)) return price;
      // 2) Fallback by label text (in case HTML options lack data-price)
      const label = (opt?.textContent || '').toLowerCase();
      if (label.includes('whole'))   return 34.99;
      if (label.includes('cupcake')) return 5.99;
      return 0;
    }

    function updateTotalUI() {
      if (!totalEl) return;
      const sizePicked = !!(sizeEl && sizeEl.value);
      const qtyPicked  = !!(qtyEl && qtyEl.value);
      if (sizePicked && qtyPicked) {
        const qty = Number((qtyEl.value || '').trim());
        const priceEach = getPriceForSize();
        if (priceEach > 0 && qty > 0) {
          const total = priceEach * qty;
          totalEl.textContent = `Estimated total: ${fmtUSD.format(total)}`;
          return;
        }
      }
      totalEl.textContent = 'Estimated total: —';
    }

    // ---- FORCE Quantity dropdown to 1–20 (overrides any old HTML) ----
    (function enforceQuantityMax(max = 20) {
      const el = document.getElementById('quantity') || document.querySelector('select[name="quantity"]');
      if (!el) return;
      const prev = parseInt(el.value, 10);
      let html = '<option value="" selected disabled>Choose qty…</option>';
      for (let i = 1; i <= max; i++) html += `<option value="${i}">${i}</option>`;
      el.innerHTML = html;
      if (Number.isInteger(prev) && prev >= 1 && prev <= max) el.value = String(prev);
    })();

    // Watch inputs and selects; update both button state and total
    requiredEls.forEach(el => {
      el.addEventListener('input', () => { updateSubmitState(); updateTotalUI(); });
      el.addEventListener('change', () => { updateSubmitState(); updateTotalUI(); });
    });
    // initialize once on load
    updateSubmitState();
    updateTotalUI();

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

      const name      = nameEl.value.trim();
      const phone     = phoneEl.value.trim();
      const fromEmail = emailEl.value.trim();
      const size      = sizeEl.value.trim();
      const quantity  = qtyEl.value.trim();
      const message   = (msgEl.value || '').trim();
      const priceEach = getPriceForSize();
      const total     = priceEach * Number(quantity || 0);

      // Params for internal notification (recipients STATIC in EmailJS Template “To”)
      const internalParams = {
        name, phone, email: fromEmail, size, quantity,
        price_each: fmtUSD.format(priceEach),
        total: isFinite(total) ? fmtUSD.format(total) : '—',
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
        price_each: fmtUSD.format(priceEach),
        total: isFinite(total) ? fmtUSD.format(total) : '—',
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
              price_each: priceEach, quantity: Number(quantity || 0), total,
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
          <dt>Size</dt><dd>${escapeHtml(size)} ${priceEach ? `(${fmtUSD.format(priceEach)})` : ''}</dd>
          <dt>Quantity</dt><dd>${escapeHtml(quantity)}</dd>
          <dt>Total</dt><dd>${isFinite(total) ? fmtUSD.format(total) : '—'}</dd>
          <dt>Message</dt><dd>${escapeHtml(message || '(no message)')}</dd>
        </dl>`;
    }
    function escapeHtml(s=''){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c])); }
  });
})();

