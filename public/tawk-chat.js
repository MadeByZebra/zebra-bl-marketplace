// Zebra's Shop — custom black launcher for the official tawk.to chat.
// The tawk.to conversation remains hosted by tawk.to; no payment or login data is sent.
(function () {
  const api = window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();
  const supportEmail = 'zebrablshopofficial@gmail.com';
  // A mailto link opens the visitor's configured email app or webmail handler.
  // It fills the recipient and a useful draft, but NEVER sends automatically.
  const supportSubject = "Zebra's Shop | Support Request";
  const supportBody = [
    'Hello Zebra Support,',
    '',
    'I need help with:',
    '',
    'Product name (if applicable):',
    'Order reference (if available):',
    'What happened:',
    '',
    'Please do not include passwords, login codes or payment card details.',
    '',
    'Thank you.'
  ].join(String.fromCharCode(13, 10));
  const supportComposeLink = 'mailto:' + supportEmail
    + '?subject=' + encodeURIComponent(supportSubject)
    + '&body=' + encodeURIComponent(supportBody);
  // All customer-facing support email links use one consistent draft.
  // This covers the footer, help articles, legal pages and any link inserted
  // later by the storefront's product/policy dialogs.
  const supportEmailSelector = 'a[href^="mailto:zebrablshopofficial@gmail.com" i], a[data-zebra-email-support]';
  function updateEmailSupportLinks(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll(supportEmailSelector).forEach(function (link) {
      link.href = supportComposeLink;
      if (!link.getAttribute('aria-label')) {
        link.setAttribute('aria-label', 'Compose email to Zebra Support');
      }
    });
  }
  document.addEventListener('click', function (event) {
    const element = event.target instanceof Element ? event.target : null;
    const link = element?.closest(supportEmailSelector);
    if (link) link.href = supportComposeLink;
  }, true);

  let loaded = false;
  let requested = false;
  let opening = false;
  let trigger;
  let caption;

  function setLabel(label) {
    if (caption) caption.textContent = label;
  }
  function updateOpened(isOpen) {
    opening = isOpen;
    // Prevent scroll chaining from the chat iframe into the shop document.
    // The tawk conversation itself continues to scroll independently.
    document.documentElement.classList.toggle('zebra-chat-scroll-locked', isOpen);
    if (trigger) {
      trigger.classList.toggle('is-open', isOpen);
      trigger.setAttribute('aria-expanded', String(isOpen));
      trigger.setAttribute('aria-label', isOpen ? 'Close Zebra support chat' : 'Open Zebra support chat');
    }
    setLabel(isOpen ? 'CLOSE CHAT' : 'CHAT WITH US');
  }
  function showChat() {
    if (!loaded || typeof api.maximize !== 'function') {
      requested = true;
      setLabel('CONNECTING…');
      return;
    }
    requested = false;
    if (typeof api.showWidget === 'function') api.showWidget();
    api.maximize();
    updateOpened(true);
  }

  function minimizeChat() {
    if (typeof api.minimize === 'function') api.minimize();
    if (typeof api.hideWidget === 'function') api.hideWidget();
    updateOpened(false);
  }

  // tawk.to documents onBeforeLoad as firing before the native widget renders.
  // Hide its default launcher at that stage (rather than after onLoad) so it
  // cannot briefly flash above our branded Zebra Support button on refresh.
  // Keep the connection active so live visitor monitoring continues to work.
  api.onBeforeLoad = function () {
    if (typeof api.hideWidget === 'function') api.hideWidget();
  };

  api.onLoad = function () {
    loaded = true;
    if (typeof api.hideWidget === 'function') api.hideWidget();
    if (requested) showChat();
    else updateOpened(false);
  };
  api.onChatMaximized = function () { updateOpened(true); };
  api.onChatMinimized = function () {
    if (typeof api.hideWidget === 'function') api.hideWidget();
    updateOpened(false);
  };
  api.onChatHidden = function () { updateOpened(false); };

  function buildTrigger() {
    trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'zebra-support-trigger';
    trigger.setAttribute('aria-label', 'Open Zebra support chat');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span class="zebra-support-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a7.9 7.9 0 0 1-8.3 8.1 8 8 0 0 1-3.4-.9L4 20l1.3-4.3a8 8 0 1 1 14.7-4.2Z"/><path d="M8.5 12h7"/></svg></span><span class="zebra-support-copy"><strong>ZEBRA SUPPORT</strong><span class="zebra-support-caption">CHAT WITH US</span></span><span class="zebra-support-light" aria-hidden="true"></span>';
    caption = trigger.querySelector('.zebra-support-caption');
    trigger.addEventListener('click', function () {
      if (opening) minimizeChat();
      else if (loaded) showChat();
      else {
        // Never leave visitors stranded if the external chat is unavailable.
        if (requested) window.location.href = supportComposeLink;
        else {
          requested = true;
          setLabel('CONNECTING…');
          window.setTimeout(function () {
            if (!loaded && requested) setLabel('CLICK TO EMAIL');
          }, 8000);
        }
      }
    });
    document.body.appendChild(trigger);

    // Email is a separate no-cost support channel; tawk.to stays available
    // for AI Assist, visitor monitoring and manual takeover in its inbox.
    const emailLink = document.createElement('a');
    emailLink.className = 'zebra-support-email';
    emailLink.href = supportComposeLink;
    emailLink.setAttribute('aria-label', 'Email Zebra Support');
    emailLink.title = 'Open a ready-to-send email in your default mail app';
    emailLink.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg><span>EMAIL SUPPORT</span>';
    document.body.appendChild(emailLink);
    updateEmailSupportLinks(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildTrigger);
  else buildTrigger();

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://embed.tawk.to/6b020888c09bf83cda5bd06c/1k7vv2l1g';
  script.charset = 'UTF-8';
  script.setAttribute('crossorigin', 'anonymous');
  document.head.appendChild(script);
})();
