let isRegister = false;
let isEditingTutor = false;
let allTutors = [];
let userFavourites = [];
let currentTutorId = null;
let currentTutorData = null;
let userVotes = {};
let reviewSortMode = 'recent-desc';

// --- NAV ---

function updateNav() {
  const user = dbGetCurrentUser();
  const navLinks = document.getElementById('nav-links');
  if (!navLinks) return;
  if (user) {
    navLinks.innerHTML = `
      <a href="index.html">Home</a>
      <a href="catalogue.html">Browse tutors</a>
      <a href="favourites.html">⭐ Favourites</a>
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

function initHome() {
  updateNav();
  const user = dbGetCurrentUser();
  // If already signed in, "Get started" goes to catalogue
  if (user) {
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

// --- CATALOGUE ---

async function initCatalogue() {
  updateNav();
  const user = dbGetCurrentUser();
  const btn = document.getElementById('register-tutor-btn');
  const viewBtn = document.getElementById('view-tutor-btn');

  if (user) {
    userFavourites = await dbGetFavourites(user.id);
    const existing = await dbGetMyTutorProfile(user.id);
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
  const user = dbGetCurrentUser();

  if (tutors.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = tutors.map(t => {
    const isMine = user && t.user_id === user.id;
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
          ${user && !isMine ? `
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
  const user = dbGetCurrentUser();
  if (!user) { window.location.href = 'signin.html'; return; }
  const isFav = userFavourites.includes(tutorId);
  if (isFav) {
    await dbRemoveFavourite(user.id, tutorId);
    userFavourites = userFavourites.filter(id => id !== tutorId);
    btn.textContent = '☆'; btn.classList.remove('fav');
  } else {
    await dbAddFavourite(user.id, tutorId);
    userFavourites.push(tutorId);
    btn.textContent = '★'; btn.classList.add('fav');
  }
}

function viewProfile(tutorId) { window.location.href = 'profile.html?id=' + tutorId; }

function viewMyTutorProfile() {
  const user = dbGetCurrentUser();
  if (!user) return;
  dbGetMyTutorProfile(user.id).then(t => { if (t) window.location.href = 'profile.html?id=' + t.tutor_id; });
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
  if (!user) { window.location.href = 'signin.html'; return; }

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
    result = await dbAddTutor({ user_id: user.id, name, subjects, target_students, hourly_rate, location, format, availability, contact, about, avatar_url });
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

function buildReviewThread(reviews, parentId, tutorId, user, isTutorOwner, depth) {
  const children = reviews.filter(r => parentId === null ? !r.parent_id : r.parent_id === parentId);
  if (children.length === 0) return '';

  return children.map(r => {
    const childReplies = reviews.filter(x => x.parent_id === r.id);
    const repliesHtml = buildReviewThread(reviews, r.id, tutorId, user, isTutorOwner, depth + 1);
    const canReply = user && depth < 2;
    const isOwn = user && r.user_id === user.id;
    const indentClass = depth > 0 ? 'review-reply' : '';
    const userVote = userVotes[r.id] || null;
    const score = getScore(r);
    const sClass = scoreClass(score);

    return `
      <div class="review-item ${indentClass}" id="review-${r.id}">
        <div class="review-header">
          <div class="review-header-left">
            <span class="review-name">${r.reviewer_name}</span>
            ${r.is_tutor ? '<span class="tutor-tag">TUTOR</span>' : ''}
            <span class="review-date">${formatDateTime(r.created_at)}</span>
          </div>
          <div class="review-header-right">
            ${isOwn ? `<button class="delete-review-btn" onclick="deleteReview('${r.id}', '${tutorId}')">🗑 Delete</button>` : ''}
          </div>
        </div>
        <div class="review-comment">${r.comment}</div>
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
            ▶ ${childReplies.length} ${childReplies.length === 1 ? 'reply' : 'replies'}
          </button>
          <div class="replies-container" id="replies-${r.id}" style="display:none">
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

async function initProfile() {
  updateNav();
  const params = new URLSearchParams(window.location.search);
  const tutorId = params.get('id');
  if (!tutorId) { window.location.href = 'catalogue.html'; return; }

  const t = await dbGetTutorById(tutorId);
  if (!t) { window.location.href = 'catalogue.html'; return; }

  currentTutorId = tutorId;
  currentTutorData = t;

  const user = dbGetCurrentUser();
  const isMine = user && t.user_id === user.id;
  const isFav = user && !isMine ? (await dbGetFavourites(user.id)).includes(tutorId) : false;

  if (user) userVotes = await dbGetUserVotes(user.id);

  document.title = t.name + ' — 🤺Tutorial';

  const reviews = await dbGetReviews(tutorId);
  const sorted = sortReviews(reviews, reviewSortMode);
  const topLevelCount = reviews.filter(r => !r.parent_id).length;
  const threadHtml = buildReviewThread(sorted, null, tutorId, user, isMine, 0);

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
        ${user && !isMine ? `
          <button class="star-btn-large ${isFav ? 'fav' : ''}" id="profile-fav-btn" onclick="toggleFavouriteProfile('${tutorId}')">
            ${isFav ? '★ Saved' : '☆ Save to favourites'}
          </button>
        ` : ''}
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
        ${user ? `
          <div class="review-form">
            <h4>${isMine ? 'Comment on your profile' : 'Leave a review/comment'}</h4>
            <textarea id="review-input" rows="3" placeholder="${isMine ? 'Reply to feedback or answer questions...' : 'Share your experience or ask a question...'}"></textarea>
            <div id="review-error" style="color:red; font-size:13px; margin-bottom:8px; display:none;"></div>
            <button class="signin-btn" style="width:auto; padding:9px 20px;" onclick="submitReview('${tutorId}')">Post</button>
          </div>
        ` : `<p class="review-signin-note"><a href="signin.html">Sign in</a> to leave a review/comment.</p>`}
      </div>
    </div>
  `;
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
  const user = dbGetCurrentUser();
  if (!user) { window.location.href = 'signin.html'; return; }
  const comment = document.getElementById('review-input').value.trim();
  const errEl = document.getElementById('review-error');
  if (!comment) { errEl.textContent = 'Please write something before posting.'; errEl.style.display = 'block'; return; }
  const isTutor = currentTutorData && currentTutorData.user_id === user.id;
  const result = await dbAddReview(tutorId, user.id, user.name, comment, null, isTutor);
  if (!result.success) { errEl.textContent = 'Error: ' + result.error; errEl.style.display = 'block'; return; }
  document.getElementById('review-input').value = '';
  errEl.style.display = 'none';
  await refreshReviews(tutorId);
}

async function submitReply(tutorId, parentId) {
  const user = dbGetCurrentUser();
  if (!user) { window.location.href = 'signin.html'; return; }
  const input = document.getElementById('reply-input-' + parentId);
  const errEl = document.getElementById('reply-error-' + parentId);
  const comment = input.value.trim();
  if (!comment) { errEl.textContent = 'Please write something.'; errEl.style.display = 'block'; return; }
  const isTutor = currentTutorData && currentTutorData.user_id === user.id;
  const result = await dbAddReview(tutorId, user.id, user.name, comment, parentId, isTutor);
  if (!result.success) { errEl.textContent = 'Error: ' + result.error; errEl.style.display = 'block'; return; }
  input.value = '';
  errEl.style.display = 'none';
  document.getElementById('reply-box-' + parentId).style.display = 'none';
  await refreshReviews(tutorId);
}

async function deleteReview(reviewId, tutorId) {
  if (!confirm('Delete this review/comment?')) return;
  const user = dbGetCurrentUser();
  const result = await dbDeleteReview(reviewId, user.id);
  if (!result.success) { alert('Error deleting: ' + result.error); return; }
  await refreshReviews(tutorId);
}

async function handleVote(reviewId, vote, tutorId) {
  const user = dbGetCurrentUser();
  if (!user) { window.location.href = 'signin.html'; return; }
  const result = await dbVote(reviewId, user.id, vote);
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
  const user = dbGetCurrentUser();
  if (user) userVotes = await dbGetUserVotes(user.id);
  const reviews = await dbGetReviews(tutorId);
  const sorted = sortReviews(reviews, reviewSortMode);
  const topLevelCount = reviews.filter(r => !r.parent_id).length;
  const isMine = user && currentTutorData && currentTutorData.user_id === user.id;
  const threadHtml = buildReviewThread(sorted, null, tutorId, user, isMine, 0);
  const listEl = document.getElementById('reviews-list');
  const countEl = document.getElementById('review-count-label');
  if (listEl) listEl.innerHTML = threadHtml || '<p class="no-reviews-msg">No reviews/comments yet. Be the first!</p>';
  if (countEl) countEl.textContent = `(${topLevelCount})`;
}

async function toggleFavouriteProfile(tutorId) {
  const user = dbGetCurrentUser();
  if (!user) { window.location.href = 'signin.html'; return; }
  const favs = await dbGetFavourites(user.id);
  const isFav = favs.includes(tutorId);
  const btn = document.getElementById('profile-fav-btn');
  if (isFav) {
    await dbRemoveFavourite(user.id, tutorId);
    btn.textContent = '☆ Save to favourites';
    btn.classList.remove('fav');
  } else {
    await dbAddFavourite(user.id, tutorId);
    btn.textContent = '★ Saved';
    btn.classList.add('fav');
  }
}

if (document.getElementById('profile-content')) initProfile();

// --- FAVOURITES ---

async function initFavourites() {
  updateNav();
  const user = dbGetCurrentUser();
  const list = document.getElementById('favourites-list');
  const empty = document.getElementById('fav-empty');
  if (!user) { empty.textContent = 'Sign in to see your favourites.'; return; }
  const favIds = await dbGetFavourites(user.id);
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
  const user = dbGetCurrentUser();
  await dbRemoveFavourite(user.id, tutorId);
  btn.closest('.tutor-card').remove();
  if (!document.querySelector('.tutor-card')) {
    document.getElementById('fav-empty').textContent = 'You have no saved tutors yet.';
    document.getElementById('fav-empty').style.display = 'block';
  }
}

if (document.getElementById('favourites-list')) initFavourites();

// --- ACCOUNT ---

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
  if (!name || !email) { showAccountMsg('Name and email cannot be empty.', 'red'); return; }
  const updates = { name, email };
  if (password) updates.password = password;
  const result = await dbUpdateUser(user.id, updates);
  if (!result.success) { showAccountMsg(result.error, 'red'); return; }
  showAccountMsg('Changes saved!', 'green');
}

async function confirmDeleteAccount() {
  if (!confirm('Are you sure? This will permanently delete your account and cannot be undone.')) return;
  const user = dbGetCurrentUser();
  const result = await dbDeleteUser(user.id);
  if (!result.success) { alert('Error: ' + result.error); return; }
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

if (document.querySelector('.account-wrap')) initAccount();

function signOut() {
  dbSignOut();
  window.location.href = 'index.html';
}