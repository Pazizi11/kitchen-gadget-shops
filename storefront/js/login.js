function authMessage(text, error) { const el=document.getElementById('authMessage'); el.hidden=false; el.className='account-message '+(error?'error':'success'); el.textContent=text; }
document.addEventListener('DOMContentLoaded', function(){
  if (isCustomerLoggedIn()) { window.location.href='account.html'; return; }

  document.getElementById('loginForm').addEventListener('submit', async function(e){
    e.preventDefault();

    const btn=document.getElementById('loginBtn');

    btn.disabled=true;
    btn.textContent='Logging in...';

    try {
      const result=await loginCustomer(
        document.getElementById('loginEmail').value.trim(),
        document.getElementById('loginPassword').value
      );

      const next=new URLSearchParams(location.search).get('next');

      window.location.href=next || 'account.html';

    } catch(err) {
      authMessage(
        err.message || 'Login failed.',
        true
      );

      btn.disabled=false;
      btn.textContent='Log In';
    }
  });

  const googleButton =
    document.getElementById('loginGoogleButton');

  if (googleButton) {
    googleButton.addEventListener('click', async function(){
      googleButton.disabled=true;
      googleButton.innerHTML =
        '<span class="google-auth-icon">G</span> ' +
        'Connecting to Google...';

      try {
        await startGoogleCustomerAuth();
      } catch(err) {
        authMessage(
          err.message || 'Google sign-in could not be started.',
          true
        );

        googleButton.disabled=false;
        googleButton.innerHTML =
          '<span class="google-auth-icon">G</span> ' +
          'Continue with Google';
      }
    });
  }
});

