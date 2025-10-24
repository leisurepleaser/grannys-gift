/* Granny's Gift minimal form logic (vanilla JS) */
(function() {
  const form = document.getElementById('inquiry-form');
  const nameEl = document.getElementById('name');
  const phoneEl = document.getElementById('phone');
  const emailEl = document.getElementById('email');
  const sizeEl = document.getElementById('size');
  const quantityEl = document.getElementById('quantity');
  const messageEl = document.getElementById('message');
  const submitBtn = document.getElementById('submitBtn');
  const statusEl = document.getElementById('status');
  const counterEl = document.getElementById('charCounter');

  let emailConfig = null;
  let emailInitialized = false;

  // Load EmailJS config (public keys only)
  fetch('email-config.json')
    .then(r => {
      if (!r.ok) throw new Error('Missing email-config.json');
      return r.json();
    })
    .then(cfg => {
      emailConfig = cfg;
      try {
        if (window.emailjs && cfg && cfg.EMAILJS_PUBLIC_KEY) {
          emailjs.init(cfg.EMAILJS_PUBLIC_KEY);
          emailInitialized = true;
        }
      } catch (e) {
        emailInitialized = false;
        // no-op; will surface as "Inquiry failed" on send
      }
    })
    .catch(() => {
      // Config missing: sending will fail gracefully
      emailInitialized = false;
    });

  // Update counter for optional message
  const updateCounter = () => {
    const len = messageEl.value.length;
    counterEl.textContent = `${len}/300`;
  };

  // Validate required fields and toggle button state
  const isFormValid = () => {
    const nameOk = nameEl.value.trim().length > 0;
    const phoneOk = phoneEl.value.trim().length > 0;
    const emailOk = emailEl.value.trim().length > 0 && emailEl.checkValidity();
    const sizeOk = sizeEl.value.trim().length > 0;
    const qtyOk = quantityEl.value.trim().length > 0;
    return nameOk && phoneOk && emailOk && sizeOk && qtyOk;
  };

  const setButtonDisabled = (disabled) => {
    submitBtn.disabled = disabled;
    submitBtn.setAttribute('aria-disabled', String(disabled));
    if (disabled) {
      submitBtn.classList.remove('ready');
    }
  };

  const updateButtonState = () => {
    if (isFormValid()) {
      submitBtn.classList.add('ready'); // yellow + red border
      submitBtn.disabled = false;
      submitBtn.setAttribute('aria-disabled', 'false');
    } else {
      setButtonDisabled(true); // grey + disabled
    }
  };

  // Status helper
  let hideTimer = null;
  const showStatus = (msg, isError = false) => {
    if (hideTimer) clearTimeout(hideTimer);
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', isError);
    statusEl.classList.add('show');
    hideTimer = setTimeout(() => {
      statusEl.classList.remove('show');
      statusEl.textContent = '';
    }, 2000);
  };

  // Gather template params for EmailJS
  const collectParams = () => {
    const data = {
      name: nameEl.value.trim(),
      phone: phoneEl.value.trim(),
      email: emailEl.value.trim(),
      size: sizeEl.value.trim(),
      quantity: quantityEl.value.trim(),
      message: messageEl.value.trim()
    };
    const messageBody = `Granny’s Gift Inquiry

Name: ${data.name}
Phone Number: ${data.phone}
Email: ${data.email}
Size: ${data.size}
Quantity: ${data.quantity}
Message (Optional): ${data.message || ''}
`;
    return {
      ...data,
      message_body: messageBody,
      to_email_1: 'grannysgiftinc@gmail.com',
      to_email_2: 'kylekelleyjr@gmail.com'
    };
  };

  // Immediately revert button to disabled grey state after click
  const revertButtonPostClick = () => {
    setButtonDisabled(true);
  };

  // Submit handler
  const handleSubmit = async () => {
    // Button should immediately revert to grey, no red border, and disable
    revertButtonPostClick();

    if (!isFormValid()) {
      // Shouldn't happen because button enabled only when valid, but guard anyway
      showStatus('Inquiry failed', true);
      return;
    }

    const params = collectParams();

    if (!emailInitialized || !emailConfig) {
      showStatus("Inquiry failed", true);
      return;
    }

    try {
      await emailjs.send(
        emailConfig.EMAILJS_SERVICE_ID,
        emailConfig.EMAILJS_TEMPLATE_ID,
        params
      );
      showStatus("Granny's Gift <3", false);
    } catch (e) {
      showStatus("Inquiry failed", true);
    }
  };

  // Event listeners
  ['input', 'change'].forEach(ev => {
    form.addEventListener(ev, () => {
      updateCounter();
      updateButtonState();
    });
  });

  submitBtn.addEventListener('click', handleSubmit);

  // Initialize UI
  updateCounter();
  updateButtonState();
})();
