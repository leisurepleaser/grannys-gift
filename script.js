cat > script.js <<'JS'
// script.js — sends the form via EmailJS
(function () {
  const form = document.querySelector('form');
  const nameEl = document.querySelector('#name');
  const phoneEl = document.querySelector('#phone');
  const emailEl = document.querySelector('#email');
  const sizeEl = document.querySelector('#size');
  const qtyEl = document.querySelector('#quantity');
  const msgEl = document.querySelector('#message');
  const countEl = document.querySelector('#charCount');

  const statusEl = document.createElement('div');
  statusEl.id = 'status';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  statusEl.style.marginTop = '12px';
  form.appendChild(statusEl);

  // live char counter (0/300)
  if (msgEl && countEl) {
    const updateCount = () => (countEl.textContent = `${msgEl.value.length}/300`);
    msgEl.addEventListener('input', updateCount);
    updateCount();
  }

  // load config then init + bind submit
  fetch('email-config.json')
    .then(r => r.json())
    .then(cfg => {
      if (!window.emailjs) throw new Error('EmailJS SDK not loaded');
      emailjs.init({ publicKey: cfg.EMAILJS_PUBLIC_KEY });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setStatus('');

        // basic validation
        const name = (nameEl?.value || '').trim();
        const phone = (phoneEl?.value || '').trim();
        const email = (emailEl?.value || '').trim();
        const size = (sizeEl?.value || '').trim();
        const quantity = (qtyEl?.value || '').trim();
        const message = (msgEl?.value || '').trim();

        if (!name || !phone || !email || !size || !quantity) {
          return setStatus('Please fill in all required fields.', 'error');
        }
        if (message.length > 300) {
          return setStatus('Message must be 300 characters or fewer.', 'error');
        }

        const params = {
          to_email: cfg.TO_EMAILS,
          name, phone, email, size, quantity,
          message: message || '(no message)',
          submitted_at: new Date().toLocaleString()
        };

        setStatus('Sending…');
        try {
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
      setStatus('Email is not configured yet. Please add email-config.json.', 'error');
    });

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.style.color = kind === 'error' ? '#b00020' : (kind === 'ok' ? '#0a7d0a' : '#333');
  }
})();
JS

