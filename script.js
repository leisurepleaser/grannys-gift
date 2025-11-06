// script.js — order flow unchanged; newsletter = email-only; no wallpaper logic anywhere.
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    // ====== CONFIG ======
    const CFG = {
      EMAILJS_PUBLIC_KEY: "fTkyrOb1GWzQ36JvY",
      EMAILJS_SERVICE_ID: "service_5axgx93",
      EMAILJS_INTERNAL_TEMPLATE_ID: "template_fxankcs",     // internal order notification
      EMAILJS_AUTOREPLY_TEMPLATE_ID: "template_autoreply",  // order auto-reply (To={{to_email}})
      EMAILJS_NEWSLETTER_TEMPLATE_ID: "template_newsletter",// newsletter signups (email-only)
      GSHEETS_WEBAPP_URL: ""                                // optional logging
    };
    // =====================

    const form      = document.getElementById('orderForm');
    if (!form) return;

    // Order inputs
    const nameEl    = document.getElementById('name');
    const phoneEl   = document.getElementById('phone');
    const emailEl   = document.getElementById('email');
    const sizeEl    = document.getElementById('size');
    const qtyEl     = document.getElementById('quantity');
    const msgEl     = document.getElementById('message');
    const hpEl      = document.getElementById('website');
    const countEl   = document.getElementById('charCount');
    const submitBtn = document.getElementById('submitBtn');
    const statusEl  = document.getElementById('status');

    // Success + summary (ensure exist)
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
    if (!summaryEl) { summaryEl = document.createElement('div'); summaryEl.id = 'summary'; successPanel.appendChild(summaryEl); }

    // Live total UI (ensure exists)
    let totalEl = document.getElementById('orderTotal');
    if (!totalEl) {
      const row = document.createElement('div');
      row.className = 'total-row';
      totalEl = document.createElement('div');
      totalEl.id = 'orderTotal';
      totalEl.className = 'total-box';
      totalEl.textContent = 'Estimated total: —';
      row.appendChild(totalEl);
      form.insertBefore(row, submitBtn);
    }

    const fmtUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

    function setStatus(msg, kind) {
      if (!statusEl) return;
      statusEl.textContent = msg || '';
      statusEl.classList.toggle('ok', kind === 'ok');
      statusEl.classList.toggle('error', kind === 'error');
    }

    // Char counter
    if (msgEl && countEl) {
      const updateCount = () => (countEl.textContent = `${msgEl.value.length}/300`);
      msgEl.addEventListener('input', updateCount); updateCount();
    }

    // Enable/disable submit
    const requiredEls = [nameEl, phoneEl, emailEl, sizeEl, qtyEl];
    function allRequiredFilled() {
      const hasVal = el => !!(el && (el.value || '').trim());
      const emailOk = emailEl?.checkValidity?.() ?? true;
      return requiredEls.every(hasVal) && emailOk;
    }
    function updateSubmitState() {
      const ready = allRequiredFilled();
      submitBtn.disabled = !ready;
      submitBtn.classList.toggle('ready', ready);
    }

    // Prices
    function getPriceForSize() {
      const opt = sizeEl.options[sizeEl.selectedIndex];
      const p = parseFloat(opt?.dataset?.price);
      if (Number.isFinite(p)) return p;
      const label = (opt?.textContent || '').toLowerCase();
      if (label.includes('whole'))   return 34.99;
      if (label.includes('cupcake')) return 5.99;
      return 0;
    }
    function updateTotalUI() {
      if (!totalEl) return;
      const sizePicked = !!sizeEl.value;
      const qtyPicked  = !!qtyEl.value;
      if (sizePicked && qtyPicked) {
        const qty = Number(qtyEl.value);
        const priceEach = getPriceForSize();
        if (priceEach > 0 && qty > 0) { totalEl.textContent = `Estimated total: ${fmtUSD.format(priceEach * qty)}`; return; }
      }
      totalEl.textContent = 'Estimated total: —';
    }

    // FORCE Quantity to 1–20
    (function enforceQuantityMax(max = 20) {
      const el = document.getElementById('quantity');
      if (!el) return;
      const prev = parseInt(el.value, 10);
      let html = '<option value="" selected disabled>Choose qty…</option>';
      for (let i = 1; i <= max; i++) html += `<option value="${i}">${i}</option>`;
      el.innerHTML = html;
      if (Number.isInteger(prev) && prev >= 1 && prev <= max) el.value = String(prev);
    })();

    [nameEl, phoneEl, emailEl, sizeEl, qtyEl].forEach(el => {
      el.addEventListener('input', () => { updateSubmitState(); updateTotalUI(); });
      el.addEventListener('change', () => { updateSubmitState(); updateTotalUI(); });
    });
    updateSubmitState(); updateTotalUI();

    // Spam guards
    const pageLoadedAt = Date.now();
    function isSpammy() {
      if (hpEl?.value.trim()) return true;
      if (Date.now() - pageLoadedAt < 2500) return true;
      const last = Number(localStorage.getItem('gg_last_submit_ts') || 0);
      if (Date.now() - last < 45_000) return true;
      return false;
    }
    function markSubmittedNow(){ localStorage.setItem('gg_last_submit_ts', String(Date.now())); }

    // EmailJS
    if (!window.emailjs) { setStatus("Email system isn't loaded. Please refresh.", 'error'); return; }
    emailjs.init({ publicKey: CFG.EMAILJS_PUBLIC_KEY });

    // ORDER submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
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

      const internalParams = {
        name, phone, email: fromEmail, size, quantity,
        price_each: fmtUSD.format(priceEach),
        total: isFinite(total) ? fmtUSD.format(total) : '—',
        message: message || '(no message)',
        submitted_at: new Date().toLocaleString(),
        reply_to: fromEmail,
        from_name: name
      };
      const autoReplyParams = {
        to_email: fromEmail, name, size, quantity,
        price_each: fmtUSD.format(priceEach),
        total: isFinite(total) ? fmtUSD.format(total) : '—',
        submitted_at: new Date().toLocaleString()
      };

      try {
        submitBtn.disabled = true; submitBtn.classList.remove('ready');
        setStatus('Sending…');

        await emailjs.send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_INTERNAL_TEMPLATE_ID, internalParams);
        if (CFG.EMAILJS_AUTOREPLY_TEMPLATE_ID) {
          emailjs.send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_AUTOREPLY_TEMPLATE_ID, autoReplyParams).catch(()=>{});
        }
        if (CFG.GSHEETS_WEBAPP_URL) {
          fetch(CFG.GSHEETS_WEBAPP_URL, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              name, email: fromEmail, phone, size,
              price_each: priceEach, quantity: Number(quantity || 0), total,
              message, submitted_at: new Date().toISOString()
            })
          }).catch(()=>{});
        }

        renderSummary({ name, email: fromEmail, phone, size, quantity, priceEach, total, message });
        form.hidden = true; successPanel.hidden = false; setStatus('', ''); markSubmittedNow();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error(err); setStatus('Inquiry failed. Please try again.', 'error'); updateSubmitState();
      }
    });

    function renderSummary({ name, email, phone, size, quantity, priceEach, total, message }) {
      summaryEl.innerHTML = `
        <dl>
          <dt>Name</dt><dd>${escapeHtml(name)}</dd>
          <dt>Email</dt><dd>${escapeHtml(email)}</dd>
          <dt>Phone</dt><dd>${escapeHtml(phone)}</dd>
          <dt>Size</dt><dd>${escapeHtml(size)} (${fmtUSD.format(priceEach)})</dd>
          <dt>Quantity</dt><dd>${escapeHtml(quantity)}</dd>
          <dt>Total</dt><dd>${isFinite(total) ? fmtUSD.format(total) : '—'}</dd>
          <dt>Message</dt><dd>${escapeHtml(message || '(no message)')}</dd>
        </dl>`;
    }
    function escapeHtml(s=''){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c])); }

      // ===== NEWSLETTER: send email + show confirmation =====
      (() => {
        const nWrap    = document.getElementById('newsletter');      // section wrapper
        const nForm    = document.getElementById('newsletterForm');
        const nlName   = document.getElementById('nl_name');
        const nlEmail  = document.getElementById('nl_email');
        const nlHP     = document.getElementById('nl_website');      // honeypot
        const nlBtn    = document.getElementById('nl_submit');

        if (!nForm || !window.emailjs) return;

        // Ensure your template ID is set
        if (!CFG.EMAILJS_NEWSLETTER_TEMPLATE_ID) {
          CFG.EMAILJS_NEWSLETTER_TEMPLATE_ID = "template_p7tmtwl";
        }

        const ready = () => !!nlEmail?.value && nlEmail.checkValidity();
        const updateBtn = () => { nlBtn.disabled = !ready(); nlBtn.classList.toggle('ready', ready()); };
        nlEmail?.addEventListener('input', updateBtn);
        updateBtn();

        function escapeHtml(s=''){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c])); }

        nForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (nlHP?.value.trim()) return;     // bot caught
          if (!ready()) return;

          const name  = (nlName?.value || '').trim();
          const email = nlEmail.value.trim();

          // Build params for template_newsletter
          const params = {
            name,
            email,
            reply_to: email,                          // makes replies go to subscriber
            submitted_at: new Date().toLocaleString(),
            user_agent: navigator.userAgent,
            page: location.href
          };

          try {
            nlBtn.disabled = true; nlBtn.classList.remove('ready');

            await emailjs.send(
              CFG.EMAILJS_SERVICE_ID,
              CFG.EMAILJS_NEWSLETTER_TEMPLATE_ID,
              params
            );

            // Replace form with a success confirmation (same styling as order success)
            const success = document.createElement('div');
            success.className = 'success-panel';
            success.innerHTML = `
              <div class="check">✓</div>
              <h3>You’re on the list!</h3>
              <p>Thanks${name ? `, <strong>${escapeHtml(name)}</strong>` : ''}. We added
                 <strong>${escapeHtml(email)}</strong> to our newsletter.</p>
              <p class="muted tiny">You can unsubscribe anytime via a link in any email.</p>
            `;
            nForm.replaceWith(success);

            // (optional) also log to the same Google Sheet if you configured CFG.GSHEETS_WEBAPP_URL
            if (CFG.GSHEETS_WEBAPP_URL) {
              fetch(CFG.GSHEETS_WEBAPP_URL, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                  type: 'newsletter',
                  name, email,
                  submitted_at: new Date().toISOString(),
                  page: location.href,
                  ua: navigator.userAgent
                })
              }).catch(()=>{});
            }
          } catch (err) {
            console.error('Newsletter send failed:', err);
            // Gentle inline fallback message
            const fail = document.createElement('p');
            fail.className = 'status error';
            fail.textContent = 'Could not join right now. Please try again.';
            // Append once
            if (!nForm.querySelector('.status.error')) nForm.appendChild(fail);
            updateBtn();
          }
        });
      })();


  });
})();

