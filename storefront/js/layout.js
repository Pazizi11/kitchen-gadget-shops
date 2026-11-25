/* ==========================================================================
   Kitchen Gadget Shops — Shared Header & Footer Injector
   Each page includes a <header id="site-header-mount"></header> and
   <footer id="site-footer-mount"></footer> placeholder; this script fills them.
   ========================================================================== */

function renderHeader(activePage) {
  const mount = document.getElementById('site-header-mount');
  if (!mount) return;

  const homeDestination =
    typeof isCustomerLoggedIn === 'function' && isCustomerLoggedIn()
      ? 'shop.html'
      : 'index.html';

  const nav = [
    { href: homeDestination, label: 'Home', key: 'home' },
    { href: 'products.html', label: 'Shop All', key: 'products' },
    { href: 'products.html?category=Small%20Appliances', label: 'Appliances', key: 'appliances' },
    { href: 'products.html?category=Cooking%20Tools', label: 'Cooking Tools', key: 'tools' },
    { href: 'about.html', label: 'About', key: 'about' }
  ];

  const navHtml = nav.map(function (item) {
    const isActive = item.key === activePage ? ' active' : '';

    return (
      '<a href="' +
      item.href +
      '" class="' +
      isActive.trim() +
      '">' +
      item.label +
      '</a>'
    );
  }).join('');

  mount.innerHTML =
    '<div class="announce-bar">🚚 Free shipping on all orders &nbsp;|&nbsp; Kitchen Gadget Shops — upgrade your kitchen today</div>' +

    '<header class="site-header">' +

    '  <div class="header-inner container">' +

    '    <a href="' + homeDestination + '" class="logo">' +
    '      <span class="logo-icon"><i class="fa-solid fa-kitchen-set"></i></span>' +
    '      Kitchen<span class="accent">Gadget</span>Shops' +
    '    </a>' +

    '    <div class="site-search desktop-site-search">' +
    '      <form class="site-search-form" id="siteSearchForm">' +
    '        <i class="fa-solid fa-magnifying-glass site-search-icon"></i>' +
    '        <input' +
    '          type="search"' +
    '          id="siteSearchInput"' +
    '          autocomplete="off"' +
    '          placeholder="Search kitchen gadgets..."' +
    '          aria-label="Search products and categories"' +
    '        >' +
    '        <button type="submit" aria-label="Search">' +
    '          <i class="fa-solid fa-arrow-right"></i>' +
    '        </button>' +
    '      </form>' +
    '      <div class="site-search-suggestions" id="siteSearchSuggestions"></div>' +
    '    </div>' +

    '    <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation">' +
    '      <i class="fa-solid fa-bars"></i>' +
    '    </button>' +

    '    <nav class="main-nav" id="mainNav">' +
    navHtml +
    '    </nav>' +

    '    <div class="header-actions">' +
    '      <a href="account.html" class="icon-btn account-header-btn" aria-label="My Account">' +
    '        <i class="fa-solid fa-user"></i>' +
    '        <span class="account-label">Account</span>' +
    '      </a>' +

    '      <a href="cart.html" class="icon-btn" aria-label="Cart">' +
    '        <i class="fa-solid fa-cart-shopping"></i>' +
    '        <span class="cart-count">0</span>' +
    '      </a>' +
    '    </div>' +

    '  </div>' +

    '  <div class="mobile-site-search">' +
    '    <div class="container">' +
    '      <div class="site-search">' +
    '        <form class="site-search-form" id="mobileSiteSearchForm">' +
    '          <i class="fa-solid fa-magnifying-glass site-search-icon"></i>' +
    '          <input' +
    '            type="search"' +
    '            id="mobileSiteSearchInput"' +
    '            autocomplete="off"' +
    '            placeholder="Search kitchen gadgets..."' +
    '            aria-label="Search products and categories"' +
    '          >' +
    '          <button type="submit" aria-label="Search">' +
    '            <i class="fa-solid fa-arrow-right"></i>' +
    '          </button>' +
    '        </form>' +
    '        <div class="site-search-suggestions" id="mobileSiteSearchSuggestions"></div>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +

    '</header>';

  const toggle = document.getElementById('navToggle');
  const navEl = document.getElementById('mainNav');

  if (toggle && navEl) {
    toggle.addEventListener('click', function () {
      navEl.classList.toggle('open');
    });
  }

  const desktopForm =
    document.getElementById('siteSearchForm');

  const mobileForm =
    document.getElementById('mobileSiteSearchForm');

  function submitSearch(inputId) {
    const input = document.getElementById(inputId);

    if (!input) return;

    const query = String(input.value || '').trim();

    if (!query) return;

    window.location.href =
      'products.html?search=' +
      encodeURIComponent(query);
  }

  if (desktopForm) {
    desktopForm.addEventListener('submit', function (event) {
      event.preventDefault();
      submitSearch('siteSearchInput');
    });
  }

  if (mobileForm) {
    mobileForm.addEventListener('submit', function (event) {
      event.preventDefault();
      submitSearch('mobileSiteSearchInput');
    });
  }

  if (typeof window.initSiteSearch === 'function') {
    window.initSiteSearch();
  }

  updateCartBadge();
}

