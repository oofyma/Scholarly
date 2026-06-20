let isRegister = false;

function toggleForm() {
  isRegister = !isRegister;

  document.getElementById('form-title').textContent =
    isRegister ? 'Create account' : 'Sign in';

  document.getElementById('form-sub').textContent =
    isRegister ? 'Join Scholarly as a student or tutor' : 'Welcome back to Scholarly';

  document.getElementById('form-btn').textContent =
    isRegister ? 'Register' : 'Sign in';

  document.getElementById('reg-name').style.display =
    isRegister ? 'block' : 'none';

  document.getElementById('toggle-link').textContent =
    isRegister
      ? 'Already have an account? Sign in'
      : "Don't have an account? Register";
}