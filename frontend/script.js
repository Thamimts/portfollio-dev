// Wait until the full page is ready before touching any elements.
document.addEventListener('DOMContentLoaded', () => {
  // Update the footer year automatically so it never goes out of date.
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Cache the main sections and controls we need for interactions.
  const projectsSection = document.getElementById('projects');
  const skillsSection = document.getElementById('skills');
  const contactSection = document.getElementById('contact');
  const contactForm = document.getElementById('contactForm');
  const formStatus = document.getElementById('status');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const messageInput = document.getElementById('message');
  const projectButton = document.querySelector('.btn-primary');
  const cvButton = document.querySelector('.btn-sec');
  const socialButtons = document.querySelectorAll('.social-btn');
  const navLinks = document.querySelectorAll('.nav-links a');
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const contactFields = [nameInput, emailInput, messageInput].filter(Boolean);

  const setFormMessage = (message, isError = false) => {
    if (formStatus) {
      formStatus.textContent = message;
      formStatus.style.color = isError ? '#ff8a8a' : '';
    }
  };

  const clearFieldState = (field) => {
    if (!field) return;
    field.removeAttribute('aria-invalid');
    field.setCustomValidity('');
  };

  const markFieldInvalid = (field, message) => {
    if (!field) return;
    field.setAttribute('aria-invalid', 'true');
    field.setCustomValidity(message);
  };

  const validateContactPayload = (payload) => {
    contactFields.forEach(clearFieldState);

    if (payload.name.length < 2) {
      markFieldInvalid(nameInput, 'Please enter your full name.');
      return { valid: false, firstInvalid: nameInput, message: 'Please enter your full name.' };
    }

    if (!emailPattern.test(payload.email)) {
      markFieldInvalid(emailInput, 'Please enter a valid email address.');
      return { valid: false, firstInvalid: emailInput, message: 'Please enter a valid email address.' };
    }

    if (payload.message.length < 10) {
      markFieldInvalid(messageInput, 'Please write at least 10 characters.');
      return { valid: false, firstInvalid: messageInput, message: 'Please write at least 10 characters.' };
    }

    return { valid: true, firstInvalid: null, message: '' };
  };

  contactFields.forEach((field) => {
    field.addEventListener('input', () => {
      clearFieldState(field);
      if (formStatus && field.value.trim()) {
        formStatus.textContent = '';
      }
    });
  });

  // Reusable helper for smooth scrolling to a section.
  const smoothScrollTo = (target) => {
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Make the main CTA jump to the projects section.
  if (projectButton && projectsSection) {
    projectButton.addEventListener('click', () => smoothScrollTo(projectsSection));
  }

  // Open the CV PDF in a new tab when the download button is clicked.
  if (cvButton) {
    cvButton.addEventListener('click', () => {
      const resumeUrl = 'Thami.porfolio/images/CSE%20R25(2025-29)CURRICULUM.pdf';
      window.open(resumeUrl, '_blank', 'noopener,noreferrer');
    });
  }

  if (contactForm) {
    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submitButton = contactForm.querySelector('button[type="submit"]');
      const formData = new FormData(contactForm);
      const payload = {
        name: String(formData.get('name') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        message: String(formData.get('message') || '').trim(),
      };

      const validation = validateContactPayload(payload);
      if (!validation.valid) {
        setFormMessage(validation.message, true);
        validation.firstInvalid?.focus();
        return;
      }

      try {
        if (submitButton) {
          submitButton.disabled = true;
        }
        setFormMessage('Sending message...');

        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Unable to send message.');
        }

        contactForm.reset();
        if (formStatus) {
          formStatus.textContent = result.message || 'Message sent successfully.';
        }
      } catch (error) {
        if (formStatus) {
          formStatus.textContent = error.message || 'Something went wrong while sending the message.';
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  }

  // Replace default anchor jumps with smooth scrolling inside the page.
  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      smoothScrollTo(target);
    });
  });

  // Wire the social buttons to the matching external action.
  socialButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const label = button.textContent.trim().toLowerCase();

      if (label.includes('github')) {
        window.open('https://github.com/Thamimts/', '_blank', 'noopener,noreferrer');
        return;
      }

      if (label.includes('linkedin')) {
        window.open('https://linkedin.com/in/thamim-jr', '_blank', 'noopener,noreferrer');
        return;
      }

      window.location.href = 'mailto:thamim7206@gmail.com?subject=Portfolio%20Inquiry';
    });
  });

  // Collect the sections we want to animate as they enter the viewport.
  const revealTargets = [
    ...document.querySelectorAll('.hero-text, .hero-visual, .stats-list, .card, .contact-section'),
  ];

  // Add a simple fade-up reveal effect for browsers that support it.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealTargets.forEach((target) => {
      target.classList.add('reveal');
      observer.observe(target);
    });
  }

  // Insert an About section so the navbar's "about" link has a real target.
  if (skillsSection && contactSection) {
    const aboutLikeHeading = document.createElement('section');
    aboutLikeHeading.id = 'about';
    aboutLikeHeading.className = 'about-section';
    aboutLikeHeading.setAttribute('aria-labelledby', 'about-heading');
    aboutLikeHeading.innerHTML = `
      <h2 id="about-heading" class="section-title">About Me</h2>
      <p class="about-copy">I build simple, responsive, and practical web experiences with a focus on clean UI, readable code, and mobile-friendly layouts.</p>
    `;
    skillsSection.parentNode.insertBefore(aboutLikeHeading, skillsSection);
  }

  // Fetch projects from the API and render dynamic cards with links to details
  (async function renderProjects() {
    const grid = document.querySelector('.projects-grid');
    if (!grid) return;

    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      grid.innerHTML = data
        .map(
          (p) => `
            <article class="card">
              <div class="card-icon">📁</div>
              <h3>${p.title}</h3>
              <p>${p.description}</p>
              <ul class="card-tags">${(p.stack || []).map((t) => `<li class="card-tag">${t}</li>`).join('')}</ul>
              <br>
              <a class="card-link" href="/project.html?id=${p.id}">View details →</a>
            </article>
          `
        )
        .join('');
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  })();
});
