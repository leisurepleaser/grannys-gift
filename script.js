// Granny's Gift - script.js
// Simpler, widely compatible version (no optional chaining / ??)
// Handles:
//   - Order inquiry form
//   - Newsletter form
// Uses EmailJS if available, but forms still enable even if EmailJS fails.

document.addEventListener('DOMContentLoaded', function () {
  // ===== CONFIG =====
  var CFG = {
    EMAILJS_PUBLIC_KEY: "fTkyrOb1GWzQ36JvY",
    EMAILJS_SERVICE_ID: "service_5axgx93",

    // Order emails
    EMAILJS_INTERNAL_TEMPLATE_ID: "template_fxankcs",   // internal order notification
    EMAILJS_AUTOREPLY_TEMPLATE_ID: "template_aew1yes",  // customer confirmation

    // Newsletter
    EMAILJS_NEWSLETTER_TEMPLATE_ID: "template_p7tmtwl",

    // Optional logging endpoint (keep blank if unused)
    GSHEETS_WEBAPP_URL: ""
  };

  // ===== EmailJS init =====
  if (window.emailjs && typeof emailjs.init === "function") {
    try {
      emailjs.init({ publicKey: CFG.EMAILJS_PUBLIC_KEY });
    } catch (e) {
      console.error("EmailJS init failed:", e);
    }
  } else {
    console.warn("EmailJS SDK not loaded; forms will still enable.");
  }

  // ===== Utilities =====
  var fmtUSD;
  try {
    fmtUSD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  } catch (e) {
    fmtUSD = {
      format: function (n) { return "$" + (Number(n) || 0).toFixed(2); }
    };
  }

  function escapeHtml(s) {
    s = s || "";
    return s.replace(/[&<>\"']/g, function (c) {
      switch (c) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "\"": return "&quot;";
        case "'": return "&#39;";
        default: return c;
      }
    });
  }

  function setStatus(el, msg, kind) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.remove("ok");
    el.classList.remove("error");
    if (kind === "ok") el.classList.add("ok");
    if (kind === "error") el.classList.add("error");
  }

  // Small helper to add event listeners only if element exists
  function on(el, evt, handler) {
    if (el) el.addEventListener(evt, handler);
  }

  // ====================================================================
  // ORDER FORM
  // ====================================================================
  var orderForm   = document.getElementById("orderForm");
  var nameEl      = document.getElementById("name");
  var phoneEl     = document.getElementById("phone");
  var emailEl     = document.getElementById("email");
  var sizeEl      = document.getElementById("size");
  var qtyEl       = document.getElementById("quantity");
  var msgEl       = document.getElementById("message");
  var hpEl        = document.getElementById("website");      // honeypot
  var countEl     = document.getElementById("charCount");
  var submitBtn   = document.getElementById("submitBtn");
  var statusEl    = document.getElementById("status");
  var successPane = document.getElementById("successPanel");
  var summaryEl   = document.getElementById("summary");

  if (orderForm) {
    // --- character counter ---
    if (msgEl && countEl) {
      var syncCount = function () {
        countEl.textContent = (msgEl.value || "").length + "/300";
      };
      on(msgEl, "input", syncCount);
      syncCount();
    }

    // --- total estimate ---
    var totalEl = document.getElementById("orderTotal");

    function ensureTotalEl() {
      if (!totalEl) {
        var row = document.createElement("div");
        row.className = "total-row";
        totalEl = document.createElement("div");
        totalEl.id = "orderTotal";
        totalEl.className = "total-box";
        totalEl.textContent = "Estimated total: —";
        row.appendChild(totalEl);
        if (submitBtn && submitBtn.parentNode) {
          orderForm.insertBefore(row, submitBtn);
        } else {
          orderForm.appendChild(row);
        }
      }
    }
    ensureTotalEl();

    function getPriceForSize() {
      if (!sizeEl) return 0;
      var opt = sizeEl.options[sizeEl.selectedIndex];
      if (!opt) return 0;
      if (opt.dataset && opt.dataset.price) {
        var p = parseFloat(opt.dataset.price);
        if (!isNaN(p)) return p;
      }
      var label = (opt.textContent || "").toLowerCase();
      if (label.indexOf("whole") !== -1) return 34.99;
      if (label.indexOf("cupcake") !== -1) return 5.99;
      return 0;
    }

    function updateTotalUI() {
      if (!totalEl) return;
      if (!sizeEl || !qtyEl) { totalEl.textContent = "Estimated total: —"; return; }
      var sizePicked = !!sizeEl.value;
      var qtyPicked  = !!qtyEl.value;
      if (sizePicked && qtyPicked) {
        var qty = Number(qtyEl.value);
        var priceEach = getPriceForSize();
        if (priceEach > 0 && qty > 0) {
          totalEl.textContent = "Estimated total: " + fmtUSD.format(priceEach * qty);
          return;
        }
      }
      totalEl.textContent = "Estimated total: —";
    }

    // --- enable/disable submit ---
    var requiredEls = [nameEl, phoneEl, emailEl, sizeEl, qtyEl];

    function allRequiredFilled() {
      var i, el;
      for (i = 0; i < requiredEls.length; i++) {
        el = requiredEls[i];
        if (!el || !el.value || !el.value.trim()) {
          return false;
        }
      }
      if (emailEl && typeof emailEl.checkValidity === "function") {
        if (!emailEl.checkValidity()) return false;
      }
      return true;
    }

    function updateSubmitState() {
      if (!submitBtn) return;
      var ready = allRequiredFilled();
      submitBtn.disabled = !ready;
      if (ready) submitBtn.classList.add("ready");
      else submitBtn.classList.remove("ready");
    }

    var fieldsForChanges = [nameEl, phoneEl, emailEl, sizeEl, qtyEl];
    for (var i = 0; i < fieldsForChanges.length; i++) {
      (function (el) {
        if (!el) return;
        on(el, "input", function () { updateSubmitState(); updateTotalUI(); });
        on(el, "change", function () { updateSubmitState(); updateTotalUI(); });
      })(fieldsForChanges[i]);
    }
    updateSubmitState();
    updateTotalUI();

    // simple spam check based on honeypot
    function isSpammy() {
      if (hpEl && hpEl.value && hpEl.value.trim()) return true;
      return false;
    }

    // --- submit handler ---
    on(orderForm, "submit", function (e) {
      e.preventDefault();

      if (!allRequiredFilled()) {
        setStatus(statusEl, "Please fill in all required fields.", "error");
        updateSubmitState();
        return;
      }
      if (msgEl && (msgEl.value || "").length > 300) {
        setStatus(statusEl, "Message must be 300 characters or fewer.", "error");
        return;
      }
      if (isSpammy()) {
        setStatus(statusEl, "Something went wrong. Please try again in a moment.", "error");
        return;
      }

      var name      = nameEl ? nameEl.value.trim() : "";
      var phone     = phoneEl ? phoneEl.value.trim() : "";
      var fromEmail = emailEl ? emailEl.value.trim() : "";
      var size      = sizeEl ? sizeEl.value.trim() : "";
      var quantity  = qtyEl ? qtyEl.value.trim() : "";
      var message   = msgEl ? (msgEl.value || "").trim() : "";
      var priceEach = getPriceForSize();
      var total     = priceEach * Number(quantity || 0);

      // Prepare params for EmailJS templates
      var internalParams = {
        name: name,
        phone: phone,
        email: fromEmail,
        size: size,
        quantity: quantity,
        price_each: fmtUSD.format(priceEach),
        total: isFinite(total) ? fmtUSD.format(total) : "—",
        message: message || "(no message)",
        submitted_at: (new Date()).toLocaleString(),
        reply_to: fromEmail,
        from_name: name
      };
      var autoReplyParams = {
        to_email: fromEmail,
        name: name,
        size: size,
        quantity: quantity,
        price_each: fmtUSD.format(priceEach),
        total: isFinite(total) ? fmtUSD.format(total) : "—",
        submitted_at: (new Date()).toLocaleString()
      };

      if (!window.emailjs || !CFG.EMAILJS_SERVICE_ID || !CFG.EMAILJS_INTERNAL_TEMPLATE_ID) {
        console.error("EmailJS not configured; cannot send automatically.");
        setStatus(
          statusEl,
          "We couldn't send your inquiry automatically. Please email us at grannysgiftinc@gmail.com.",
          "error"
        );
        return;
      }

      // Sending...
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.remove("ready");
      }
      setStatus(statusEl, "Sending…");

      emailjs
        .send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_INTERNAL_TEMPLATE_ID, internalParams)
        .then(function () {
          // optional customer confirmation
          if (CFG.EMAILJS_AUTOREPLY_TEMPLATE_ID) {
            emailjs
              .send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_AUTOREPLY_TEMPLATE_ID, autoReplyParams)
              .catch(function () { /* ignore */ });
          }

          // optional log
          if (CFG.GSHEETS_WEBAPP_URL) {
            try {
              fetch(CFG.GSHEETS_WEBAPP_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "order",
                  name: name,
                  email: fromEmail,
                  phone: phone,
                  size: size,
                  price_each: priceEach,
                  quantity: Number(quantity || 0),
                  total: total,
                  message: message,
                  submitted_at: (new Date()).toISOString()
                })
              }).catch(function () { /* ignore */ });
            } catch (err) {
              console.error("Log failed:", err);
            }
          }

          // Success UI
          if (!summaryEl) {
            summaryEl = document.createElement("div");
            summaryEl.id = "summary";
          }
          summaryEl.innerHTML =
            "<dl>" +
            "<dt>Name</dt><dd>" + escapeHtml(name) + "</dd>" +
            "<dt>Email</dt><dd>" + escapeHtml(fromEmail) + "</dd>" +
            "<dt>Phone</dt><dd>" + escapeHtml(phone) + "</dd>" +
            "<dt>Size</dt><dd>" + escapeHtml(size) + " (" + fmtUSD.format(priceEach) + ")</dd>" +
            "<dt>Quantity</dt><dd>" + escapeHtml(quantity) + "</dd>" +
            "<dt>Total</dt><dd>" + (isFinite(total) ? fmtUSD.format(total) : "—") + "</dd>" +
            "<dt>Message</dt><dd>" + escapeHtml(message || "(no message)") + "</dd>" +
            "</dl>";

          if (successPane) {
            successPane.hidden = false;
            successPane.appendChild(summaryEl);
          }
          orderForm.hidden = true;
          setStatus(statusEl, "", "");
          try {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch (e) {
            window.scrollTo(0, 0);
          }
        })
        .catch(function (err) {
          console.error("Order send failed:", err);
          setStatus(statusEl, "Inquiry failed. Please try again.", "error");
          if (submitBtn) submitBtn.disabled = false;
          updateSubmitState();
        });
    });
  }

  // ====================================================================
  // NEWSLETTER FORM
  // ====================================================================
  var nSection = document.getElementById("newsletter");
  var nForm    = document.getElementById("newsletterForm");
  var nlName   = document.getElementById("nl_name");
  var nlEmail  = document.getElementById("nl_email");
  var nlHP     = document.getElementById("nl_website");
  var nlBtn    = document.getElementById("nl_submit");

  if (nForm) {
    function nlReady() {
      if (!nlEmail || !nlEmail.value || !nlEmail.value.trim()) return false;
      if (typeof nlEmail.checkValidity === "function" && !nlEmail.checkValidity()) return false;
      return true;
    }

    function updateNlBtn() {
      if (!nlBtn) return;
      var ready = nlReady();
      nlBtn.disabled = !ready;
      if (ready) nlBtn.classList.add("ready");
      else nlBtn.classList.remove("ready");
    }

    on(nlEmail, "input", updateNlBtn);
    updateNlBtn();

    on(nForm, "submit", function (e) {
      e.preventDefault();
      if (nlHP && nlHP.value && nlHP.value.trim()) return; // spam
      if (!nlReady()) return;

      if (!window.emailjs || !CFG.EMAILJS_SERVICE_ID || !CFG.EMAILJS_NEWSLETTER_TEMPLATE_ID) {
        console.error("EmailJS not configured for newsletter.");
        // We still want to show a friendly message instead of silence
        var fail = document.createElement("p");
        fail.className = "status error";
        fail.textContent = "We couldn't join you automatically. Please email us at grannysgiftinc@gmail.com.";
        nForm.appendChild(fail);
        return;
      }

      var name  = nlName && nlName.value ? nlName.value.trim() : "";
      var email = nlEmail.value.trim();

      var params = {
        name: name,
        email: email,
        reply_to: email,
        submitted_at: (new Date()).toLocaleString()
      };

      if (nlBtn) {
        nlBtn.disabled = true;
        nlBtn.classList.remove("ready");
      }

      emailjs
        .send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_NEWSLETTER_TEMPLATE_ID, params)
        .then(function () {
          // Replace form with success panel
          var success = document.createElement("div");
          success.className = "success-panel";
          success.innerHTML =
            '<div class="check">✓</div>' +
            "<h3>You’re on the list!</h3>" +
            "<p>Thanks" +
            (name ? ", <strong>" + escapeHtml(name) + "</strong>" : "") +
            ". We added <strong>" + escapeHtml(email) +
            "</strong> to our newsletter.</p>" +
            '<p class="muted tiny">You can unsubscribe anytime via a link in any email.</p>';

          nForm.parentNode.replaceChild(success, nForm);

          // optional logging
          if (CFG.GSHEETS_WEBAPP_URL) {
            try {
              fetch(CFG.GSHEETS_WEBAPP_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "newsletter",
                  name: name,
                  email: email,
                  submitted_at: (new Date()).toISOString()
                })
              }).catch(function () { /* ignore */ });
            } catch (err) {
              console.error("Newsletter log failed:", err);
            }
          }
        })
        .catch(function (err) {
          console.error("Newsletter send failed:", err);
          var fail = document.createElement("p");
          fail.className = "status error";
          fail.textContent = "Could not join right now. Please try again.";
          nForm.appendChild(fail);
          updateNlBtn();
        });
    });
  }
});

