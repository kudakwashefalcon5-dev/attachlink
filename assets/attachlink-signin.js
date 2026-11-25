(() => {
  'use strict';

  const portals = {
    student: {description: 'Find openings and manage your applications.', registration: 'register.html', label: 'Create Student Account'},
    employer: {description: 'Manage your company, openings and applicants.', registration: '../employers/register.html', label: 'Create Company Account'}
  };
  const parameters = new URLSearchParams(location.search);
  const requested = parameters.get('role');
  const admin = document.body.dataset.signinRole === 'admin';
  if (!admin && ['admin','administrator'].includes(requested)) {
    location.replace('../admin/sign-in.html'+location.search);
    return;
  }
  const aliases = {company: 'employer', recruiter: 'employer'};
  const initial = Object.hasOwn(portals, requested) ? requested : (Object.hasOwn(aliases, requested) ? aliases[requested] : 'student');
  const selector = document.querySelector('.al-role');
  const form = document.getElementById('signin-form');
  const status = document.getElementById('signin-status');
  const register = document.getElementById('register-link');
  const password = document.getElementById('password');
  const reveal = document.getElementById('reveal-password');
  const getRole = () => admin ? 'admin' : selector.querySelector('input:checked').value;

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
  if (selector) {
    selector.querySelector('input[value="' + initial + '"]').checked = true;
    selector.addEventListener('change', displayRole);
    displayRole();
  }
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
    if (selector) selector.disabled = true;
    status.textContent = 'Signing in...';
    try {
      const {csrf_token} = await request('csrf.php');
      const result = await request('login.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...fields, role, csrf_token})
      });
      if (result.totp_required) {
        form.hidden = true;
        const factor = document.createElement('form');
        const label = document.createElement('label');
        const code = document.createElement('input');
        const proceed = document.createElement('button');
        const feedback = document.createElement('p');
        label.textContent = result.setup_key ? 'Authenticator code' : 'Authenticator or recovery code';
        code.className = 'al-auth-input';
        code.autocomplete = 'one-time-code';
        code.required = true;
        code.maxLength = 40;
        label.append(code);
        proceed.className = submit.className;
        proceed.textContent = 'Verify and sign in';
        feedback.setAttribute('role','status');
        if (result.setup_key) {
          const setup = document.createElement('p');
          setup.textContent = 'Add a time-based account named AttachLink in your authenticator. Enter this setup key: ' + result.setup_key;
          factor.append(setup);
        }
        factor.append(label, proceed, feedback);
        form.after(factor);
        code.focus();
        factor.addEventListener('submit', async verification => {
          verification.preventDefault();
          proceed.disabled = true;
          try {
            const {csrf_token} = await request('csrf.php');
            const verified = await request('admin-totp.php', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({csrf_token, code: code.value.trim()})
            });
            if (!verified.recovery_codes.length) {
              location.assign('../../backend/open-portal.php');
              return;
            }
            const instructions = document.createElement('p');
            instructions.textContent = 'Save these single-use recovery codes somewhere secure. They are shown only once.';
            const codes = document.createElement('ul');
            for (const value of verified.recovery_codes) {
              const item = document.createElement('li');
              item.textContent = value;
              codes.append(item);
            }
            const portal = document.createElement('a');
            portal.href = '../../backend/open-portal.php';
            portal.textContent = 'Continue to dashboard';
            factor.replaceChildren(instructions, codes, portal);
            portal.focus();
          } catch (error) {
            feedback.textContent = error.message;
            proceed.disabled = false;
          }
        });
        return;
      }
      location.assign('../../backend/open-portal.php');
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = false;
      if (selector) selector.disabled = false;
    }
  });
  form.querySelector('button[type="submit"]').disabled = false;
})();
