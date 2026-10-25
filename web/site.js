(function () {
  var override = new URLSearchParams(location.search).get('api');
  var API = (override || window.SAATHI_API || '').replace(/\/$/, '');

  // Mobile menu
  var menuBtn = document.querySelector('.menu-btn');
  var nav = document.querySelector('.nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') nav.classList.remove('open');
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  window.saathiPost = function (path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
        return data;
      });
    }, function () {
      throw new Error('Could not connect. Please check your internet and try again.');
    });
  };

  window.saathiGet = function (path) {
    return fetch(API + path).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
  };

  function notice(el, kind, text) {
    el.className = 'notice ' + kind;
    el.textContent = text;
    el.hidden = false;
  }
  window.saathiNotice = notice;

  // Waitlist forms (any form with data-waitlist)
  document.querySelectorAll('form[data-waitlist]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var msg = form.querySelector('.notice');
      var fd = new FormData(form);
      btn.disabled = true;
      window.saathiPost('/public/waitlist', {
        email: fd.get('email'),
        platform: fd.get('platform') || null,
        source: form.getAttribute('data-waitlist'),
        website: fd.get('website'),
      }).then(function () {
        notice(msg, 'ok', "You're on the list. We'll email you when Saathi is ready, and not before.");
        form.reset();
      }).catch(function (err) {
        notice(msg, 'err', err.message);
      }).then(function () { btn.disabled = false; });
    });
  });

  // Approved stories (hidden until there are some)
  var storiesBox = document.getElementById('stories-list');
  if (storiesBox) {
    window.saathiGet('/public/stories').then(function (data) {
      var list = (data && data.stories) || [];
      if (!list.length) return;
      document.getElementById('stories-empty').hidden = true;
      list.forEach(function (s) {
        var card = document.createElement('figure');
        card.className = 'card';
        card.style.margin = '0';
        var q = document.createElement('blockquote');
        q.style.margin = '0';
        q.style.fontSize = '19px';
        q.textContent = '“' + s.story + '”';
        var who = document.createElement('figcaption');
        who.className = 'muted small';
        who.textContent = s.name + (s.location ? ', ' + s.location : '');
        card.appendChild(q);
        card.appendChild(who);
        storiesBox.appendChild(card);
      });
    });
  }

  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    var topic = new URLSearchParams(location.search).get('topic');
    if (topic && contactForm.topic.querySelector('option[value="' + topic + '"]')) contactForm.topic.value = topic;
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(contactForm);
      var msg = contactForm.querySelector('.notice');
      var btn = contactForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      window.saathiPost('/public/messages', {
        name: fd.get('name'),
        email: fd.get('email'),
        topic: fd.get('topic'),
        message: fd.get('message'),
        website: fd.get('website'),
      }).then(function () {
        notice(msg, 'ok', "Thank you. We've got your message and will reply by email.");
        contactForm.reset();
      }).catch(function (err) {
        notice(msg, 'err', err.message);
      }).then(function () { btn.disabled = false; });
    });
  }

  var holidayForm = document.getElementById('holiday-form');
  if (holidayForm) {
    holidayForm.travelDate.min = new Date().toISOString().slice(0, 10);
    holidayForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!holidayForm.reportValidity()) return;
      var fd = new FormData(holidayForm);
      var msg = holidayForm.querySelector('.notice');
      var btn = holidayForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      window.saathiPost('/public/holiday-trips', {
        travellers: fd.get('travellers'),
        direction: fd.get('direction'),
        occasion: fd.get('occasion'),
        origin: fd.get('origin'),
        destination: fd.get('destination'),
        travelDate: fd.get('travelDate'),
        flight: fd.get('flight'),
        languages: fd.getAll('languages'),
        notes: fd.get('notes'),
        name: fd.get('name'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        consent: fd.get('consent') === 'on',
        website: fd.get('website'),
      }).then(function () {
        notice(msg, 'ok', "Thank you. We've got their trip and will email you if we find a family on the same flight or landing nearby. Flying back too? Add the return trip as well.");
        holidayForm.reset();
      }).catch(function (err) {
        notice(msg, 'err', err.message);
      }).then(function () { btn.disabled = false; });
    });
  }

  // Seasonal banner: hidden once its date has passed
  document.querySelectorAll('[data-until]').forEach(function (el) {
    if (new Date().toISOString().slice(0, 10) > el.getAttribute('data-until')) el.hidden = true;
  });

  var storyForm = document.getElementById('story-form');
  if (storyForm) {
    storyForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(storyForm);
      var msg = storyForm.querySelector('.notice');
      var btn = storyForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      window.saathiPost('/public/stories', {
        name: fd.get('name'),
        location: fd.get('location'),
        story: fd.get('story'),
        email: fd.get('email') || null,
        website: fd.get('website'),
      }).then(function () {
        notice(msg, 'ok', 'Thank you for sharing. We read every story and will ask before publishing yours.');
        storyForm.reset();
      }).catch(function (err) {
        notice(msg, 'err', err.message);
      }).then(function () { btn.disabled = false; });
    });
  }
})();
