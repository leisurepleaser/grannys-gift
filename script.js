// script.js — send form via EmailJS (client-side)
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    if (!form) return;

    const nameEl = document.getElementById('name');
    const phoneEl = document.getElementById('phone');
    const emailEl = document.getElementById('email');
    const sizeEl = document.getElementById('size');
    const qtyEl = document.getElementById('quantity');
    const msgEl = document.getElementById('message');
    const countEl = document.getElementById('charCount');

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

    // live char counter
    if (msgEl && countEl) {
      const updateCount = () => (countEl.textContent = `${msgEl.value.length}/300`);
      msgEl.addEventListener('input', updateCount);
      updateCount();
    }

    // load config and wire submit
    fetch('email-config.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(cfg => {
        if (!window.emailjs) throw new Error('EmailJS SDK not loaded');
        emailjs.init({ publicKey: cfg.EMAILJS_PUBLIC_KEY });

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          setStatus('');

          const name = (nameEl?.value || '').trim();
          const phone = (phoneEl?.value || '').trim();
          const fromEmail = (emailEl?.value || '').trim();
          const size = (sizeEl?.value || '').trim();
          const quantity = (qtyEl?.value || '').trim();
          const message = (msgEl?.value || '').trim();

          if (!name || !phone || !fromEmail || !size || !quantity) {
            return setStatus('Please fill in all required fields.', 'error');
          }
          if (message.length > 300) {
            return setStatus('Message must be 300 characters or fewer.', 'error');
          }

          const params = {
            name,
            phone,
            email: fromEmail,
            size,
            quantity,
            message: message || '(no message)',
            submitted_at: new Date().toLocaleString()
          };

          try {
            setStatus('Sending…');
            await emailjs.send(cfg.EMAILJS_SERVICE_ID, cfg.EMAILJS_TEMPLATE_ID, params);
            setStatus('Thanks! Your order was sent. We’ll be in touch soon.', 'ok');
            form.reset();
            if (countEl) countEl.textContent = '0/300';
          } catch (err) {
            console.error(err);
            setStatus('Sorry—something went wrong sending your message. Please try again.', 'error');
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

