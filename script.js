// script.js — enable/disable submit correctly, message optional, send via EmailJS
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    if (!form) return;

    // make sure native browser validation doesn't block our click UI
    form.setAttribute('novalidate', '');

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

    // live char counter (optional field)
    if (msgEl && countEl) {
      const updateCount = () => (countEl.textContent = `${msgEl.value.length}/300`);
      msgEl.addEventListener('input', updateCount);
      updateCount();
    }

    // ---- Enable/disable Submit based on required fields only (message is optional) ----
    const requiredEls = [nameEl, phoneEl, emailEl, sizeEl, qtyEl].filter(Boolean);

    function allRequiredFilled() {
      return requiredEls.every(el => {
        const v = (el.value || '').trim();
        // if it's a select, we also ensure the value isn't a placeholder like ""
        return v.length > 0 && (el.validity ? el.validity.valid : true);
      });
    }
    function updateSubmitState() {
      if (!submitBtn) return;
      submitBtn.disabled = !allRequiredFilled();
      submitBtn.style.pointerEvents = submitBtn.disabled ? 'none' : 'auto';
      submitBtn.style.opacity = submitBtn.disabled ? '0.6' : '1';
    }
    // watch all required fields
    requiredEls.forEach(el => {
      el.addEventListener('input', updateSubmitState);
      el.addEventListener('change', updateSubmitState);
    });
    updateSubmitState(); // set initial state

    // ---- EmailJS wiring (public keys are ok client-side) ----
    fetch('email-config.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(cfg => {
        if (!window.emailjs) throw new Error('EmailJS SDK not loaded');
        emailjs.init({ publicKey: cfg.EMAILJS_PUBLIC_KEY });

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          setStatus('');

          // re-check required fields at submit time
          if (!allRequiredFilled()) {
            setStatus('Please fill in all required fields.', 'error');
            return;
          }

          // gather values
          const name = (nameEl?.value || '').trim();
          const phone = (phoneEl?.value || '').trim();
          const fromEmail = (emailEl?.value || '').trim();
          const size = (sizeEl?.value || '').trim();
          const quantity = (qtyEl?.value || '').trim();
          const message = (msgEl?.value || '').trim();

          if (message.length > 300) {
            return setStatus('Message must be 300 characters or fewer.', 'error');
          }

          // NOTE: recipients now live in the EmailJS template "To" field (static)
          const params = {
            name,
            phone,
            email: fromEmail,
            size,
            quantity,
            message: message || '(no message)',
            submitted_at: new Date().toLocaleString(),
            // nice to have:
            reply_to: fromEmail,
            from_name: name
          };

          try {
            submitBtn && (submitBtn.disabled = true);
            setStatus('Sending…');
            await emailjs.send(cfg.EMAILJS_SERVICE_ID, cfg.EMAILJS_TEMPLATE_ID, params);
            setStatus('Thanks! Your order was sent. We’ll be in touch soon.', 'ok');
            form.reset();
            if (countEl) countEl.textContent = '0/300';
          } catch (err) {
            console.error(err);
            setStatus('Sorry—something went wrong sending your message. Please try again.', 'error');
          } finally {
            updateSubmitState(); // restore proper enabled/disabled state after send
          }
        });
      })
      .catch(err => {
        console.error(err);
        setStatus('Email is not configured yet. Add a valid email-config.json.', 'error');
      });

    function setStatus(msg, kind) {
      statusEl.textContent = msg;
      statusEl.style.color = kind === 'error' ? '#b00020' : (kind === 'ok' ? '#0a7d0a' : '#333');
    }
  });
})();

