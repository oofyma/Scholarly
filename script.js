let isRegister = false;
let isEditingTutor = false;
let allTutors = [];
let userFavourites = [];
let currentTutorId = null;
let currentTutorData = null;
let userVotes = {};
let reviewSortMode = 'recent-desc';
let currentUser = null;

async function initAuth() {
  currentUser = await dbGetCurrentUser();
  return currentUser;
}

async function updateNav() {
  const user = currentUser || await dbGetCurrentUser();
  const navLinks = document.getElementById('nav-links');
  if (!navLinks) return;
  if (user) {
    const unread = await dbGetUnreadCount(user.id);
    const notifLabel = unread > 0
      ? `🔔 Notifications <span class="notif-count">${unread}</span>`
      : '🔔 Notifications';
    navLinks.innerHTML = `
      <a href="index.html">Home</a>
      <a href="catalogue.html">Browse tutors</a>
      <a href="favourites.html">⭐ Favourites</a>
      <a href="notifications.html">${notifLabel}</a>
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

// --- HOME ---

async function initHome() {
  await initAuth();
  updateNav();
  if (currentUser) {
    const cta1 = document.getElementById('cta-btn');
    const cta2 = document.getElementById('cta-btn-2');
    if (cta1) { cta1.href = 'catalogue.html'; cta1.textContent = 'Browse tutors →'; }
    if (cta2) { cta2.href = 'catalogue.html'; cta2.textContent = 'Browse tutors →'; }
  }
}

if (document.querySelector('.hero')) initHome();

// --- SIGN IN ---

function toggleForm() {
  isRegister = !isRegister;
  document.getElementById('form-title').textContent = isRegister ? 'Create account' : 'Sign in';
  document.getElementById('form-sub').textContent = isRegister ? 'Join 🤺Tutorial' : 'Welcome back';
  document.getElementById('form-btn').textContent = isRegister ? 'Register' : 'Sign in';
  document.getElementById('reg-name').style.display = isRegister ? 'block' : 'none';
  document.getElementById('toggle-link').textContent = isRegister
    ? 'Already have an account? Sign in'
    : "Don't have an account? Register";
  showError('');
}

async function handleSubmit() {
  const email = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value.trim();
  if (!email || !password) { showError('Please fill in all fields.'); return; }

  if (isRegister) {
    const name = document.getElementById('input-name').value.trim();
    if (!name) { showError('Please enter your name.'); return; }
    if (password.length < 6) { showError('Password must be at least 6 characters.'); return; }
    const result = await dbSignUp(name, email, password);
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

// --- CATALOGUE ---

async function initCatalogue() {
  await initAuth();
  updateNav();
  const btn = document.getElementById('register-tutor-btn');
  const viewBtn = document.getElementById('view-tutor-btn');

  if (currentUser) {
    userFavourites = await dbGetFavourites(currentUser.id);
    const existing = await dbGetMyTutorProfile(currentUser.id);
    if (btn) {
      btn.textContent = existing ? '✏️ Edit your tutor profile' : '+ Register as a tutor';
      btn.style.display = 'inline-block';
    }
    if (viewBtn && existing) viewBtn.style.display = 'inline-block';
  }

  allTutors = await dbGetTutors();
  for (let t of allTutors) {
    t._reviewCount = await dbGetReviewCount(t.tutor_id);
  }
  renderTutors(allTutors);
}

function applyFilters() {
  const search = document.getElementById('search-input').value.toLowerCase().trim();
  const format = document.getElementById('filter-format').value;
  const priceMin = parseFloat(document.getElementById('filter-price-min').value) || 0;
  const priceMax = parseFloat(document.getElementById('filter-price-max').value) || Infinity;
  const sort = document.getElementById('filter-sort').value;

  let filtered = allTutors.filter(t => {
    const searchable = [t.name, t.subjects, t.location, t.format, t.availability, t.about, t.target_students, t.contact]
      .filter(Boolean).join(' ').toLowerCase();
    const matchSearch = !search || searchable.includes(search);
    const matchFormat = !format || t.format === format;
    const matchPrice = t.hourly_rate >= priceMin && t.hourly_rate <= priceMax;
    return matchSearch && matchFormat && matchPrice;
  });

  if (sort === 'price-asc') filtered.sort((a, b) => a.hourly_rate - b.hourly_rate);
  else if (sort === 'price-desc') filtered.sort((a, b) => b.hourly_rate - a.hourly_rate);
  renderTutors(filtered);
}

function clearFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-format').value = '';
  document.getElementById('filter-price-min').value = '';
  document.getElementById('filter-price-max').value = '';
  document.getElementById('filter-sort').value = '';
  renderTutors(allTutors);
}

function renderTutors(tutors) {
  const list = document.getElementById('tutor-list');
  const empty = document.getElementById('empty-state');

  if (tutors.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = tutors.map(t => {
    const isMine = currentUser && t.user_id === currentUser.id;
    const isFav = userFavourites.includes(t.tutor_id);
    const count = t._reviewCount || 0;
    const reviewLabel = count === 1 ? '1 review/comment' : `${count} reviews/comments`;

    return `
      <div class="tutor-card" onclick="viewProfile('${t.tutor_id}')">
        <div class="tutor-avatar-wrap">
          ${t.avatar_url
            ? `<img src="${t.avatar_url}" alt="${t.name}" class="tutor-avatar-img">`
            : `<div class="avatar-placeholder">${t.name.charAt(0).toUpperCase()}</div>`
          }
          ${count > 0 ? `<div class="review-badge">${reviewLabel}</div>` : ''}
        </div>
        <div class="tutor-info">
          <h3>${t.name}${isMine ? ' <span class="you-tag">(you)</span>' : ''}</h3>
          <div class="tutor-field"><span class="field-label">Subjects:</span> ${t.subjects}</div>
          <div class="tutor-field"><span class="field-label">Target students:</span> ${t.target_students || 'Not specified'}</div>
          <div class="tutor-field"><span class="field-label">Location:</span> ${t.location}</div>
          <div class="tutor-field"><span class="field-label">Format:</span> ${t.format}</div>
          <div class="tutor-field"><span class="field-label">Availability:</span> ${t.availability || 'Not specified'}</div>
        </div>
        <div class="tutor-right">
          <div class="tutor-rate">$${t.hourly_rate}<small>/hr</small></div>
          <div class="view-profile-link">View profile →</div>
          ${currentUser && !isMine ? `
            <button class="star-btn ${isFav ? 'fav' : ''}" onclick="event.stopPropagation(); toggleFavourite('${t.tutor_id}', this)">
              ${isFav ? '★' : '☆'}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function toggleFavourite(tutorId, btn) {
  if (!currentUser) { window.location.href = 'signin.html'; return; }
  const isFav = userFavourites.includes(tutorId);
  if (isFav) {
    await dbRemoveFavourite(currentUser.id, tutorId);
    userFavourites = userFavourites.filter(id => id !== tutorId);
    btn.textContent = '☆'; btn.classList.remove('fav');
  } else {
    await dbAddFavourite(currentUser.id, tutorId);
    userFavourites.push(tutorId);
    btn.textContent = '★'; btn.classList.add('fav');
  }
}

function viewProfile(tutorId) { window.location.href = 'profile.html?id=' + tutorId; }

function viewMyTutorProfile() {
  if (!currentUser) return;
  dbGetMyTutorProfile(currentUser.id).then(t => {
    if (t) window.location.href = 'profile.html?id=' + t.tutor_id;
  });
}

async function toggleTutorForm() {
  const form = document.getElementById('tutor-form');
  const isVisible = form.style.display === 'block';

  if (!isVisible && currentUser) {
    const existing = await dbGetMyTutorProfile(currentUser.id);
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
  if (!currentUser) { window.location.href = 'signin.html'; return; }

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
    result = await dbUpdateTutor(currentUser.id, updates);
  } else {
    result = await dbAddTutor({ user_id: currentUser.id, name, subjects, target_students, hourly_rate, location, format, availability, contact, about, avatar_url });
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
  await dbDeleteTutor(currentUser.id);
  toggleTutorForm();
  await initCatalogue();
}

if (document.getElementById('tutor-list')) initCatalogue();

// --- PROFILE PAGE ---

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function sortReviews(reviews, mode) {
  const topLevel = reviews.filter(r => !r.parent_id);
  const replies = reviews.filter(r => r.parent_id);
  if (mode === 'popular') topLevel.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  else if (mode === 'recent-desc') topLevel.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else if (mode === 'recent-asc') topLevel.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return [...topLevel, ...replies];
}

function getScore(r) { return (r.upvotes || 0) - (r.downvotes || 0); }
function scoreClass(score) { if (score > 0) return 'positive'; if (score < 0) return 'negative'; return ''; }

function getReviewIdsToOpen(reviews, targetId) {
  const toOpen = new Set();
  function findParents(id) {
    const r = reviews.find(x => x.id === id);
    if (!r || !r.parent_id) return;
    toOpen.add(r.parent_id);
    findParents(r.parent_id);
  }
  findParents(targetId);
  return toOpen;
}

function buildReviewThread(reviews, parentId, tutorId, user, depth, openIds) {
  const children = reviews.filter(r => parentId === null ? !r.parent_id : r.parent_id === parentId);
  if (children.length === 0) return '';

  return children.map(r => {
    const childReplies = reviews.filter(x => x.parent_id === r.id);
    const repliesHtml = buildReviewThread(reviews, r.id, tutorId, user, depth + 1, openIds);
    const canReply = user && depth < 2;
    const isOwn = user && r.user_id === user.id;
    const indentClass = depth > 0 ? 'review-reply' : '';
    const userVote = userVotes[r.id] || null;
    const score = getScore(r);
    const sClass = scoreClass(score);
    const shouldOpen = openIds && openIds.has(r.id);

    return `
      <div class="review-item ${indentClass}" id="review-${r.id}">
        <div class="review-header">
          <div class="review-header-left">
            <span class="review-name">${r.reviewer_name}</span>
            ${isOwn ? '<span class="you-tag">(you)</span>' : ''}
            ${r.is_tutor ? '<span class="tutor-tag">TUTOR</span>' : ''}
            <span class="review-date">${formatDateTime(r.created_at)}</span>
            ${r.is_edited ? '<span class="edited-tag">(edited)</span>' : ''}
          </div>
          <div class="review-header-right">
            ${isOwn ? `<button class="edit-review-btn" onclick="startEditReview('${r.id}', this)">✏️ Edit</button>` : ''}
            ${isOwn ? `<button class="delete-review-btn" onclick="deleteReview('${r.id}', '${tutorId}')">🗑 Delete</button>` : ''}
            ${user && !isOwn ? `<button class="report-btn" onclick="showReportModal('review', '${r.id}')">⚑ Report</button>` : ''}
          </div>
        </div>
        <div class="review-comment" id="comment-text-${r.id}">${r.comment}</div>
        <div class="edit-box" id="edit-box-${r.id}" style="display:none">
          <textarea id="edit-input-${r.id}" rows="2">${r.comment}</textarea>
          <div style="display:flex; gap:8px; margin-top:6px;">
            <button class="signin-btn" style="width:auto; padding:6px 14px; font-size:13px;" onclick="submitEditReview('${r.id}', '${tutorId}')">Save</button>
            <button class="cancel-btn" style="width:auto; padding:6px 14px; font-size:13px;" onclick="cancelEditReview('${r.id}')">Cancel</button>
          </div>
        </div>
        <div class="review-actions">
          <div class="vote-controls">
            <button class="vote-arrow up ${userVote === 'up' ? 'voted' : ''}" onclick="handleVote('${r.id}', 'up', '${tutorId}')" title="Upvote">▲</button>
            <span class="vote-score ${sClass}" id="score-${r.id}">${score}</span>
            <button class="vote-arrow down ${userVote === 'down' ? 'voted' : ''}" onclick="handleVote('${r.id}', 'down', '${tutorId}')" title="Downvote">▼</button>
          </div>
          ${canReply ? `<button class="reply-toggle-btn" onclick="toggleReplyBox('${r.id}')">↩ Reply</button>` : ''}
        </div>
        <div class="reply-box" id="reply-box-${r.id}" style="display:none">
          <textarea rows="2" placeholder="Write a reply..." id="reply-input-${r.id}"></textarea>
          <div id="reply-error-${r.id}" style="color:red; font-size:12px; margin-bottom:4px; display:none;"></div>
          <button class="signin-btn" style="width:auto; padding:7px 16px; font-size:13px;" onclick="submitReply('${tutorId}', '${r.id}')">Post reply</button>
        </div>
        ${childReplies.length > 0 ? `
          <button class="toggle-replies-btn" id="toggle-btn-${r.id}" onclick="toggleReplies('${r.id}')">
            ${shouldOpen ? '▼ Hide replies' : `▶ ${childReplies.length} ${childReplies.length === 1 ? 'reply' : 'replies'}`}
          </button>
          <div class="replies-container" id="replies-${r.id}" style="display:${shouldOpen ? 'block' : 'none'}">
            ${repliesHtml}
          </div>
        ` : repliesHtml}
      </div>
    `;
  }).join('');
}

function toggleReplies(reviewId) {
  const container = document.getElementById('replies-' + reviewId);
  const btn = document.getElementById('toggle-btn-' + reviewId);
  const isHidden = container.style.display === 'none';
  container.style.display = isHidden ? 'block' : 'none';
  const count = container.querySelectorAll(':scope > .review-reply').length;
  btn.textContent = isHidden ? '▼ Hide replies' : `▶ ${count} ${count === 1 ? 'reply' : 'replies'}`;
}

function startEditReview(reviewId, btn) {
  document.getElementById('comment-text-' + reviewId).style.display = 'none';
  document.getElementById('edit-box-' + reviewId).style.display = 'block';
  btn.style.display = 'none';
}

function cancelEditReview(reviewId) {
  document.getElementById('comment-text-' + reviewId).style.display = 'block';
  document.getElementById('edit-box-' + reviewId).style.display = 'none';
  const editBtn = document.querySelector(`#review-${reviewId} .edit-review-btn`);
  if (editBtn) editBtn.style.display = 'inline';
}

async function submitEditReview(reviewId, tutorId) {
  const newComment = document.getElementById('edit-input-' + reviewId).value.trim();
  if (!newComment) return;
  const result = await dbEditReview(reviewId, currentUser.id, newComment);
  if (!result.success) { alert('Error editing: ' + result.error); return; }
  await refreshReviews(tutorId);
}

async function initProfile() {
  await initAuth();
  updateNav();

  const params = new URLSearchParams(window.location.search);
  const tutorId = params.get('id');
  if (!tutorId) { window.location.href = 'catalogue.html'; return; }

  const t = await dbGetTutorById(tutorId);
  if (!t) { window.location.href = 'catalogue.html'; return; }

  currentTutorId = tutorId;
  currentTutorData = t;

  const isMine = currentUser && t.user_id === currentUser.id;
  const isFav = currentUser && !isMine ? (await dbGetFavourites(currentUser.id)).includes(tutorId) : false;

  if (currentUser) userVotes = await dbGetUserVotes(currentUser.id);

  document.title = t.name + ' - 🤺Tutorial';

  const reviews = await dbGetReviews(tutorId);
  const sorted = sortReviews(reviews, reviewSortMode);
  const topLevelCount = reviews.filter(r => !r.parent_id).length;

  const targetReviewId = window.location.hash ? window.location.hash.replace('#review-', '') : null;
  const openIds = targetReviewId ? getReviewIdsToOpen(reviews, targetReviewId) : new Set();

  const threadHtml = buildReviewThread(sorted, null, tutorId, currentUser, 0, openIds);

  document.getElementById('profile-content').innerHTML = `
    <div class="profile-wrap">
      <a href="catalogue.html" class="back-link">← Back to catalogue</a>

      <div class="profile-top">
        <div>
          ${t.avatar_url
            ? `<img src="${t.avatar_url}" alt="${t.name}" class="profile-img">`
            : `<div class="avatar-placeholder profile-placeholder">${t.name.charAt(0).toUpperCase()}</div>`
          }
        </div>
        <div class="profile-top-info">
          <h2>${t.name}${isMine ? ' <span class="you-tag">(you)</span>' : ''}</h2>
          <div class="profile-subjects">${t.subjects}</div>
          <div class="profile-rate">$${t.hourly_rate}<small>/hr</small></div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-left:auto;">
          ${currentUser && !isMine ? `
            <button class="star-btn-large ${isFav ? 'fav' : ''}" id="profile-fav-btn" onclick="toggleFavouriteProfile('${tutorId}')">
              ${isFav ? '★ Saved' : '☆ Save to favourites'}
            </button>
            <button class="report-btn-large" onclick="showReportModal('tutor', '${tutorId}')">⚑ Report tutor</button>
          ` : ''}
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

      <div class="profile-reviews">
        <div class="reviews-header">
          <h3>Reviews/comments <span id="review-count-label">(${topLevelCount})</span></h3>
          <select class="review-sort-select" onchange="changeReviewSort(this.value)">
            <option value="recent-desc" ${reviewSortMode === 'recent-desc' ? 'selected' : ''}>Newest first</option>
            <option value="recent-asc" ${reviewSortMode === 'recent-asc' ? 'selected' : ''}>Oldest first</option>
            <option value="popular" ${reviewSortMode === 'popular' ? 'selected' : ''}>Most popular</option>
          </select>
        </div>
        <div id="reviews-list">
          ${threadHtml || '<p class="no-reviews-msg">No reviews/comments yet. Be the first!</p>'}
        </div>
        ${currentUser ? `
          <div class="review-form">
            <h4>${isMine ? 'Comment on your profile' : 'Leave a review/comment'}</h4>
            <textarea id="review-input" rows="3" placeholder="${isMine ? 'Reply to feedback or answer questions...' : 'Share your experience or ask a question...'}"></textarea>
            <div id="review-error" style="color:red; font-size:13px; margin-bottom:8px; display:none;"></div>
            <button class="signin-btn" style="width:auto; padding:9px 20px;" onclick="submitReview('${tutorId}')">Post</button>
          </div>
        ` : `<p class="review-signin-note"><a href="signin.html">Sign in</a> to leave a review/comment.</p>`}
      </div>
    </div>

    <div id="report-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:999; align-items:center; justify-content:center;">
      <div style="background:white; border-radius:10px; padding:28px; max-width:420px; width:90%; margin:auto; position:relative; top:50%; transform:translateY(-50%);">
        <h3 style="font-size:17px; font-weight:600; margin-bottom:8px; color:#1e2d5f;">Report</h3>
        <p style="font-size:13px; color:#888; margin-bottom:16px;">Tell us why you're reporting this content.</p>
        <select id="report-reason" style="width:100%; margin-bottom:14px; padding:9px 12px; border:1px solid #ccc; border-radius:6px; font-size:14px;">
          <option value="">Select a reason...</option>
          <option value="Inappropriate content">Inappropriate content</option>
          <option value="Spam or advertising">Spam or advertising</option>
          <option value="Harassment or abuse">Harassment or abuse</option>
          <option value="False or misleading information">False or misleading information</option>
          <option value="Other">Other</option>
        </select>
        <textarea id="report-details" rows="3" placeholder="Any additional details (optional)..." style="width:100%; padding:9px 12px; border:1px solid #ccc; border-radius:6px; font-size:14px; margin-bottom:14px; font-family:sans-serif;"></textarea>
        <div id="report-error" style="color:red; font-size:13px; margin-bottom:10px; display:none;"></div>
        <div style="display:flex; gap:10px;">
          <button class="signin-btn" style="flex:1;" onclick="submitReport()">Submit report</button>
          <button class="cancel-btn" style="flex:1;" onclick="closeReportModal()">Cancel</button>
        </div>
      </div>
    </div>
  `;

  if (targetReviewId) {
    setTimeout(() => {
      const el = document.getElementById('review-' + targetReviewId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight-review');
        setTimeout(() => el.classList.remove('highlight-review'), 2500);
      }
    }, 400);
  }
}

let reportTarget = { type: null, id: null };

function showReportModal(type, id) {
  if (!currentUser) { window.location.href = 'signin.html'; return; }
  reportTarget = { type, id };
  document.getElementById('report-modal').style.display = 'flex';
}

function closeReportModal() {
  document.getElementById('report-modal').style.display = 'none';
  document.getElementById('report-reason').value = '';
  document.getElementById('report-details').value = '';
  document.getElementById('report-error').style.display = 'none';
  reportTarget = { type: null, id: null };
}

async function submitReport() {
  const reason = document.getElementById('report-reason').value;
  const details = document.getElementById('report-details').value.trim();
  const errEl = document.getElementById('report-error');
  if (!reason) { errEl.textContent = 'Please select a reason.'; errEl.style.display = 'block'; return; }
  const fullReason = details ? `${reason}: ${details}` : reason;
  const result = await dbSubmitReport(currentUser.id, reportTarget.type, reportTarget.id, fullReason);
  if (!result.success) { errEl.textContent = 'Error: ' + result.error; errEl.style.display = 'block'; return; }
  closeReportModal();
  alert('Report submitted. Thank you for helping keep 🤺Tutorial safe.');
}

async function changeReviewSort(mode) {
  reviewSortMode = mode;
  await refreshReviews(currentTutorId);
}

function toggleReplyBox(reviewId) {
  const box = document.getElementById('reply-box-' + reviewId);
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

async function submitReview(tutorId) {
  if (!currentUser) { window.location.href = 'signin.html'; return; }
  const comment = document.getElementById('review-input').value.trim();
  const errEl = document.getElementById('review-error');
  if (!comment) { errEl.textContent = 'Please write something before posting.'; errEl.style.display = 'block'; return; }
  const isTutor = currentTutorData && currentTutorData.user_id === currentUser.id;
  const result = await dbAddReview(tutorId, currentUser.id, currentUser.name, comment, null, isTutor);
  if (!result.success) { errEl.textContent = 'Error: ' + result.error; errEl.style.display = 'block'; return; }
  document.getElementById('review-input').value = '';
  errEl.style.display = 'none';
  await refreshReviews(tutorId);
}

async function submitReply(tutorId, parentId) {
  if (!currentUser) { window.location.href = 'signin.html'; return; }
  const input = document.getElementById('reply-input-' + parentId);
  const errEl = document.getElementById('reply-error-' + parentId);
  const comment = input.value.trim();
  if (!comment) { errEl.textContent = 'Please write something.'; errEl.style.display = 'block'; return; }
  const isTutor = currentTutorData && currentTutorData.user_id === currentUser.id;
  const result = await dbAddReview(tutorId, currentUser.id, currentUser.name, comment, parentId, isTutor);
  if (!result.success) { errEl.textContent = 'Error: ' + result.error; errEl.style.display = 'block'; return; }
  input.value = '';
  errEl.style.display = 'none';
  document.getElementById('reply-box-' + parentId).style.display = 'none';
  await refreshReviews(tutorId);
}

async function deleteReview(reviewId, tutorId) {
  if (!confirm('Delete this review/comment?')) return;
  const result = await dbDeleteReview(reviewId, currentUser.id);
  if (!result.success) { alert('Error deleting: ' + result.error); return; }
  await refreshReviews(tutorId);
}

async function handleVote(reviewId, vote, tutorId) {
  if (!currentUser) { window.location.href = 'signin.html'; return; }
  const result = await dbVote(reviewId, currentUser.id, vote);
  if (!result.success) return;
  if (result.action === 'removed') delete userVotes[reviewId];
  else userVotes[reviewId] = vote;
  const { data } = await db.from('reviews').select('upvotes, downvotes').eq('id', reviewId).single();
  if (data) {
    const score = (data.upvotes || 0) - (data.downvotes || 0);
    const scoreEl = document.getElementById('score-' + reviewId);
    if (scoreEl) { scoreEl.textContent = score; scoreEl.className = 'vote-score ' + scoreClass(score); }
    const reviewEl = document.getElementById('review-' + reviewId);
    if (reviewEl) {
      const upBtn = reviewEl.querySelector('.vote-arrow.up');
      const downBtn = reviewEl.querySelector('.vote-arrow.down');
      if (upBtn) upBtn.classList.toggle('voted', userVotes[reviewId] === 'up');
      if (downBtn) downBtn.classList.toggle('voted', userVotes[reviewId] === 'down');
    }
  }
}

async function refreshReviews(tutorId) {
  if (currentUser) userVotes = await dbGetUserVotes(currentUser.id);
  const reviews = await dbGetReviews(tutorId);
  const sorted = sortReviews(reviews, reviewSortMode);
  const topLevelCount = reviews.filter(r => !r.parent_id).length;
  const threadHtml = buildReviewThread(sorted, null, tutorId, currentUser, 0, new Set());
  const listEl = document.getElementById('reviews-list');
  const countEl = document.getElementById('review-count-label');
  if (listEl) listEl.innerHTML = threadHtml || '<p class="no-reviews-msg">No reviews/comments yet. Be the first!</p>';
  if (countEl) countEl.textContent = `(${topLevelCount})`;
}

async function toggleFavouriteProfile(tutorId) {
  if (!currentUser) { window.location.href = 'signin.html'; return; }
  const favs = await dbGetFavourites(currentUser.id);
  const isFav = favs.includes(tutorId);
  const btn = document.getElementById('profile-fav-btn');
  if (isFav) {
    await dbRemoveFavourite(currentUser.id, tutorId);
    btn.textContent = '☆ Save to favourites';
    btn.classList.remove('fav');
  } else {
    await dbAddFavourite(currentUser.id, tutorId);
    btn.textContent = '★ Saved';
    btn.classList.add('fav');
  }
}

if (document.getElementById('profile-content')) initProfile();

// --- FAVOURITES ---

async function initFavourites() {
  await initAuth();
  updateNav();
  const list = document.getElementById('favourites-list');
  const empty = document.getElementById('fav-empty');
  if (!currentUser) { empty.textContent = 'Sign in to see your favourites.'; return; }
  const favIds = await dbGetFavourites(currentUser.id);
  if (favIds.length === 0) { empty.textContent = 'You have no saved tutors yet. Browse tutors and click ☆ to save them.'; return; }
  empty.style.display = 'none';
  const tutors = await dbGetTutors();
  const favTutors = tutors.filter(t => favIds.includes(t.tutor_id));
  list.innerHTML = favTutors.map(t => `
    <div class="tutor-card" onclick="viewProfile('${t.tutor_id}')">
      <div class="tutor-avatar-wrap">
        ${t.avatar_url
          ? `<img src="${t.avatar_url}" alt="${t.name}" class="tutor-avatar-img">`
          : `<div class="avatar-placeholder">${t.name.charAt(0).toUpperCase()}</div>`
        }
      </div>
      <div class="tutor-info">
        <h3>${t.name}</h3>
        <div class="tutor-field"><span class="field-label">Subjects:</span> ${t.subjects}</div>
        <div class="tutor-field"><span class="field-label">Location:</span> ${t.location}</div>
        <div class="tutor-field"><span class="field-label">Format:</span> ${t.format}</div>
      </div>
      <div class="tutor-right">
        <div class="tutor-rate">$${t.hourly_rate}<small>/hr</small></div>
        <div class="view-profile-link">View profile →</div>
        <button class="star-btn fav" onclick="event.stopPropagation(); removeFavHere('${t.tutor_id}', this)">★</button>
      </div>
    </div>
  `).join('');
}

async function removeFavHere(tutorId, btn) {
  await dbRemoveFavourite(currentUser.id, tutorId);
  btn.closest('.tutor-card').remove();
  if (!document.querySelector('.tutor-card')) {
    document.getElementById('fav-empty').textContent = 'You have no saved tutors yet.';
    document.getElementById('fav-empty').style.display = 'block';
  }
}

if (document.getElementById('favourites-list')) initFavourites();

// --- NOTIFICATIONS ---

function goToReview(tutorId, reviewId, notifId) {
  if (notifId && notifId !== 'null') dbMarkNotificationRead(notifId);
  window.location.href = `profile.html?id=${tutorId}#review-${reviewId}`;
}

async function initNotifications() {
  await initAuth();
  updateNav();

  if (!currentUser) {
    document.getElementById('notif-replies').innerHTML = '<div class="empty-state" style="padding:24px;">Sign in to see your notifications.</div>';
    document.getElementById('notif-liked').innerHTML = '';
    document.getElementById('notif-own').innerHTML = '';
    return;
  }

  // Section 1: Replies & activity
  const notifications = await dbGetNotifications(currentUser.id);
  const repliesEl = document.getElementById('notif-replies');
  if (notifications.length === 0) {
    repliesEl.innerHTML = '<div class="empty-state" style="padding:24px; font-size:14px;">No reply notifications yet.</div>';
  } else {
    repliesEl.innerHTML = notifications.map(n => {
      const d = new Date(n.created_at);
      const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) +
        ' at ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="goToReview('${n.tutor_id}', '${n.review_id}', '${n.id}')">
          <div class="notif-message">${n.message}</div>
          <div class="notif-date">${dateStr}</div>
        </div>
      `;
    }).join('');
  }

  // Section 2: Liked comments
  const likedEl = document.getElementById('notif-liked');
  const { data: votes } = await db.from('review_votes').select('review_id').eq('user_id', currentUser.id).eq('vote', 'up');
  if (!votes || votes.length === 0) {
    likedEl.innerHTML = '<div class="empty-state" style="padding:24px; font-size:14px;">You haven\'t liked any comments yet.</div>';
  } else {
    const reviewIds = votes.map(v => v.review_id);
    const { data: likedReviews } = await db.from('reviews').select('id, comment, reviewer_name, tutor_id, created_at').in('id', reviewIds);
    if (!likedReviews || likedReviews.length === 0) {
      likedEl.innerHTML = '<div class="empty-state" style="padding:24px; font-size:14px;">No liked comments found.</div>';
    } else {
      likedEl.innerHTML = likedReviews.map(r => {
        const d = new Date(r.created_at);
        const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
        const preview = r.comment.length > 100 ? r.comment.substring(0, 100) + '...' : r.comment;
        return `
          <div class="notif-item" onclick="goToReview('${r.tutor_id}', '${r.id}', null)">
            <div class="notif-message">👍 <strong>${r.reviewer_name}</strong>: "${preview}"</div>
            <div class="notif-date">${dateStr}</div>
          </div>
        `;
      }).join('');
    }
  }

  // Section 3: Your own comments
  const ownEl = document.getElementById('notif-own');
  const { data: ownReviews } = await db.from('reviews').select('id, comment, tutor_id, created_at, is_edited, parent_id').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  if (!ownReviews || ownReviews.length === 0) {
    ownEl.innerHTML = '<div class="empty-state" style="padding:24px; font-size:14px;">You haven\'t left any comments yet.</div>';
  } else {
    ownEl.innerHTML = ownReviews.map(r => {
      const d = new Date(r.created_at);
      const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) +
        ' at ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
      const preview = r.comment.length > 100 ? r.comment.substring(0, 100) + '...' : r.comment;
      const label = r.parent_id ? '↩ Reply' : '💬 Comment';
      return `
        <div class="notif-item" onclick="goToReview('${r.tutor_id}', '${r.id}', null)">
          <div class="notif-message">${label}: "${preview}" ${r.is_edited ? '<span style="color:#aaa; font-size:11px;">(edited)</span>' : ''}</div>
          <div class="notif-date">${dateStr}</div>
        </div>
      `;
    }).join('');
  }
}

if (document.getElementById('notif-replies')) initNotifications();

// --- ACCOUNT ---

async function initAccount() {
  await initAuth();
  updateNav();
  if (!currentUser) { window.location.href = 'signin.html'; return; }
  document.getElementById('a-name').value = currentUser.name;
  document.getElementById('a-email-current').value = currentUser.email;
}

async function saveName() {
  const name = document.getElementById('a-name').value.trim();
  if (!name) { showMsg('name-msg', 'Name cannot be empty.', 'red'); return; }
  const result = await dbUpdateName(currentUser.id, name);
  if (!result.success) { showMsg('name-msg', result.error, 'red'); return; }
  currentUser.name = name;
  showMsg('name-msg', 'Name updated!', 'green');
  updateNav();
}

async function saveEmail() {
  const newEmail = document.getElementById('a-email-new').value.trim();
  if (!newEmail) { showMsg('email-msg', 'Please enter a new email address.', 'red'); return; }
  if (newEmail === currentUser.email) { showMsg('email-msg', 'That is already your current email.', 'red'); return; }
  const result = await dbUpdateEmail(newEmail);
  if (!result.success) { showMsg('email-msg', result.error, 'red'); return; }
  currentUser.email = newEmail;
  document.getElementById('a-email-current').value = newEmail;
  document.getElementById('a-email-new').value = '';
  showMsg('email-msg', 'Email updated successfully!', 'green');
}

async function savePassword() {
  const currentPw = document.getElementById('a-password-current').value;
  const newPw = document.getElementById('a-password-new').value;
  const confirmPw = document.getElementById('a-password-confirm').value;
  if (!currentPw || !newPw || !confirmPw) { showMsg('password-msg', 'Please fill in all password fields.', 'red'); return; }
  if (newPw.length < 6) { showMsg('password-msg', 'New password must be at least 6 characters.', 'red'); return; }
  if (newPw !== confirmPw) { showMsg('password-msg', 'New passwords do not match.', 'red'); return; }
  const valid = await dbVerifyPassword(currentPw);
  if (!valid) { showMsg('password-msg', 'Current password is incorrect.', 'red'); return; }
  const result = await dbUpdatePassword(newPw);
  if (!result.success) { showMsg('password-msg', result.error, 'red'); return; }
  showMsg('password-msg', 'Password changed successfully!', 'green');
  document.getElementById('a-password-current').value = '';
  document.getElementById('a-password-new').value = '';
  document.getElementById('a-password-confirm').value = '';
}

async function confirmDeleteAccount() {
  const password = document.getElementById('a-delete-password').value;
  if (!password) { showMsg('delete-msg', 'Please enter your password to confirm.', 'red'); return; }
  const valid = await dbVerifyPassword(password);
  if (!valid) { showMsg('delete-msg', 'Incorrect password.', 'red'); return; }
  if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
  const result = await dbDeleteUser();
  if (!result.success) { showMsg('delete-msg', result.error, 'red'); return; }
  window.location.href = 'index.html';
}

function showMsg(elId, msg, color) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
  el.style.display = 'block';
}

if (document.querySelector('.account-wrap')) initAccount();

async function signOut() {
  await dbSignOut();
  window.location.href = 'index.html';
}