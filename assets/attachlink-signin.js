(() => {
  'use strict';

  const portals = {
    student: {description: 'Find openings and manage your applications.', registration: 'register.html', label: 'Create Student Account'},
    employer: {description: 'Manage your company, openings and applicants.', registration: '../employers/register.html', label: 'Create Company Account'},
    admin: {description: 'Manage company verification, placements and support.'}
  };
  const parameters = new URLSearchParams(location.search);
  const requested = parameters.get('role');
  const aliases = {company: 'employer', recruiter: 'employer', administrator: 'admin'};
  const initial = Object.hasOwn(portals, requested) ? requested : (Object.hasOwn(aliases, requested) ? aliases[requested] : 'student');
  const selector = document.querySelector('.al-role');
  const form = document.getElementById('signin-form');
  const status = document.getElementById('signin-status');
  const register = document.getElementById('register-link');
  const password = document.getElementById('password');
  const reveal = document.getElementById('reveal-password');
  const getRole = () => selector.querySelector('input:checked').value;
  selector.querySelector('input[value="' + initial + '"]').checked = true;

  function displayRole() {
    const portal = portals[getRole()];
    document.getElementById('portal-description').textContent = portal.description;
    register.hidden = !portal.registration;
    if (portal.registration) {
      register.href = portal.registration;
      register.textContent = portal.label;
    } else {
      register.removeAttribute('href');
      register.textContent = '';
    }
    status.textContent = '';
  }
  selector.addEventListener('change', displayRole);
  displayRole();
  if (parameters.has('session')) status.textContent = 'Your session ended. Sign in to continue.';

  reveal.addEventListener('click', () => {
    const showing = password.type === 'password';
    password.type = showing ? 'text' : 'password';
    reveal.textContent = showing ? 'Hide' : 'Show';
  });

  async function request(path, options) {
    const response = await fetch('../../backend/api/auth/' + path, {credentials: 'same-origin', cache: 'no-store', ...options});
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.message || 'Sign-in is temporarily unavailable. Try again.');
    return data;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = event.submitter;
    if (submit.disabled) return;
    const role = getRole();
    const fields = Object.fromEntries(new FormData(form));
    submit.disabled = true;
    selector.disabled = true;
    status.textContent = 'Signing in...';
    try {
      const {csrf_token} = await request('csrf.php');
      await request('login.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...fields, role, csrf_token})
      });
      location.assign('../../backend/open-portal.php');
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = false;
      selector.disabled = false;
    }
  });
  form.querySelector('button[type="submit"]').disabled = false;
})();
