let isRegister = false;
let isEditingTutor = false;

// --- NAV ---

function updateNav() {
  const user = dbGetCurrentUser();
  const navLinks = document.getElementById('nav-links');
  if (!navLinks) return;

  if (user) {
    navLinks.innerHTML = `
      <a href="index.html">Home</a>
      <a href="catalogue.html">Browse tutors</a>
      <a href="account.html">👤 ${user.name}</a>
      <a href="#" onclick="signOut()">Sign out</a>
    `;
  } else {
    navLinks.innerHTML = `
      <a href="index.html">Home</a>
      <a href="signin.html">Sign in</a>
      <a href="catalogue.html">Browse tutors</a>
    `;
  }
}

// --- HOME PAGE ---

function initHome() {
  updateNav();
}

if (document.querySelector('.hero')) {
  initHome();
}

// --- SIGN IN PAGE ---

function toggleForm() {
  isRegister = !isRegister;

  document.getElementById('form-title').textContent =
    isRegister ? 'Create account' : 'Sign in';

  document.getElementById('form-sub').textContent =
    isRegister ? 'Join Tutorial' : 'Welcome back';

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
  updateNav();
  const user = dbGetCurrentUser();
  const btn = document.getElementById('register-tutor-btn');

  if (user && btn) {
    const existing = await dbGetMyTutorProfile(user.id);
    if (existing) {
      btn.textContent = '✏️ Edit your tutor profile';
      btn.style.display = 'inline-block';
    } else {
      btn.textContent = '+ Register as a tutor';
      btn.style.display = 'inline-block';
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
    <div class="tutor-card" onclick="viewProfile('${t.tutor_id}')">
      <div class="tutor-avatar">
        ${t.avatar_url
          ? `<img src="${t.avatar_url}" alt="${t.name}">`
          : `<div class="avatar-placeholder">${t.name.charAt(0).toUpperCase()}</div>`
        }
      </div>
      <div class="tutor-info">
        <h3>${t.name}</h3>
        <div class="tutor-field"><span class="field-label">Subjects:</span> ${t.subjects}</div>
        <div class="tutor-field"><span class="field-label">Target students:</span> ${t.target_students || 'Not specified'}</div>
        <div class="tutor-field"><span class="field-label">Location:</span> ${t.location}</div>
        <div class="tutor-field"><span class="field-label">Format:</span> ${t.format}</div>
        <div class="tutor-field"><span class="field-label">Availability:</span> ${t.availability || 'Not specified'}</div>
      </div>
      <div class="tutor-right">
        <div class="tutor-rate">$${t.hourly_rate}<small>/hr</small></div>
        <div class="view-profile-link">View profile →</div>
      </div>
    </div>
  `).join('');
}

function viewProfile(tutorId) {
  window.location.href = 'profile.html?id=' + tutorId;
}

async function toggleTutorForm() {
  const form = document.getElementById('tutor-form');
  const user = dbGetCurrentUser();
  const isVisible = form.style.display === 'block';

  if (!isVisible && user) {
    const existing = await dbGetMyTutorProfile(user.id);
    if (existing) {
      isEditingTutor = true;
      document.getElementById('tutor-form-title').textContent = 'Edit your tutor profile';
      document.getElementById('tutor-submit-btn').textContent = 'Save changes';
      document.getElementById('t-name').value = existing.name || '';
      document.getElementById('t-subjects').value = existing.subjects || '';
      document.getElementById('t-target').value = existing.target_students || '';
      document.getElementById('t-rate').value = existing.hourly_rate || '';
      document.getElementById('t-location').value = existing.location || '';
      document.getElementById('t-format').value = existing.format || 'Online';
      document.getElementById('t-availability').value = existing.availability || '';
      document.getElementById('t-contact').value = existing.contact || '';
      document.getElementById('t-about').value = existing.about || '';

      if (!document.getElementById('delete-tutor-btn')) {
        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'delete-tutor-btn';
        deleteBtn.className = 'danger-btn';
        deleteBtn.style.marginTop = '10px';
        deleteBtn.textContent = 'Delete tutor profile';
        deleteBtn.onclick = confirmDeleteTutor;
        form.appendChild(deleteBtn);
      }
    } else {
      isEditingTutor = false;
      document.getElementById('tutor-form-title').textContent = 'Register as a tutor';
      document.getElementById('tutor-submit-btn').textContent = 'Submit profile';
      const deleteBtn = document.getElementById('delete-tutor-btn');
      if (deleteBtn) deleteBtn.remove();
    }
  }

  form.style.display = isVisible ? 'none' : 'block';
}

async function submitTutorProfile() {
  const user = dbGetCurrentUser();

  if (!user) {
    alert('You need to be signed in.');
    window.location.href = 'signin.html';
    return;
  }

  const name = document.getElementById('t-name').value.trim();
  const subjects = document.getElementById('t-subjects').value.trim();
  const target_students = document.getElementById('t-target').value.trim();
  const hourly_rate = document.getElementById('t-rate').value.trim();
  const location = document.getElementById('t-location').value.trim();
  const format = document.getElementById('t-format').value;
  const availability = document.getElementById('t-availability').value.trim();
  const contact = document.getElementById('t-contact').value.trim();
  const about = document.getElementById('t-about').value.trim();
  const avatarFile = document.getElementById('t-avatar').files[0];

  if (!name || !subjects || !hourly_rate || !location || !about || !contact) {
    const err = document.getElementById('tutor-error');
    err.textContent = 'Please fill in all fields.';
    err.style.display = 'block';
    return;
  }

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

  let result;
  if (isEditingTutor) {
    const updates = { name, subjects, target_students, hourly_rate, location, format, availability, contact, about };
    if (avatar_url) updates.avatar_url = avatar_url;
    result = await dbUpdateTutor(user.id, updates);
  } else {
    result = await dbAddTutor({
      user_id: user.id,
      name, subjects, target_students, hourly_rate, location, format, availability, contact, about, avatar_url
    });
  }

  if (!result.success) {
    const err = document.getElementById('tutor-error');
    err.textContent = result.error;
    err.style.display = 'block';
    return;
  }

  toggleTutorForm();
  await initCatalogue();
}

async function confirmDeleteTutor() {
  if (!confirm('Are you sure you want to delete your tutor profile?')) return;
  const user = dbGetCurrentUser();
  await dbDeleteTutor(user.id);
  toggleTutorForm();
  await initCatalogue();
}

// --- PROFILE PAGE ---

async function initProfile() {
  updateNav();
  const params = new URLSearchParams(window.location.search);
  const tutorId = params.get('id');
  if (!tutorId) { window.location.href = 'catalogue.html'; return; }

  const t = await dbGetTutorById(tutorId);
  if (!t) { window.location.href = 'catalogue.html'; return; }

  document.title = t.name + ' — Tutorial';

  document.getElementById('profile-content').innerHTML = `
    <div class="profile-wrap">
      <a href="catalogue.html" class="back-link">← Back to catalogue</a>

      <div class="profile-top">
        <div class="tutor-avatar">
          ${t.avatar_url
            ? `<img src="${t.avatar_url}" alt="${t.name}" class="profile-img">`
            : `<div class="avatar-placeholder profile-placeholder">${t.name.charAt(0).toUpperCase()}</div>`
          }
        </div>
        <div class="profile-top-info">
          <h2>${t.name}</h2>
          <div class="profile-subjects">${t.subjects}</div>
          <div class="profile-rate">$${t.hourly_rate}<small>/hr</small></div>
        </div>
      </div>

      <div class="profile-details-row">
        <div class="profile-detail-item"><span class="field-label">Location:</span> ${t.location}</div>
        <div class="profile-detail-item"><span class="field-label">Format:</span> ${t.format}</div>
        <div class="profile-detail-item"><span class="field-label">Availability:</span> ${t.availability || 'Not specified'}</div>
        <div class="profile-detail-item"><span class="field-label">Target students:</span> ${t.target_students || 'Not specified'}</div>
        <div class="profile-detail-item"><span class="field-label">Contact details:</span> ${t.contact}</div>
      </div>

      <div class="profile-about">
        <h3>About me</h3>
        <p>${t.about}</p>
      </div>
    </div>
  `;
}

if (document.getElementById('profile-content')) {
  initProfile();
}

// --- ACCOUNT PAGE ---

async function initAccount() {
  updateNav();
  const user = dbGetCurrentUser();
  if (!user) { window.location.href = 'signin.html'; return; }

  document.getElementById('a-name').value = user.name;
  document.getElementById('a-email').value = user.email;
}

async function saveAccountChanges() {
  const user = dbGetCurrentUser();
  const name = document.getElementById('a-name').value.trim();
  const email = document.getElementById('a-email').value.trim();
  const password = document.getElementById('a-password').value.trim();

  if (!name || !email) {
    showAccountMsg('Name and email cannot be empty.', 'red');
    return;
  }

  const updates = { name, email };
  if (password) updates.password = password;

  const result = await dbUpdateUser(user.id, updates);
  if (!result.success) {
    showAccountMsg(result.error, 'red');
    return;
  }

  showAccountMsg('Changes saved!', 'green');
}

async function confirmDeleteAccount() {
  if (!confirm('Are you sure? This will permanently delete your account and cannot be undone.')) return;
  const user = dbGetCurrentUser();
  const result = await dbDeleteUser(user.id);
  if (!result.success) { alert('Error deleting account: ' + result.error); return; }
  dbSignOut();
  window.location.href = 'index.html';
}

function showAccountMsg(msg, color) {
  const el = document.getElementById('account-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
  el.style.display = 'block';
}

if (document.querySelector('.account-wrap')) {
  initAccount();
}

// --- SIGN OUT ---

function signOut() {
  dbSignOut();
  window.location.href = 'index.html';
}

if (document.getElementById('tutor-list')) {
  initCatalogue();
}