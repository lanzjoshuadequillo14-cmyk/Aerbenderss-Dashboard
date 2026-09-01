document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Hamburger Menu Method Initialization
  initHamburgerMenu();

  // Logout Logic Initialization
  initLogout();
});

/**
 * Hamburger Navigation Drawer Method
 */
function initHamburgerMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!menuToggle || !sidebar || !overlay) return;

  // Toggle Function
  const toggleMenu = (isOpen) => {
    const shouldOpen = typeof isOpen === 'boolean' ? isOpen : !sidebar.classList.contains('active');

    sidebar.classList.toggle('active', shouldOpen);
    overlay.classList.toggle('active', shouldOpen);
    menuToggle.setAttribute('aria-expanded', shouldOpen);

    // Swap hamburger icon with close icon
    const icon = menuToggle.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', shouldOpen ? 'x' : 'menu');
      if (window.lucide) {
        lucide.createIcons();
      }
    }
  };

  // Event Listeners
  menuToggle.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMenu();
  });

  overlay.addEventListener('click', () => toggleMenu(false));

  // Close menu on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('active')) {
      toggleMenu(false);
    }
  });
}

function initLogout() {
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm("Are you sure you want to log out?")) {
        console.log("Logged out successfully");
      }
    });
  }
}