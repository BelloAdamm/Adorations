(() => {
  const toggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      document.body.classList.toggle('menu-open', open);
    });
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation');
        document.body.classList.remove('menu-open');
      });
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation');
        document.body.classList.remove('menu-open');
      }
    });
  }

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add('is-visible'));
  }

  const bioModal = document.getElementById('bio-modal');
  if (bioModal) {
    const bioTitle = bioModal.querySelector('#bio-title');
    const bioContent = bioModal.querySelector('#bio-content');
    const closeButton = bioModal.querySelector('.modal-close');
    const modalLabel = bioModal.querySelector('.bio-dialog .eyebrow');
    let bioTrigger;

    const closeBio = () => {
      bioModal.hidden = true;
      document.body.classList.remove('modal-open');
      bioTrigger?.focus();
    };

    document.querySelectorAll('.team-bio-button').forEach(button => {
      button.addEventListener('click', () => {
        bioTitle.textContent = button.dataset.name;
        bioContent.textContent = button.dataset.fullBio;
        modalLabel.textContent = button.dataset.modalLabel || 'FULL BIOGRAPHY';
        bioTrigger = button;
        bioModal.hidden = false;
        document.body.classList.add('modal-open');
        closeButton.focus();
      });
    });

    closeButton.addEventListener('click', closeBio);
    bioModal.addEventListener('click', event => {
      if (event.target === bioModal) closeBio();
    });
    bioModal.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeBio();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        closeButton.focus();
      }
    });
  }

  const form = document.getElementById('enquiry-form');
  const note = document.getElementById('form-note');
  const preferredDate = form?.querySelector('[name="preferredDate"]');
  const preferredTime = form?.querySelector('[name="preferredTime"]');
  if (preferredDate) {
    preferredDate.min = new Date(Date.now() + 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  const clearPreferredTimeError = () => {
    preferredTime.setCustomValidity('');
  };
  preferredTime?.addEventListener('input', clearPreferredTimeError);
  preferredDate?.addEventListener('input', clearPreferredTimeError);

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const [year, month, day] = preferredDate.value.split('-').map(Number);
    const [hours, minutes] = preferredTime.value.split(':').map(Number);
    const preferredAt = Date.UTC(year, month - 1, day, hours - 1, minutes);
    if (preferredAt <= Date.now()) {
      preferredTime.setCustomValidity(
        'Please choose a future date and time in West Africa Time.'
      );
      preferredTime.reportValidity();
      return;
    }
    preferredTime.setCustomValidity('');

    const submitButton = form.querySelector('[type=submit]');
    const originalButtonText = submitButton?.innerHTML;
    const data = Object.fromEntries(new FormData(form).entries());
    const phoneNumber = String(data.phone || '').trim();
    const phoneCountryCode = String(data.phoneCountryCode || '');
    data._subject = `Consultation request: ${data.practice}`;
    delete data.phoneCountryCode;
    data.phone = phoneNumber
      ? (phoneNumber.startsWith('+') || !phoneCountryCode
        ? phoneNumber
        : `${phoneCountryCode} ${phoneNumber}`)
      : '';

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending request…';
    }
    if (note) {
      note.textContent = 'Sending your enquiry securely. Please wait.';
      note.dataset.state = 'loading';
    }

    try {
      const response = await fetch(
        'https://formsubmit.co/ajax/adorationchambers2@gmail.com',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(data)
        }
      );
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('We could not confirm whether your request was received. Please contact the firm before submitting again.');
      }
      if (!response.ok || result?.success === false || result?.success === 'false') {
        throw new Error(
          result?.message || result?.error || 'We could not send your request. Please try again.'
        );
      }

      form.reset();
      if (note) {
        note.textContent = 'Your consultation request was submitted. Your preferred date and time are not confirmed until the firm contacts you.';
        note.dataset.state = 'success';
      }
    } catch (error) {
      if (note) {
        note.textContent = error instanceof TypeError
          ? 'The consultation service could not be reached. Check your connection and try again, or contact the firm directly if the problem continues.'
          : error.message || 'Something went wrong. Please try again later or contact the firm by phone.';
        note.dataset.state = 'error';
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText || 'Send enquiry securely';
      }
    }
  });

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
