// Granny's Gift - script.js (full replacement)
// - Order and Newsletter are fully independent
// - Newsletter sends only {name, email, reply_to, submitted_at}
// - Clear success panel after Join the list

document.addEventListener('DOMContentLoaded', () => {
  // ====== CONFIG (update IDs only if you changed them in EmailJS) ======
  const CFG = {
    EMAILJS_PUBLIC_KEY: "fTkyrOb1GWzQ36JvY",
    EMAILJS_SERVICE_ID: "service_5axgx93",

    // Order emails (already working for you)
    EMAILJS_INTERNAL_TEMPLATE_ID: "template_fxankcs",     // internal order notification
    EMAILJS_AUTOREPLY_TEMPLATE_ID: "template_autoreply",  // customer confirmation (optional)

    // Newsletter email (new)
    EMAILJS_NEWSLETTER_TEMPLATE_ID: "template_newsletter",// internal notify to grannysgiftinc@gmail.com

    // Optional Google Apps Script endpoint for logging (leave empty to disable)
    GSHEETS_WEBAPP_URL: ""
  };

  // Init EmailJS once
  if (window.emailjs) {
    emailjs.init({ publicKey: CFG.EMAILJS_PUBLIC_KEY });
  } else {
    console.error("EmailJS SDK not loaded.");
  }

  // ===== UTIL =====
  const fmtUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const escapeHtml = (s='') => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c]));
  const setStatus = (el, msg, kind) => {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('ok', kind === 'ok');
    el.classList.toggle('error', kind === 'error');
  };

  // ====================================================================
  // ORDER FLOW (unchanged except small hardening)
  // ====================================================================
  const orderForm   = document.getElementById('orderForm');
  const nameEl      = document.getElementById('name');
  const phoneEl     = document.getElementById('phone');
  const emailEl     = document.getElementById('email');
  const sizeEl      = document.getElementById('size');
  const qtyEl       = document.getElementById('quantity');
  const msgEl       = document.getElementById('message');
  const hpEl        = document.getElementById('website'); // honeypot
  const countEl     = document.getElementById('charCount');
  const submitBtn   = document.getElementById('submitBtn');
  const statusEl    = document.getElementById('status');
  const successPane = document.getElementById('successPanel');
  let summaryEl     = document.getElementById('summary');

  if (orderForm) {
    // Character counter
    if (msgEl && countEl) {
      const syncCount = () => (countEl.textContent = `${msgEl.value.length}/300`);
      msgEl.addEventListener('input', syncCount); syncCount();
    }

    // Live total
    let totalEl = document.getElementById('orderTotal');
    if (!totalEl) {
      const row = document.createElement('div');
      row.className = 'total-row';
      totalEl = document.createElement('div');
      totalEl.id = 'orderTotal';
      totalEl.className = 'total-box';
      totalEl.textContent = 'Estimated total: —';
      row.appendChild(totalEl);
      orderForm.insertBefore(row, submitBtn);
    }
    const getPriceForSize = () => {
      const opt = sizeEl?.options?.[sizeEl.selectedIndex];
      const p = parseFloat(opt?.dataset?.price);
      if (Number.isFinite(p)) return p;
      const label = (opt?.textContent || '').toLowerCase();
      if (label.includes('whole'))   return 34.99;
      if (label.includes('cupcake')) return 5.99;
      return 0;
    };
    const updateTotalUI = () => {
      const sizePicked = !!sizeEl?.value;
      const qtyPicked  = !!qtyEl?.value;
      if (sizePicked && qtyPicked) {
        const qty = Number(qtyEl.value);
        const priceEach = getPriceForSize();
        if (priceEach > 0 && qty > 0) {
          totalEl.textContent = `Estimated total: ${fmtUSD.format(priceEach * qty)}`;
          return;
        }
      }
      totalEl.textContent = 'Estimated total: —';
    };

    // Enable/disable submit
    const requiredEls = [nameEl, phoneEl, emailEl, sizeEl, qtyEl];
    const allRequiredFilled = () =>
      requiredEls.every(el => !!(el && (el.value || '').trim())) &&
      (emailEl?.checkValidity?.() ?? true);
    const updateSubmitState = () => {
      const ready = allRequiredFilled();
      submitBtn.disabled = !ready;
      submitBtn.classList.toggle('ready', ready);
    };

    [nameEl, phoneEl, emailEl, sizeEl, qtyEl].forEach(el => {
      el?.addEventListener('input', () => { updateSubmitState(); updateTotalUI(); });
      el?.addEventListener('change', () => { updateSubmitState(); updateTotalUI(); });
    });
    updateSubmitState(); updateTotalUI();

    // Simple spam guards
    const pageLoadedAt = Date.now();
    const isSpammy = () => {
      if (hpEl?.value.trim()) return true;
      if (Date.now() - pageLoadedAt < 2500) return true;
      const last = Number(localStorage.getItem('gg_last_submit_ts') || 0);
      if (Date.now() - last < 45_000) return true;
      return false;
    };
    const markSubmittedNow = () => localStorage.setItem('gg_last_submit_ts', String(Date.now()));

    // Submit
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!allRequiredFilled()) { setStatus(statusEl, 'Please fill in all required fields.', 'error'); return; }
      if ((msgEl.value || '').length > 300) { setStatus(statusEl, 'Message must be 300 characters or fewer.', 'error'); return; }
      if (isSpammy()) { setStatus(statusEl, 'Something went wrong. Please try again in a moment.', 'error'); return; }
      if (!window.emailjs) { setStatus(statusEl, "Email system isn't loaded. Please refresh.", 'error'); return; }

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
        total: Number.isFinite(total) ? fmtUSD.format(total) : '—',
        message: message || '(no message)',
        submitted_at: new Date().toLocaleString(),
        reply_to: fromEmail,
        from_name: name
      };
      const autoReplyParams = {
        to_email: fromEmail, name, size, quantity,
        price_each: fmtUSD.format(priceEach),
        total: Number.isFinite(total) ? fmtUSD.format(total) : '—',
        submitted_at: new Date().toLocaleString()
      };

      try {
        submitBtn.disabled = true; submitBtn.classList.remove('ready');
        setStatus(statusEl, 'Sending…');

        await emailjs.send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_INTERNAL_TEMPLATE_ID, internalParams);

        // optional customer confirmation
        if (CFG.EMAILJS_AUTOREPLY_TEMPLATE_ID) {
          emailjs.send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_AUTOREPLY_TEMPLATE_ID, autoReplyParams).catch(()=>{});
        }

        // optional log
        if (CFG.GSHEETS_WEBAPP_URL) {
          fetch(CFG.GSHEETS_WEBAPP_URL, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              type:'order',
              name, email: fromEmail, phone, size,
              price_each: priceEach, quantity: Number(quantity || 0), total,
              message, submitted_at: new Date().toISOString()
            })
          }).catch(()=>{});
        }

        // Success UI
        if (!summaryEl) { summaryEl = document.createElement('div'); summaryEl.id = 'summary'; }
        summaryEl.innerHTML = `
          <dl>
            <dt>Name</dt><dd>${escapeHtml(name)}</dd>
            <dt>Email</dt><dd>${escapeHtml(fromEmail)}</dd>
            <dt>Phone</dt><dd>${escapeHtml(phone)}</dd>
            <dt>Size</dt><dd>${escapeHtml(size)} (${fmtUSD.format(priceEach)})</dd>
            <dt>Quantity</dt><dd>${escapeHtml(quantity)}</dd>
            <dt>Total</dt><dd>${Number.isFinite(total) ? fmtUSD.format(total) : '—'}</dd>
            <dt>Message</dt><dd>${escapeHtml(message || '(no message)')}</dd>
          </dl>`;
        if (successPane) { successPane.hidden = false; successPane.appendChild(summaryEl); }
        orderForm.hidden = true;
        setStatus(statusEl, '', '');
        markSubmittedNow();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error('Order send failed:', err);
        setStatus(statusEl, 'Inquiry failed. Please try again.', 'error');
        submitBtn.disabled = false;
        updateSubmitState();
      }
    });
  }

  // ====================================================================
  // NEWSLETTER (independent)
  // ====================================================================
  const nSection = document.getElementById('newsletter');   // wrapper section
  const nForm    = document.getElementById('newsletterForm');
  const nlName   = document.getElementById('nl_name');      // optional
  const nlEmail  = document.getElementById('nl_email');     // required
  const nlHP     = document.getElementById('nl_website');   // honeypot
  const nlBtn    = document.getElementById('nl_submit');    // button

  if (nForm) {
    const ready = () => !!nlEmail?.value && nlEmail.checkValidity();
    const updateBtn = () => { if (nlBtn) { nlBtn.disabled = !ready(); nlBtn.classList.toggle('ready', ready()); } };
    nlEmail?.addEventListener('input', updateBtn); updateBtn();

    nForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (nlHP?.value.trim()) return;      // spam bot
      if (!ready()) return;
      if (!window.emailjs) { console.error("EmailJS not loaded for newsletter."); return; }

      const name  = (nlName?.value || '').trim();
      const email = nlEmail.value.trim();

      // Minimal params — ONLY what your template uses
      const params = {
        name,
        email,
        reply_to: email,
        submitted_at: new Date().toLocaleString()
      };

      try {
        if (nlBtn) { nlBtn.disabled = true; nlBtn.classList.remove('ready'); }

        await emailjs.send(
          CFG.EMAILJS_SERVICE_ID,
          CFG.EMAILJS_NEWSLETTER_TEMPLATE_ID,
          params
        );

        // Success confirmation (replace form with green panel)
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

        // Optional log (kept separate from orders)
        if (CFG.GSHEETS_WEBAPP_URL) {
          fetch(CFG.GSHEETS_WEBAPP_URL, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              type:'newsletter',
              name, email,
              submitted_at: new Date().toISOString()
            })
          }).catch(()=>{});
        }
      } catch (err) {
        console.error('Newsletter send failed:', err);
        const fail = document.createElement('p');
        fail.className = 'status error';
        fail.textContent = 'Could not join right now. Please try again.';
        // Append once
        if (!nForm.querySelector('.status.error')) nForm.appendChild(fail);
        updateBtn();
      }
    });
  }
});