function renderFooter() {
  const mount = document.getElementById('site-footer-mount');
  if (!mount) return;

  const year = new Date().getFullYear();

  mount.innerHTML =
    '<footer class="site-footer">' +
    '  <div class="container">' +
    '    <div class="footer-grid">' +

    '      <div class="footer-about">' +
    '        <h4>Kitchen Gadget Shops</h4>' +
    '        <p>Clever, high-quality kitchen gadgets that make everyday cooking faster and easier — sourced and shipped from our trusted global fulfillment network.</p>' +

    '        <div class="footer-social">' +
    '          <a href="' + KGS_CONFIG.SOCIALS.facebook + '" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i class="fa-brands fa-facebook-f"></i></a>' +
    '          <a href="' + KGS_CONFIG.SOCIALS.instagram + '" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>' +
    '          <a href="' + KGS_CONFIG.SOCIALS.tiktok + '" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><i class="fa-brands fa-tiktok"></i></a>' +
    '          <a href="' + KGS_CONFIG.SOCIALS.pinterest + '" target="_blank" rel="noopener noreferrer" aria-label="Pinterest"><i class="fa-brands fa-pinterest-p"></i></a>' +
    '        </div>' +
    '      </div>' +

    '      <div>' +
    '        <h4>Shop</h4>' +
    '        <ul>' +
    '          <li><a href="products.html">All Products</a></li>' +
    '          <li><a href="products.html?category=Cooking%20Tools">Cooking Tools</a></li>' +
    '          <li><a href="products.html?category=Small%20Appliances">Small Appliances</a></li>' +
    '          <li><a href="products.html?category=Bakeware">Bakeware</a></li>' +
    '        </ul>' +
    '      </div>' +

    '      <div>' +
    '        <h4>Company</h4>' +
    '        <ul>' +
    '          <li><a href="about.html">About Us</a></li>' +
    '          <li><a href="about.html#shipping">Shipping & Returns</a></li>' +
    '          <li><a href="about.html#faq">FAQ</a></li>' +
    '          <li><a href="admin/login.html">Store Admin</a></li>' +
    '        </ul>' +
    '      </div>' +

    '      <div>' +
    '        <h4>Stay in the loop</h4>' +
    '        <p style="font-size:0.85rem;color:#a8a29a;margin-bottom:14px;">Get new gadget drops & exclusive deals in your inbox.</p>' +
    '        <form class="newsletter-signup" onsubmit="event.preventDefault(); subscribeNewsletter(this.querySelector(\'input\').value, this);" style="display:flex;gap:8px;">' +
    '          <input type="email" required placeholder="Email address" style="flex:1;padding:10px 14px;border-radius:8px;border:none;font-family:inherit;">' +
    '          <button class="btn btn-primary btn-sm" type="submit"><i class="fa-solid fa-paper-plane"></i></button>' +
    '        </form>' +
    '        <a href="mailto:' + KGS_CONFIG.NEWSLETTER_EMAIL + '" style="display:inline-block;margin-top:10px;font-size:0.8rem;color:#d6d3d1;">' +
    KGS_CONFIG.NEWSLETTER_EMAIL +
    '</a>' +
    '      </div>' +

    '    </div>' +

    '    <div class="footer-bottom">' +
    '      <span>© ' + year + ' Kitchen Gadget Shops. All rights reserved.</span>' +
    '      <span>Fulfilled via global dropshipping partners · Ships in 7–15 business days</span>' +
    '    </div>' +

    '  </div>' +
    '</footer>';
}