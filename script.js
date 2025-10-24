// script.js — message optional; enable/disable submit; send via EmailJS (inline config)
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    if (!form) return;

    // Inline EmailJS config (public key is safe client-side)
    const CFG = {
      EMAILJS_PUBLIC_KEY: "fTkyrOb1GWzQ36JvY",
      EMAILJS_SERVICE_ID: "service_5axgx93",
      EMAILJS_TEMPLATE_ID: "template_fxankcs"
    };

    // IDs expected in the form
    const nameEl = document.getElementById('name');
    const phoneEl = document.getElementById('phone');
    const emailEl = document.getElementById('email');
    const sizeEl = document.getElementById('size');
    const qtyEl = document.getElementById('quantity');
    const msgEl = document.getElementById('message');
    const countEl = document.getElementById('charCount');
    const submitBtn = document.getElementById('submitBtn') || form.querySelector('[type="submit"]');

    // status region
    let statusEl = document.getElementById('status');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'status';
      statusEl.setAttribute('role', 'status');
      statusEl.setAttribute('aria-live', 'polite');
      statusEl.style.marginTop = '12px';
      form.appendChild(statusEl);
    }

    // optional message counter
    if (msgEl && countEl) {
      const updateCount = () => (countEl.textContent = `${msgEl.value.length}/300`);
      msgEl.addEventListener('input', updateCount);
      updateCount();
    }

    // enable/disable submit (message optional)
    const requiredEls = [nameEl, phoneEl, emailEl, sizeEl, qtyEl].filter(Boolean);
    function allRequiredFilled() {
      return requiredEls.every(el => {
        const v = (el.value || '').trim();
        return v.length > 0 && (el.validity ? el.validity.valid : true);
      });
    }
    function updateSubmitState() {
      if (!submitBtn) return;
      const ok = allRequiredFilled();
      submitBtn.disabled = !ok;
      submitBtn.style.pointerEvents = ok ? 'auto' : 'none';
      submitBtn.style.opacity = ok ? '1' : '0.6';
    }
    requiredEls.forEach(el => {
      el.addEventListener('input', updateSubmitState);
      el.addEventListener('change', updateSubmitState);
    });
    updateSubmitState();

    // EmailJS
    if (!window.emailjs) {
      setStatus('EmailJS SDK not loaded on this page.', 'error');
      return;
    }
    emailjs.init({ publicKey: CFG.EMAILJS_PUBLIC_KEY });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus('');

      if (!allRequiredFilled()) {
        setStatus('Please fill in all required fields.', 'error');
        return;
      }

      const name = (nameEl?.value || '').trim();
      const phone = (phoneEl?.value || '').trim();
      const fromEmail = (emailEl?.value || '').trim();
      const size = (sizeEl?.value || '').trim();
      const quantity = (qtyEl?.value || '').trim();
      const message = (msgEl?.value || '').trim();

      if (message.length > 300) {
        setStatus('Message must be 300 characters or fewer.', 'error');
        return;
      }

      // Recipients are set statically in your EmailJS template "To" field (recommended)
      const params = {
        name,
        phone,
        email: fromEmail,
        size,
        quantity,
        message: message || '(no message)',
        submitted_at: new Date().toLocaleString(),
        reply_to: fromEmail,
        from_name: name
      };

      try {
        if (submitBtn) submitBtn.disabled = true;
        setStatus('Sending…');
        await emailjs.send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_TEMPLATE_ID, params);
        setStatus('Thanks! Your order was sent. We’ll be in touch soon.', 'ok');
        form.reset();
        if (countEl) countEl.textContent = '0/300';
      } catch (err) {
        console.error(err);
        setStatus('Sorry—something went wrong sending your message. Please try again.', 'error');
      } finally {
        updateSubmitState();
      }
    });

    function setStatus(msg, kind) {
      statusEl.textContent = msg;
      statusEl.style.color = kind === 'error' ? '#b00020' : (kind === 'ok' ? '#0a7d0a' : '#333');
    }
  });
})();
