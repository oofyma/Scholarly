const SUPABASE_URL = 'https://ydqaxuksntfpfehvagwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkcWF4dWtzbnRmcGZlaHZhZ3d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMzA0OTEsImV4cCI6MjA5NzYwNjQ5MX0.FhKOQMIzZFZrfR5GCwjQhtzkMk32sh7SY_pFsKHXsOQ';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- AUTH FUNCTIONS ---

async function dbSignUp(name, email, password) {
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) return { success: false, error: error.message };
  const { error: profileError } = await db.from('profiles').insert([{ id: data.user.id, name }]);
  if (profileError) return { success: false, error: profileError.message };
  return { success: true };
}

async function dbSignIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function dbSignOut() {
  await db.auth.signOut();
}

async function dbGetCurrentUser() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return null;
  const { data: profile } = await db.from('profiles').select('name').eq('id', session.user.id).single();
  return {
    id: session.user.id,
    email: session.user.email,
    name: profile ? profile.name : session.user.email
  };
}

async function dbVerifyPassword(password) {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return false;
  const { error } = await db.auth.signInWithPassword({ email: session.user.email, password });
  return !error;
}

async function dbUpdateName(userId, name) {
  const { error } = await db.from('profiles').update({ name }).eq('id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function dbUpdateEmail(newEmail) {
  const { error } = await db.auth.updateUser({ email: newEmail });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function dbUpdatePassword(newPassword) {
  const { error } = await db.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function dbDeleteUser() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return { success: false, error: 'Not signed in.' };
  const userId = session.user.id;
  await db.from('notifications').delete().eq('user_id', userId);
  await db.from('review_votes').delete().eq('user_id', userId);
  await db.from('reviews').delete().eq('user_id', userId);
  await db.from('favourites').delete().eq('user_id', userId);
  await db.from('tutors').delete().eq('user_id', userId);
  await db.from('profiles').delete().eq('id', userId);
  await db.auth.signOut();
  return { success: true };
}

// --- TUTOR FUNCTIONS ---

async function dbUploadAvatar(file) {
  const filename = Date.now() + '-' + file.name;
  const { error } = await db.storage.from('avatars').upload(filename, file);
  if (error) return { success: false, error: error.message };
  const { data } = db.storage.from('avatars').getPublicUrl(filename);
  return { success: true, url: data.publicUrl };
}

async function dbAddTutor(profile) {
  const { error } = await db.from('tutors').insert([profile]);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function dbUpdateTutor(userId, updates) {
  const { error } = await db.from('tutors').update(updates).eq('user_id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function dbDeleteTutor(userId) {
  const { error } = await db.from('tutors').delete().eq('user_id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function dbGetTutors() {
  const { data, error } = await db.from('tutors').select('*');
  if (error) return [];
  return data;
}

async function dbGetTutorById(tutorId) {
  const { data, error } = await db.from('tutors').select('*').eq('tutor_id', tutorId);
  if (error || !data || data.length === 0) return null;
  return data[0];
}

async function dbGetMyTutorProfile(userId) {
  const { data, error } = await db.from('tutors').select('*').eq('user_id', userId);
  if (error || !data || data.length === 0) return null;
  return data[0];
}

// --- FAVOURITES ---

async function dbGetFavourites(userId) {
  const { data, error } = await db.from('favourites').select('tutor_id').eq('user_id', userId);
  if (error) return [];
  return data.map(f => f.tutor_id);
}

async function dbAddFavourite(userId, tutorId) {
  const { error } = await db.from('favourites').insert([{ user_id: userId, tutor_id: tutorId }]);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function dbRemoveFavourite(userId, tutorId) {
  const { error } = await db.from('favourites').delete().eq('user_id', userId).eq('tutor_id', tutorId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// --- REVIEWS ---

async function dbGetReviews(tutorId) {
  const { data, error } = await db.from('reviews').select('*').eq('tutor_id', tutorId).order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

async function dbAddReview(tutorId, userId, reviewerName, comment, parentId, isTutor) {
  const insertData = {
    tutor_id: tutorId,
    user_id: userId,
    reviewer_name: reviewerName,
    comment,
    is_tutor: isTutor || false,
    is_edited: false,
    upvotes: 0,
    downvotes: 0
  };
  if (parentId) insertData.parent_id = parentId;
  const { data, error } = await db.from('reviews').insert([insertData]).select();
  if (error) return { success: false, error: error.message };

  if (parentId) {
    const { data: parentReview } = await db.from('reviews').select('user_id, tutor_id').eq('id', parentId).single();
    if (parentReview && parentReview.user_id !== userId) {
      await db.from('notifications').insert([{
        user_id: parentReview.user_id,
        type: 'reply',
        message: `${reviewerName} replied to your review/comment.`,
        review_id: data[0].id,
        tutor_id: tutorId,
        is_read: false
      }]);
    }
  }

  return { success: true, data: data[0] };
}

async function dbEditReview(reviewId, userId, newComment) {
  const { error } = await db.from('reviews').update({ comment: newComment, is_edited: true }).eq('id', reviewId).eq('user_id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function dbDeleteReview(reviewId, userId) {
  await db.from('reviews').delete().eq('parent_id', reviewId);
  await db.from('review_votes').delete().eq('review_id', reviewId);
  await db.from('notifications').delete().eq('review_id', reviewId);
  const { error } = await db.from('reviews').delete().eq('id', reviewId).eq('user_id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function dbGetReviewCount(tutorId) {
  const { count, error } = await db.from('reviews').select('*', { count: 'exact', head: true }).eq('tutor_id', tutorId).is('parent_id', null);
  if (error) return 0;
  return count;
}

// --- VOTES ---

async function dbGetUserVotes(userId) {
  const { data, error } = await db.from('review_votes').select('review_id, vote').eq('user_id', userId);
  if (error) return {};
  const map = {};
  data.forEach(v => { map[v.review_id] = v.vote; });
  return map;
}

async function dbVote(reviewId, userId, vote) {
  const { data: existing } = await db.from('review_votes').select('*').eq('review_id', reviewId).eq('user_id', userId);
  if (existing && existing.length > 0) {
    const current = existing[0];
    if (current.vote === vote) {
      await db.from('review_votes').delete().eq('id', current.id);
      const field = vote === 'up' ? 'upvotes' : 'downvotes';
      const { data: rev } = await db.from('reviews').select(field).eq('id', reviewId).single();
      await db.from('reviews').update({ [field]: Math.max(0, rev[field] - 1) }).eq('id', reviewId);
      return { success: true, action: 'removed' };
    } else {
      await db.from('review_votes').update({ vote }).eq('id', current.id);
      const addField = vote === 'up' ? 'upvotes' : 'downvotes';
      const removeField = vote === 'up' ? 'downvotes' : 'upvotes';
      const { data: rev } = await db.from('reviews').select('upvotes, downvotes').eq('id', reviewId).single();
      await db.from('reviews').update({ [addField]: rev[addField] + 1, [removeField]: Math.max(0, rev[removeField] - 1) }).eq('id', reviewId);
      return { success: true, action: 'switched' };
    }
  } else {
    await db.from('review_votes').insert([{ review_id: reviewId, user_id: userId, vote }]);
    const field = vote === 'up' ? 'upvotes' : 'downvotes';
    const { data: rev } = await db.from('reviews').select(field).eq('id', reviewId).single();
    await db.from('reviews').update({ [field]: rev[field] + 1 }).eq('id', reviewId);
    return { success: true, action: 'added' };
  }
}

// --- REPORTS ---

async function dbSubmitReport(reporterId, reportedType, reportedId, reason) {
  const { error } = await db.from('reports').insert([{
    reporter_id: reporterId,
    reported_type: reportedType,
    reported_id: reportedId,
    reason
  }]);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// --- NOTIFICATIONS ---

async function dbGetNotifications(userId) {
  const { data, error } = await db.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

async function dbMarkNotificationRead(notificationId) {
  await db.from('notifications').update({ is_read: true }).eq('id', notificationId);
}

async function dbGetUnreadCount(userId) {
  const { count, error } = await db.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
  if (error) return 0;
  return count;
}