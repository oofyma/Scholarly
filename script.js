let isRegister = false;

// --- SIGN IN PAGE ---

function toggleForm() {
  isRegister = !isRegister;

  document.getElementById('form-title').textContent =
    isRegister ? 'Create account' : 'Sign in';

  document.getElementById('form-sub').textContent =
    isRegister ? 'Join Scholarly' : 'Welcome back';

  document.getElementById('form-btn').textContent =
    isRegister ? 'Register' : 'Sign in';

  document.getElementById('reg-name').style.display =
    isRegister ? 'block' : 'none';

  document.getElementById('toggle-link').textContent =
    isRegister
      ? 'Already have an account? Sign in'
      : "Don't have an account? Register";

  showError('');
}

async function handleSubmit() {
  const email = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value.trim();

  if (!email || !password) {
    showError('Please fill in all fields.');
    return;
  }

  if (isRegister) {
    const name = document.getElementById('input-name').value.trim();
    if (!name) { showError('Please enter your name.'); return; }
    const result = await dbCreateUser(name, email, password);
    if (!result.success) { showError(result.error); return; }
  } else {
    const result = await dbSignIn(email, password);
    if (!result.success) { showError(result.error); return; }
  }

  window.location.href = 'catalogue.html';
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

// --- CATALOGUE PAGE ---

async function initCatalogue() {
  const user = dbGetCurrentUser();
  const btn = document.getElementById('register-tutor-btn');

  if (user) {
    // Update nav
    const navLinks = document.getElementById('nav-links');
    if (navLinks) {
      navLinks.innerHTML = `
        <a href="index.html">Home</a>
        <a href="catalogue.html">Browse tutors</a>
        <span class="nav-user">👤 ${user.name}</span>
        <a href="#" onclick="signOut()">Sign out</a>
      `;
    }

    // Only show "Register as tutor" if they don't already have a profile
    if (btn) {
      const existing = await dbGetMyTutorProfile(user.id);
      if (!existing) {
        btn.style.display = 'inline-block';
      } else {
        btn.style.display = 'inline-block';
        btn.textContent = 'Edit your tutor profile';
      }
    }
  }

  await renderTutors();
}

async function renderTutors() {
  const list = document.getElementById('tutor-list');
  const empty = document.getElementById('empty-state');
  const tutors = await dbGetTutors();

  if (tutors.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  list.innerHTML = tutors.map(t => `
    <div class="tutor-card">
      <div class="tutor-avatar">
        ${t.avatar_url
          ? `<img src="${t.avatar_url}" alt="${t.name}">`
          : `<div class="avatar-placeholder">${t.name.charAt(0).toUpperCase()}</div>`
        }
      </div>
      <div class="tutor-info">
        <h3>${t.name}</h3>
        <div class="subj">${t.subjects}</div>
        <div class="meta">${t.location} · ${t.format}</div>
        <p class="tutor-about">${t.about}</p>
      </div>
      <div class="tutor-right">
        <div class="tutor-rate">$${t.hourly_rate}<small>/hr</small></div>
      </div>
    </div>
  `).join('');
}

function toggleTutorForm() {
  const form = document.getElementById('tutor-form');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function submitTutorProfile() {
  const user = dbGetCurrentUser();
 console.log('current user:', user);
  if (!user) {
    alert('You need to be signed in to register as a tutor.');
    window.location.href = 'signin.html';
    return;
  }

  const name = document.getElementById('t-name').value.trim();
  const subjects = document.getElementById('t-subjects').value.trim();
  const hourly_rate = document.getElementById('t-rate').value.trim();
  const location = document.getElementById('t-location').value.trim();
  const format = document.getElementById('t-format').value;
  const about = document.getElementById('t-about').value.trim();
  const avatarFile = document.getElementById('t-avatar').files[0];

  if (!name || !subjects || !hourly_rate || !location || !about) {
    const err = document.getElementById('tutor-error');
    err.textContent = 'Please fill in all fields.';
    err.style.display = 'block';
    return;
  }

  // Upload avatar if one was selected
  let avatar_url = null;
  if (avatarFile) {
    const upload = await dbUploadAvatar(avatarFile);
    if (!upload.success) {
      const err = document.getElementById('tutor-error');
      err.textContent = 'Image upload failed: ' + upload.error;
      err.style.display = 'block';
      return;
    }
    avatar_url = upload.url;
  }

  // Link the tutor profile to the logged in user via user_id
  const result = await dbAddTutor({
    user_id: user.id,
    name,
    subjects,
    hourly_rate,
    location,
    format,
    about,
    avatar_url
  });

  if (!result.success) {
    const err = document.getElementById('tutor-error');
    err.textContent = result.error;
    err.style.display = 'block';
    return;
  }

  toggleTutorForm();
  await renderTutors();
}

function signOut() {
  dbSignOut();
  window.location.href = 'index.html';
}

if (document.getElementById('tutor-list')) {
  initCatalogue();
}

function initHome() {
  const user = dbGetCurrentUser();
  if (!user) return;

  const navLinks = document.getElementById('nav-links');
  if (navLinks) {
    navLinks.innerHTML = `
      <a href="index.html">Home</a>
      <a href="catalogue.html">Browse tutors</a>
      <span class="nav-user">👤 ${user.name}</span>
      <a href="#" onclick="signOut()">Sign out</a>
    `;
  }
}

if (document.querySelector('.hero')) {
  initHome();
}