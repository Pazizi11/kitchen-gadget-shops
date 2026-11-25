/* Kitchen Gadget Shops — Password Show / Hide */

(function () {

  const eyeOpen =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path>' +
      '<circle cx="12" cy="12" r="3"></circle>' +
    '</svg>';

  const eyeClosed =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 3l18 18"></path>' +
      '<path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-3.1 3.8"></path>' +
      '<path d="M6.1 6.1C3.4 8.1 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1"></path>' +
      '<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>' +
    '</svg>';

  function addPasswordToggle(input) {
    if (!input) return;

    if (input.dataset.passwordToggleInitialized === 'true') {
      return;
    }

    input.dataset.passwordToggleInitialized = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'password-field';

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'password-toggle';
    button.setAttribute('aria-label', 'Show password');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = eyeOpen;

    button.addEventListener('click', function () {

      const currentlyHidden = input.type === 'password';

      if (currentlyHidden) {

        input.type = 'text';

        button.innerHTML = eyeClosed;
        button.setAttribute('aria-label', 'Hide password');
        button.setAttribute('aria-pressed', 'true');

      } else {

        input.type = 'password';

        button.innerHTML = eyeOpen;
        button.setAttribute('aria-label', 'Show password');
        button.setAttribute('aria-pressed', 'false');

      }

      button.focus();
    });

    wrapper.appendChild(button);
  }

  function initializePasswordToggles() {

    const passwordIds = [
      'registerPassword',
      'registerPassword2',
      'loginPassword',
      'resetPassword',
      'resetPassword2'
    ];

    passwordIds.forEach(function (id) {

      const input = document.getElementById(id);

      if (input) {
        addPasswordToggle(input);
      }

    });
  }

  document.addEventListener(
    'DOMContentLoaded',
    initializePasswordToggles
  );

})();