/* AttachLink Stage 18 — role-aware Stitch login; no layout changes.
   Works alongside the original inline functions and Stage 10C role connector. */
(function () {
  'use strict';
  const studentTab = document.getElementById('roleStudent');
  const companyTab = document.getElementById('roleRecruiter');
  const emailField = document.getElementById('emailInput');
  const passwordField = document.getElementById('passwordInput');
  if (!studentTab || !companyTab || !emailField || !passwordField ||
      typeof window.requestAuth !== 'function' ||
      typeof window.handleSignIn !== 'function') {
    console.error('AttachLink: login form structure is not compatible with Stage 18.');
    return;
  }

  const selectedPortal = () => companyTab.classList.contains('bg-primary-container') ? 'company' : 'student';
  const priorRequestAuth = window.requestAuth;
  window.requestAuth = function (endpoint, data) {
    // The PHP server compares this claimed portal with the role stored in users.
    if (endpoint === 'login.php') {
      return priorRequestAuth.call(this, endpoint, Object.assign({}, data || {}, {portal: selectedPortal()}));
    }
    return priorRequestAuth.apply(this, arguments);
  };

  const priorSwitchRole = window.switchRole;
  const suggestions = document.getElementById('institutionEmailSuggestions');
  const updateSuggestions = () => { if (suggestions) suggestions.classList.toggle('hidden', selectedPortal() === 'company'); };
  updateSuggestions();
  if (typeof priorSwitchRole === 'function') {
    window.switchRole = function (role) {
      priorSwitchRole.apply(this, arguments);
      updateSuggestions();
      if (role === 'recruiter') {
        if (typeof window.switchAuthMethod === 'function') window.switchAuthMethod('email');
        if (typeof window.showLoginMessage === 'function') {
          window.showLoginMessage('Sign in with your registered company email address.', true);
        }
      }
    };
  }

  const priorSignIn = window.handleSignIn;
  let companyRequestBusy = false;
  window.handleSignIn = async function () {
    if (selectedPortal() !== 'company') {
      // Original student sign-in, including password and phone checks, is retained.
      return priorSignIn.apply(this, arguments);
    }
    if (companyRequestBusy) return;
    const email = emailField.value.trim();
    const password = passwordField.value;
    const button = document.getElementById('signin-submit');
    const show = (message, success = false) => {
      if (typeof window.showLoginMessage === 'function') window.showLoginMessage(message, success);
    };
    if (!email || !emailField.checkValidity()) {
      show('Enter a valid company email address.');
      return;
    }
    if (!password) {
      show('Enter your account password.');
      return;
    }
    companyRequestBusy = true;
    if (button) button.disabled = true;
    try {
      const response = await window.requestAuth('login.php', {email, password});
      // Defence in depth: never redirect a student even if the server was outdated.
      if (!response || !response.user || response.user.role !== 'employer') {
        try { await window.requestAuth('logout.php', {}); } catch (_) {}
        throw new Error('Only employer accounts can sign in under Company / Recruiter. Select the correct portal.');
      }
      show('Sign-in successful. Opening your portal...', true);
      window.location.assign('../../backend/open-portal.php');
    } catch (error) {
      show(error && error.message ? error.message : 'Sign-in failed.');
    } finally {
      companyRequestBusy = false;
      if (button) button.disabled = false;
    }
  };
})();
