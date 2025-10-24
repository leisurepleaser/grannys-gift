// Fully self-contained: restores yellow button + red border when ready,
// keeps message optional, and sends via EmailJS.
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('orderForm');
    if (!form) return;

    // Inline EmailJS config (public key is safe to ship)
    const CFG = {
      EMAILJS_PUBLIC_KEY: "fTkyrOb1GWzQ36JvY",
      EMAILJS_SERVICE_ID: "service_5axgx93",
      EMAILJS_TEMPLATE_ID: "template_fxankcs"
    };

    const nameEl = document.getElementById('name');
    const phoneEl = document.getElementById('phone');
    const emailEl = document.getElementById('email');
    const sizeEl = document.getElementById('size');
    const qtyEl = document.getElementById('quantity');
    const msgEl = document.getElementById('message');
    const countEl = document.getElementById('charCount');
    const submitBtn = document.getElementById('submitBtn');
    const statusEl = document.getElementById('status');

    // live char counter
    if (msgEl && countEl) {
      const updateCount = () => (countEl.textContent = `${msgEl.value.length}/300`);
      msgEl.addEventListener('input', updateCount);
      updateCount();
    }

    // ready state (message is optional)
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
    requiredEls.forEach(el => {
      el.addEventListener('input', updateSubmitState);
      el.addEventListener('change', updateSubmitState);
    });
    updateSubmitState();

    // EmailJS init
    if (!window.emailjs) {
      setStatus("Email system isn't loaded. Please refresh.", 'error');
      return;
    }
    emailjs.init({ publicKey: CFG.EMAILJS_PUBLIC_KEY });

    // submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!allRequiredFilled()) { setStatus('Please fill in all required fields.', 'error'); return; }
      if ((msgEl.value || '').length > 300) { setStatus('Message must be 300 characters or fewer.', 'error'); return; }

      const params = {
        // NOTE: Recipients should be set statically in your EmailJS template “To” field:
        //   grannysgiftinc@gmail.com, kylekelleyjr@gmail.com
        // If your template instead expects {{to_email}}, uncomment the next line:
        // to_email: "grannysgiftinc@gmail.com,kylekelleyjr@gmail.com",
        name: nameEl.value.trim(),
        phone: phoneEl.value.trim(),
        email: emailEl.value.trim(),
        size: sizeEl.value.trim(),
        quantity: qtyEl.value.trim(),
        message: (msgEl.value || '').trim() || '(no message)',
        submitted_at: new Date().toLocaleString(),
        reply_to: emailEl.value.trim(),
        from_name: nameEl.value.trim()
      };

      try {
        submitBtn.disabled = true;
        submitBtn.classList.remove('ready');
        setStatus('Sending…');

        await emailjs.send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_TEMPLATE_ID, params);

        setStatus('Thanks! Your inquiry was sent.', 'ok');
        form.reset();
        if (countEl) countEl.textContent = '0/300';
      } catch (err) {
        console.error(err);
        setStatus('Inquiry failed. Please try again.', 'error'); // preserves your original wording
      } finally {
        updateSubmitState(); // re-evaluate after reset/error
      }
    });

    function setStatus(msg, kind) {
      statusEl.textContent = msg || '';
      statusEl.classList.toggle('ok', kind === 'ok');
      statusEl.classList.toggle('error', kind === 'error');
    }
  });
})();

