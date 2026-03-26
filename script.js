 (function () {
   function on(el, evt, handler) {
     if (el) el.addEventListener(evt, handler);
   }

   document.addEventListener('DOMContentLoaded', function () {
     var siteHeader = document.querySelector('.site-header');
     var menuToggle = document.getElementById('menuToggle');
     var headerMenu = document.getElementById('headerMenu');
     var mobileMenuBreakpoint = 900;

     function closeMenu() {
       if (!siteHeader || !menuToggle || !headerMenu) return;
       siteHeader.classList.remove('menu-open');
       menuToggle.classList.remove('is-open');
       menuToggle.setAttribute('aria-expanded', 'false');
       document.body.classList.remove('menu-open');
     }

     function openMenu() {
       if (!siteHeader || !menuToggle || !headerMenu) return;
       siteHeader.classList.add('menu-open');
       menuToggle.classList.add('is-open');
       menuToggle.setAttribute('aria-expanded', 'true');
       document.body.classList.add('menu-open');
     }

     function toggleMenu() {
       if (!siteHeader || !menuToggle || !headerMenu) return;
       if (siteHeader.classList.contains('menu-open')) closeMenu();
       else openMenu();
     }

     on(menuToggle, 'click', toggleMenu);

     on(document, 'click', function (event) {
       if (!siteHeader || window.innerWidth > mobileMenuBreakpoint) return;
       if (!siteHeader.contains(event.target)) {
         closeMenu();
       }
     });

     on(window, 'resize', function () {
       if (window.innerWidth > mobileMenuBreakpoint) {
         closeMenu();
       }
     });

     var lightbox = document.getElementById('lightbox');
     var lightboxImage = document.getElementById('lightbox-image');
     var closeBtn = document.querySelector('.lightbox-close');
     var openButtons = document.querySelectorAll('.gallery-open');

     function openLightbox(src, alt) {
       if (!lightbox || !lightboxImage) return;
       lightboxImage.src = src;
       lightboxImage.alt = alt || '';
       lightbox.hidden = false;
       lightbox.setAttribute('aria-hidden', 'false');
       document.body.classList.add('lightbox-open');
     }

     function closeLightbox() {
       if (!lightbox || !lightboxImage) return;
       lightbox.hidden = true;
       lightbox.setAttribute('aria-hidden', 'true');
       lightboxImage.src = '';
       lightboxImage.alt = '';
       document.body.classList.remove('lightbox-open');
     }

     if (lightbox && lightboxImage && closeBtn && openButtons.length) {
       for (var i = 0; i < openButtons.length; i++) {
         (function (button) {
           on(button, 'click', function () {
             openLightbox(
               button.getAttribute('data-image'),
               button.getAttribute('data-alt')
             );
           });
         })(openButtons[i]);
       }

       on(closeBtn, 'click', closeLightbox);

       on(lightbox, 'click', function (event) {
         if (event.target === lightbox) {
           closeLightbox();
         }
       });
     }

     var CFG = {
       EMAILJS_PUBLIC_KEY: 'fTkyrOb1GWzQ36JvY',
       EMAILJS_SERVICE_ID: 'service_5axgx93',
       EMAILJS_NEWSLETTER_TEMPLATE_ID: 'template_p7tmtwl'
     };

     if (window.emailjs && typeof emailjs.init === 'function') {
       try {
         emailjs.init({ publicKey: CFG.EMAILJS_PUBLIC_KEY });
       } catch (e) {
         console.error('EmailJS init failed:', e);
       }
     }

     function escapeHtml(s) {
       s = s || '';
       return s.replace(/[&<>\"']/g, function (c) {
         switch (c) {
           case '&': return '&amp;';
           case '<': return '&lt;';
           case '>': return '&gt;';
           case '"': return '&quot;';
           case "'": return '&#39;';
           default: return c;
         }
       });
     }

     var nForm = document.getElementById('newsletterForm');
     var nlName = document.getElementById('nl_name');
     var nlEmail = document.getElementById('nl_email');
     var nlHP = document.getElementById('nl_website');
     var nlBtn = document.getElementById('nl_submit');

     if (nForm) {
       function nlReady() {
         if (!nlEmail || !nlEmail.value || !nlEmail.value.trim()) return false;
         if (typeof nlEmail.checkValidity === 'function' && !nlEmail.checkValidity()) return false;
         return true;
       }

       function updateNlBtn() {
         if (!nlBtn) return;
         var ready = nlReady();
         nlBtn.disabled = !ready;
         if (ready) nlBtn.classList.add('ready');
         else nlBtn.classList.remove('ready');
       }

       on(nlEmail, 'input', updateNlBtn);
       updateNlBtn();

       on(nForm, 'submit', function (e) {
         e.preventDefault();

         if (nlHP && nlHP.value && nlHP.value.trim()) return;
         if (!nlReady()) return;

         if (!window.emailjs || !CFG.EMAILJS_SERVICE_ID || !CFG.EMAILJS_NEWSLETTER_TEMPLATE_ID) {
           var fail = document.createElement('p');
           fail.className = 'status error';
           fail.textContent = "We couldn't join you automatically. Please email us at grannysgiftinc@gmail.com.";
           nForm.appendChild(fail);
           return;
         }

         var name = nlName && nlName.value ? nlName.value.trim() : '';
         var email = nlEmail.value.trim();

         var params = {
           name: name,
           email: email,
           reply_to: email,
           submitted_at: (new Date()).toLocaleString()
         };

         if (nlBtn) {
           nlBtn.disabled = true;
           nlBtn.classList.remove('ready');
         }

         emailjs
           .send(CFG.EMAILJS_SERVICE_ID, CFG.EMAILJS_NEWSLETTER_TEMPLATE_ID, params)
           .then(function () {
             var success = document.createElement('div');
             success.className = 'success-panel';
             success.innerHTML =
               '<div class="check">✓</div>' +
               '<h3>You’re on the list!</h3>' +
               '<p>Thanks' +
               (name ? ', <strong>' + escapeHtml(name) + '</strong>' : '') +
               '. We added <strong>' + escapeHtml(email) +
               '</strong> to our newsletter.</p>' +
               '<p class="muted tiny">You can unsubscribe anytime via a link in any email.</p>';

             nForm.parentNode.replaceChild(success, nForm);
           })
           .catch(function () {
             var fail = document.createElement('p');
             fail.className = 'status error';
             fail.textContent = 'Could not join right now. Please try again.';
             nForm.appendChild(fail);
             updateNlBtn();
           });
       });
     }

     on(document, 'keydown', function (event) {
       if (event.key === 'Escape') {
         if (siteHeader && siteHeader.classList.contains('menu-open')) {
           closeMenu();
         }
         if (lightbox && !lightbox.hidden) {
           closeLightbox();
         }
       }
     });
   });
 })();
